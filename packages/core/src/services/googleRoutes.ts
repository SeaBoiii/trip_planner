import type { Day, Item, TravelDefaults, TravelMode, TravelOverride, TravelSegment } from '../types';
import { DEFAULT_ROUTE_CACHE_TTL_MS } from '../storage';
import { IDB_STORES, idbClear, idbGet, idbSet } from './indexedDb';
import { getGlobalRateLimitedQueue, queuedRequest } from './requestQueue';

export const GOOGLE_ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const GOOGLE_ROUTES_QUEUE = getGlobalRateLimitedQueue('routing_google_routes', 1000);
const SEGMENT_CACHE_VERSION = 'v2';
const TRANSIT_ROUTE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface GoogleRouteWaypoint {
  itemId: string;
  lat: number;
  lon: number;
}

export interface CachedSegmentRoute {
  fromItemId?: string;
  toItemId?: string;
  mode: TravelMode;
  trafficAware?: boolean;
  distanceMeters: number;
  durationSeconds: number;
  coords?: Array<[number, number]>; // [lat, lon]
  fetchedAt: number;
  provider: 'google_routes';
}

interface CachedSegmentRouteEntry {
  key: string;
  expiresAt: number;
  value: CachedSegmentRoute;
}

export interface RouteSegmentComputationResult {
  route?: CachedSegmentRoute;
  error?: string;
  fromCache: boolean;
}

export interface ComputeSegmentRouteParams {
  apiKey: string;
  from: [number, number]; // [lon, lat]
  to: [number, number]; // [lon, lat]
  mode: TravelMode;
  trafficAware?: boolean;
  fromItemId?: string;
  toItemId?: string;
  ttlMs?: number;
  force?: boolean;
  languageCode?: string;
  regionCode?: string;
}

export interface ComputeDayRoutesSingleModeParams {
  apiKey: string;
  mode: TravelMode;
  trafficAware?: boolean;
  waypoints: GoogleRouteWaypoint[];
  ttlMs?: number;
  force?: boolean;
  languageCode?: string;
  regionCode?: string;
}

export interface TravelForDaySummary {
  computedCount: number;
  cachedCount: number;
  failedCount: number;
}

export interface TravelForDayResult extends TravelForDaySummary {
  segmentsByEdge: Record<string, CachedSegmentRoute>;
  errorsByEdge: Record<string, string>;
}

export interface ComputeTravelForDayParams {
  tripId: string;
  day: Day;
  tripTravelDefaults?: TravelDefaults;
  apiKey: string;
  ttlMs?: number;
  force?: boolean;
  languageCode?: string;
  regionCode?: string;
}

interface AdjacentLocatedPair {
  edgeKey: string;
  fromItemId: string;
  toItemId: string;
  from: [number, number]; // [lon, lat]
  to: [number, number]; // [lon, lat]
  mode: TravelMode;
  trafficAware: boolean;
}

interface GoogleRoutesErrorLike extends Error {
  status?: number;
  statusText?: string;
}

class GoogleRoutesError extends Error implements GoogleRoutesErrorLike {
  status?: number;
  statusText?: string;

  constructor(message: string, status?: number, statusText?: string) {
    super(message);
    this.name = 'GoogleRoutesError';
    this.status = status;
    this.statusText = statusText;
  }
}

type GoogleLegPolyline = { geoJsonLinestring?: unknown };
type GoogleRoutesLeg = {
  distanceMeters?: number;
  duration?: string;
  polyline?: GoogleLegPolyline;
};
type GoogleComputeRoutesResponse = {
  routes?: Array<{
    legs?: GoogleRoutesLeg[];
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function roundCoord(value: number): string {
  return value.toFixed(5);
}

function getTransitDepartureBucketMs(now = Date.now()): number {
  return Math.floor(now / (60 * 60 * 1000)) * 60 * 60 * 1000;
}

function normalizeTrafficAware(mode: TravelMode, trafficAware?: boolean): boolean {
  if (mode !== 'DRIVE') return false;
  return !!trafficAware;
}

function effectiveTtlMs(mode: TravelMode, requestedTtlMs?: number): number {
  if (mode === 'TRANSIT') {
    return Math.min(requestedTtlMs ?? TRANSIT_ROUTE_CACHE_TTL_MS, TRANSIT_ROUTE_CACHE_TTL_MS);
  }
  return requestedTtlMs ?? DEFAULT_ROUTE_CACHE_TTL_MS;
}

function transitBucketPart(mode: TravelMode, now = Date.now()): string {
  return mode === 'TRANSIT' ? `tb:${getTransitDepartureBucketMs(now)}` : 'tb:none';
}

export function buildTravelSegmentPairKey(fromItemId: string, toItemId: string): string {
  return `${fromItemId}->${toItemId}`;
}

export function resolveTripTravelDefaults(tripTravelDefaults?: TravelDefaults): TravelDefaults {
  return {
    mode: tripTravelDefaults?.mode ?? 'WALK',
    trafficAware: tripTravelDefaults?.mode === 'DRIVE' ? !!tripTravelDefaults?.trafficAware : false,
  };
}

export function resolveDayTravelDefaults(day: Day, tripTravelDefaults?: TravelDefaults): TravelDefaults {
  const tripDefaults = resolveTripTravelDefaults(tripTravelDefaults);
  if (!day.travelDefaults) return tripDefaults;
  const mode = day.travelDefaults.mode ?? tripDefaults.mode;
  return {
    mode,
    trafficAware: mode === 'DRIVE' ? (day.travelDefaults.trafficAware ?? tripDefaults.trafficAware ?? false) : false,
  };
}

export function getEffectiveTravelForEdge(
  day: Day,
  fromItemId: string,
  toItemId: string,
  tripTravelDefaults?: TravelDefaults
): TravelOverride {
  const dayDefaults = resolveDayTravelDefaults(day, tripTravelDefaults);
  const edgeKey = buildTravelSegmentPairKey(fromItemId, toItemId);
  const override = day.travelOverrides?.[edgeKey];
  const mode = override?.mode ?? dayDefaults.mode;
  const trafficAware = mode === 'DRIVE'
    ? (override?.trafficAware ?? dayDefaults.trafficAware ?? false)
    : false;
  return { mode, trafficAware };
}

export function normalizeTravelOverrides(day: Day): Day {
  const overrides = day.travelOverrides;
  if (!overrides || Object.keys(overrides).length === 0) {
    if (day.travelOverrides === undefined) return day;
    const next = { ...day };
    delete next.travelOverrides;
    return next;
  }

  const validEdgeKeys = new Set<string>();
  for (let index = 0; index < day.items.length - 1; index += 1) {
    const from = day.items[index];
    const to = day.items[index + 1];
    if (!from.location || !to.location) continue;
    validEdgeKeys.add(buildTravelSegmentPairKey(from.id, to.id));
  }

  const nextOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([edgeKey]) => validEdgeKeys.has(edgeKey))
  ) as Record<string, TravelOverride>;

  const nextKeys = Object.keys(nextOverrides);
  const currentKeys = Object.keys(overrides);
  const unchanged =
    nextKeys.length === currentKeys.length &&
    nextKeys.every((key) => overrides[key] && overrides[key].mode === nextOverrides[key].mode &&
      (overrides[key].trafficAware ?? false) === (nextOverrides[key].trafficAware ?? false));

  if (unchanged) return day;

  const nextDay: Day = { ...day };
  if (nextKeys.length === 0) {
    delete nextDay.travelOverrides;
  } else {
    nextDay.travelOverrides = nextOverrides;
  }
  return nextDay;
}

export function parseGoogleDurationSeconds(value: string | undefined | null): number {
  if (!value || typeof value !== 'string') throw new Error('Missing duration');
  const match = value.match(/^(-?\d+(?:\.\d+)?)s$/);
  if (!match) throw new Error(`Invalid Google duration format: ${value}`);
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) throw new Error(`Invalid Google duration value: ${value}`);
  return Math.max(0, Math.round(seconds));
}

export function haversineDistanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371008.8;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateTravelDurationSeconds(distanceMeters: number, mode: TravelMode): number {
  const metersPerSecond =
    mode === 'WALK' ? 1.35 :
    mode === 'DRIVE' ? 11.11 :
    6.94;
  return Math.max(0, Math.round(distanceMeters / metersPerSecond));
}

export function buildGoogleDirectionsLink(from: [number, number], to: [number, number], mode: TravelMode): string {
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;
  const googleMode = mode === 'WALK' ? 'walking' : mode === 'DRIVE' ? 'driving' : 'transit';
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}&travelmode=${googleMode}`;
}

export function buildAppleTransitLink(from: [number, number], to: [number, number]): string {
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;
  return `https://maps.apple.com/?saddr=${fromLat},${fromLon}&daddr=${toLat},${toLon}&dirflg=r`;
}

export function buildSegmentRouteCacheKey(args: {
  from: [number, number]; // [lon, lat]
  to: [number, number]; // [lon, lat]
  mode: TravelMode;
  trafficAware?: boolean;
  nowMs?: number;
}): string {
  const [fromLon, fromLat] = args.from;
  const [toLon, toLat] = args.to;
  const trafficAware = normalizeTrafficAware(args.mode, args.trafficAware);
  return [
    'route-segment',
    SEGMENT_CACHE_VERSION,
    'google_routes',
    args.mode,
    trafficAware ? 'traffic' : 'no-traffic',
    `${roundCoord(fromLat)},${roundCoord(fromLon)}`,
    `${roundCoord(toLat)},${roundCoord(toLon)}`,
    transitBucketPart(args.mode, args.nowMs),
  ].join(':');
}

function googleWaypoint(waypoint: { lat: number; lon: number }) {
  return {
    location: {
      latLng: {
        latitude: waypoint.lat,
        longitude: waypoint.lon,
      },
    },
  };
}

function parseGeoJsonCoords(raw: unknown): Array<[number, number]> | undefined {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!isRecord(parsed) || parsed.type !== 'LineString' || !Array.isArray(parsed.coordinates)) return undefined;
  const coords: Array<[number, number]> = [];
  for (const pair of parsed.coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    coords.push([lat, lon]);
  }
  return coords.length >= 2 ? coords : undefined;
}

function parseLegToCachedSegment(args: {
  leg: GoogleRoutesLeg;
  mode: TravelMode;
  trafficAware?: boolean;
  fromItemId?: string;
  toItemId?: string;
  fetchedAt: number;
}): CachedSegmentRoute {
  const { leg } = args;
  if (typeof leg.distanceMeters !== 'number' || !Number.isFinite(leg.distanceMeters)) {
    throw new GoogleRoutesError('Missing route distance');
  }
  return {
    fromItemId: args.fromItemId,
    toItemId: args.toItemId,
    mode: args.mode,
    trafficAware: normalizeTrafficAware(args.mode, args.trafficAware),
    distanceMeters: leg.distanceMeters,
    durationSeconds: parseGoogleDurationSeconds(leg.duration),
    coords: parseGeoJsonCoords(leg.polyline?.geoJsonLinestring),
    fetchedAt: args.fetchedAt,
    provider: 'google_routes',
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return response.statusText || `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; status?: string } };
    const message = parsed.error?.message?.trim();
    const status = parsed.error?.status?.trim();
    if (message && status) return `${status}: ${message}`;
    if (message) return message;
  } catch {
    // ignore
  }
  return text;
}

export function formatGoogleRoutesError(error: unknown): string {
  if (error instanceof GoogleRoutesError) {
    if (error.status === 401 || error.status === 403) {
      return 'Routing failed - check Google API key restrictions and billing for Routes API.';
    }
    if (error.status === 429) {
      return 'Routing quota or rate limit reached. Please retry shortly.';
    }
    return error.message || 'Routing request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Routing request failed';
}

async function requestRoutesApi(body: Record<string, unknown>, apiKey: string): Promise<GoogleComputeRoutesResponse> {
  const response = await queuedRequest(GOOGLE_ROUTES_QUEUE, GOOGLE_ROUTES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.legs.distanceMeters,routes.legs.duration,routes.legs.polyline',
    },
    body: JSON.stringify(body),
    maxRetries: 2,
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new GoogleRoutesError(message, response.status, response.statusText);
  }

  return response.json() as Promise<GoogleComputeRoutesResponse>;
}

function buildRoutesRequestBody(args: {
  waypoints: Array<{ lat: number; lon: number }>;
  mode: TravelMode;
  trafficAware?: boolean;
  nowMs: number;
  languageCode?: string;
  regionCode?: string;
}) {
  const body: Record<string, unknown> = {
    origin: googleWaypoint(args.waypoints[0]),
    destination: googleWaypoint(args.waypoints[args.waypoints.length - 1]),
    travelMode: args.mode,
    polylineEncoding: 'GEO_JSON_LINESTRING',
    polylineQuality: 'OVERVIEW',
  };
  const middle = args.waypoints.slice(1, -1);
  if (middle.length > 0) {
    body.intermediates = middle.map(googleWaypoint);
  }
  if (args.languageCode) body.languageCode = args.languageCode;
  if (args.regionCode) body.regionCode = args.regionCode;
  if (args.mode === 'DRIVE' && normalizeTrafficAware(args.mode, args.trafficAware)) {
    body.routingPreference = 'TRAFFIC_AWARE';
  }
  if (args.mode === 'TRANSIT') {
    body.departureTime = new Date(args.nowMs).toISOString();
  }
  return body;
}

async function getCachedSegmentRouteByKey(key: string): Promise<CachedSegmentRoute | null> {
  const entry = await idbGet<CachedSegmentRouteEntry>(IDB_STORES.routeCache, key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

async function setCachedSegmentRouteByKey(key: string, value: CachedSegmentRoute, ttlMs: number): Promise<void> {
  const entry: CachedSegmentRouteEntry = {
    key,
    expiresAt: value.fetchedAt + ttlMs,
    value,
  };
  await idbSet(IDB_STORES.routeCache, key, entry);
}

export async function getCachedSegmentRoute(args: {
  from: [number, number];
  to: [number, number];
  mode: TravelMode;
  trafficAware?: boolean;
  nowMs?: number;
}): Promise<CachedSegmentRoute | null> {
  const key = buildSegmentRouteCacheKey(args);
  return getCachedSegmentRouteByKey(key);
}

export async function computeSegmentRoute(args: ComputeSegmentRouteParams): Promise<RouteSegmentComputationResult> {
  const nowMs = Date.now();
  const mode = args.mode;
  const trafficAware = normalizeTrafficAware(mode, args.trafficAware);
  const cacheKey = buildSegmentRouteCacheKey({
    from: args.from,
    to: args.to,
    mode,
    trafficAware,
    nowMs,
  });

  if (!args.force) {
    const cached = await getCachedSegmentRouteByKey(cacheKey);
    if (cached) {
      return { route: cached, fromCache: true };
    }
  }

  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    return { error: 'Google Maps Routes API key required', fromCache: false };
  }

  try {
    const [fromLon, fromLat] = args.from;
    const [toLon, toLat] = args.to;
    const body = buildRoutesRequestBody({
      waypoints: [
        { lat: fromLat, lon: fromLon },
        { lat: toLat, lon: toLon },
      ],
      mode,
      trafficAware,
      nowMs,
      languageCode: args.languageCode,
      regionCode: args.regionCode,
    });
    const payload = await requestRoutesApi(body, apiKey);
    const leg = payload.routes?.[0]?.legs?.[0];
    if (!leg) {
      throw new GoogleRoutesError(mode === 'TRANSIT' ? 'Transit unavailable for this route' : 'No route found');
    }
    const route = parseLegToCachedSegment({
      leg,
      mode,
      trafficAware,
      fromItemId: args.fromItemId,
      toItemId: args.toItemId,
      fetchedAt: nowMs,
    });
    await setCachedSegmentRouteByKey(cacheKey, route, effectiveTtlMs(mode, args.ttlMs));
    return { route, fromCache: false };
  } catch (error) {
    return { error: formatGoogleRoutesError(error), fromCache: false };
  }
}

export async function computeDayRoutesSingleMode(params: ComputeDayRoutesSingleModeParams): Promise<TravelSegment[]> {
  if (params.waypoints.length < 2) return [];

  const apiKey = params.apiKey.trim();
  if (!apiKey) throw new GoogleRoutesError('Google Maps Routes API key required');

  const nowMs = Date.now();
  const body = buildRoutesRequestBody({
    waypoints: params.waypoints.map((waypoint) => ({ lat: waypoint.lat, lon: waypoint.lon })),
    mode: params.mode,
    trafficAware: params.trafficAware,
    nowMs,
    languageCode: params.languageCode,
    regionCode: params.regionCode,
  });

  const payload = await requestRoutesApi(body, apiKey);
  const legs = payload.routes?.[0]?.legs ?? [];
  const expectedLegs = params.waypoints.length - 1;
  if (legs.length === 0) {
    throw new GoogleRoutesError(params.mode === 'TRANSIT' ? 'Transit unavailable for this route' : 'No route found');
  }
  if (legs.length !== expectedLegs) {
    throw new GoogleRoutesError(`Unexpected route leg count (${legs.length}, expected ${expectedLegs})`);
  }

  const segments: TravelSegment[] = [];
  for (let index = 0; index < legs.length; index += 1) {
    const fromWaypoint = params.waypoints[index];
    const toWaypoint = params.waypoints[index + 1];
    const parsed = parseLegToCachedSegment({
      leg: legs[index],
      mode: params.mode,
      trafficAware: params.trafficAware,
      fromItemId: fromWaypoint.itemId,
      toItemId: toWaypoint.itemId,
      fetchedAt: nowMs,
    });

    const travelSegment: TravelSegment = {
      fromItemId: parsed.fromItemId ?? fromWaypoint.itemId,
      toItemId: parsed.toItemId ?? toWaypoint.itemId,
      mode: parsed.mode,
      provider: 'google_routes',
      distanceMeters: parsed.distanceMeters,
      durationSeconds: parsed.durationSeconds,
      coords: parsed.coords,
      fetchedAt: parsed.fetchedAt,
    };
    segments.push(travelSegment);

    const cacheKey = buildSegmentRouteCacheKey({
      from: [fromWaypoint.lon, fromWaypoint.lat],
      to: [toWaypoint.lon, toWaypoint.lat],
      mode: params.mode,
      trafficAware: params.trafficAware,
      nowMs,
    });
    await setCachedSegmentRouteByKey(
      cacheKey,
      parsed,
      effectiveTtlMs(params.mode, params.ttlMs)
    );
  }

  return segments;
}

function itemHasLocation(item: Item): item is Item & { location: NonNullable<Item['location']> } {
  return !!item.location;
}

export function buildDayLocatedWaypoints(day: Day): GoogleRouteWaypoint[] {
  return day.items
    .filter(itemHasLocation)
    .map((item) => ({
      itemId: item.id,
      lat: item.location.lat,
      lon: item.location.lon,
    }));
}

export function buildAdjacentLocatedPairsForDay(day: Day, tripTravelDefaults?: TravelDefaults): AdjacentLocatedPair[] {
  const pairs: AdjacentLocatedPair[] = [];
  for (let index = 0; index < day.items.length - 1; index += 1) {
    const fromItem = day.items[index];
    const toItem = day.items[index + 1];
    if (!fromItem.location || !toItem.location) continue;
    const effective = getEffectiveTravelForEdge(day, fromItem.id, toItem.id, tripTravelDefaults);
    pairs.push({
      edgeKey: buildTravelSegmentPairKey(fromItem.id, toItem.id),
      fromItemId: fromItem.id,
      toItemId: toItem.id,
      from: [fromItem.location.lon, fromItem.location.lat],
      to: [toItem.location.lon, toItem.location.lat],
      mode: effective.mode,
      trafficAware: normalizeTrafficAware(effective.mode, effective.trafficAware),
    });
  }
  return pairs;
}

export async function computeTravelForDay(params: ComputeTravelForDayParams): Promise<TravelForDayResult> {
  const normalizedDay = normalizeTravelOverrides(params.day);
  const dayDefaults = resolveDayTravelDefaults(normalizedDay, params.tripTravelDefaults);
  const pairs = buildAdjacentLocatedPairsForDay(normalizedDay, params.tripTravelDefaults);
  const result: TravelForDayResult = {
    computedCount: 0,
    cachedCount: 0,
    failedCount: 0,
    segmentsByEdge: {},
    errorsByEdge: {},
  };
  if (pairs.length === 0) return result;

  const missingPairs: AdjacentLocatedPair[] = [];

  if (!params.force) {
    for (const pair of pairs) {
      const cached = await getCachedSegmentRoute({
        from: pair.from,
        to: pair.to,
        mode: pair.mode,
        trafficAware: pair.trafficAware,
      });
      if (cached) {
        result.cachedCount += 1;
        result.segmentsByEdge[pair.edgeKey] = cached;
      } else {
        missingPairs.push(pair);
      }
    }
  } else {
    missingPairs.push(...pairs);
  }

  if (missingPairs.length === 0) return result;

  const defaultMode = dayDefaults.mode;
  const defaultTrafficAware = normalizeTrafficAware(defaultMode, dayDefaults.trafficAware);

  const missingDefaultPairs = missingPairs.filter(
    (pair) => pair.mode === defaultMode && pair.trafficAware === defaultTrafficAware
  );
  const missingOverridePairs = missingPairs.filter(
    (pair) => !(pair.mode === defaultMode && pair.trafficAware === defaultTrafficAware)
  );

  // Preferred fast path: one day-level call using the day default mode for all located waypoints.
  if (missingDefaultPairs.length > 0) {
    try {
      const waypoints = buildDayLocatedWaypoints(normalizedDay);
      if (waypoints.length >= 2) {
        await computeDayRoutesSingleMode({
          apiKey: params.apiKey,
          mode: defaultMode,
          trafficAware: defaultTrafficAware,
          waypoints,
          ttlMs: params.ttlMs,
          force: true,
          languageCode: params.languageCode,
          regionCode: params.regionCode,
        });
        for (const pair of missingDefaultPairs) {
          const cached = await getCachedSegmentRoute({
            from: pair.from,
            to: pair.to,
            mode: pair.mode,
            trafficAware: pair.trafficAware,
          });
          if (cached) {
            result.computedCount += 1;
            result.segmentsByEdge[pair.edgeKey] = cached;
          } else {
            result.failedCount += 1;
            result.errorsByEdge[pair.edgeKey] = 'Route computed but segment cache was not available';
          }
        }
      }
    } catch (error) {
      const message = formatGoogleRoutesError(error);
      for (const pair of missingDefaultPairs) {
        result.failedCount += 1;
        result.errorsByEdge[pair.edgeKey] = message;
      }
    }
  }

  for (const pair of missingOverridePairs) {
    const segmentResult = await computeSegmentRoute({
      apiKey: params.apiKey,
      from: pair.from,
      to: pair.to,
      mode: pair.mode,
      trafficAware: pair.trafficAware,
      fromItemId: pair.fromItemId,
      toItemId: pair.toItemId,
      ttlMs: params.ttlMs,
      force: params.force,
      languageCode: params.languageCode,
      regionCode: params.regionCode,
    });
    if (segmentResult.route) {
      result.segmentsByEdge[pair.edgeKey] = segmentResult.route;
      if (segmentResult.fromCache) result.cachedCount += 1;
      else result.computedCount += 1;
    } else {
      result.failedCount += 1;
      result.errorsByEdge[pair.edgeKey] = segmentResult.error ?? 'Routing request failed';
    }
  }

  return result;
}

export function mapSegmentsByPair(segments: TravelSegment[]): Record<string, TravelSegment> {
  return Object.fromEntries(
    segments.map((segment) => [buildTravelSegmentPairKey(segment.fromItemId, segment.toItemId), segment] as const)
  );
}

export async function clearRoutingCache(): Promise<void> {
  await idbClear(IDB_STORES.routeCache);
}

