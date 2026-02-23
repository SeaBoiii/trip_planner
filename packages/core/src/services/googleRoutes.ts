import type { TravelMode, TravelSegment } from '../types';
import { DEFAULT_ROUTE_CACHE_TTL_MS } from '../storage';
import { IDB_STORES, idbClear, idbGet, idbSet } from './indexedDb';
import { getGlobalRateLimitedQueue, queuedRequest } from './requestQueue';

export const GOOGLE_ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const GOOGLE_ROUTES_QUEUE = getGlobalRateLimitedQueue('routing_google_routes', 1000);
const ROUTING_CACHE_VERSION = 'v1';

export interface GoogleRouteWaypoint {
  itemId: string;
  lat: number;
  lon: number;
}

export interface ComputeDayTravelSegmentsParams {
  apiKey: string;
  mode: TravelMode;
  trafficAware: boolean;
  waypoints: GoogleRouteWaypoint[];
  languageCode?: string;
  regionCode?: string;
}

export interface DayTravelCacheArgs {
  tripId: string;
  dayId: string;
  mode: TravelMode;
  trafficAware: boolean;
  waypoints: GoogleRouteWaypoint[];
}

export interface CachedDayTravelSegments {
  cacheKey: string;
  segments: TravelSegment[];
  fetchedAt: number;
}

interface DayTravelCacheEntry extends CachedDayTravelSegments {
  expiresAt: number;
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

type GoogleLegPolyline = {
  geoJsonLinestring?: unknown;
};

type GoogleComputeRoutesResponse = {
  routes?: Array<{
    legs?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: GoogleLegPolyline;
    }>;
  }>;
};

function roundCoord(value: number): string {
  return value.toFixed(5);
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function waypointSignature(waypoints: GoogleRouteWaypoint[]): string {
  return waypoints
    .map((waypoint) => `${waypoint.itemId}@${roundCoord(waypoint.lat)},${roundCoord(waypoint.lon)}`)
    .join('|');
}

export function buildTravelSegmentPairKey(fromItemId: string, toItemId: string): string {
  return `${fromItemId}->${toItemId}`;
}

export function parseGoogleDurationSeconds(value: string | undefined | null): number {
  if (!value || typeof value !== 'string') {
    throw new Error('Missing duration');
  }
  const match = value.match(/^(-?\d+(?:\.\d+)?)s$/);
  if (!match) {
    throw new Error(`Invalid Google duration format: ${value}`);
  }
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) {
    throw new Error(`Invalid Google duration value: ${value}`);
  }
  return Math.round(seconds);
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

export function buildDayTravelCacheKey(args: DayTravelCacheArgs): string {
  const signature = waypointSignature(args.waypoints);
  const hashedSignature = hashString(signature);
  return [
    'routing-day',
    ROUTING_CACHE_VERSION,
    'google_routes',
    args.tripId,
    args.dayId,
    args.mode,
    args.trafficAware ? 'traffic' : 'no-traffic',
    hashedSignature,
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
  if (!parsed || typeof parsed !== 'object') return undefined;
  const value = parsed as { type?: unknown; coordinates?: unknown };
  if (value.type !== 'LineString' || !Array.isArray(value.coordinates)) return undefined;
  const coords: Array<[number, number]> = [];
  for (const pair of value.coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    coords.push([lat, lon]);
  }
  return coords.length >= 2 ? coords : undefined;
}

function extractLegCoords(polyline?: GoogleLegPolyline): Array<[number, number]> | undefined {
  if (!polyline) return undefined;
  return parseGeoJsonCoords(polyline.geoJsonLinestring);
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
    // Fall back to raw text.
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

export async function computeDayTravelSegments(params: ComputeDayTravelSegmentsParams): Promise<TravelSegment[]> {
  if (params.waypoints.length < 2) return [];

  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    throw new GoogleRoutesError('Google Maps Routes API key required');
  }

  const waypoints = params.waypoints;
  const now = Date.now();
  const body: Record<string, unknown> = {
    origin: googleWaypoint(waypoints[0]),
    destination: googleWaypoint(waypoints[waypoints.length - 1]),
    travelMode: params.mode,
    polylineEncoding: 'GEO_JSON_LINESTRING',
    polylineQuality: 'OVERVIEW',
  };

  const middle = waypoints.slice(1, -1);
  if (middle.length > 0) {
    body.intermediates = middle.map(googleWaypoint);
  }
  if (params.languageCode) body.languageCode = params.languageCode;
  if (params.regionCode) body.regionCode = params.regionCode;
  if (params.mode === 'DRIVE' && params.trafficAware) {
    body.routingPreference = 'TRAFFIC_AWARE';
  }
  if (params.mode === 'TRANSIT') {
    body.departureTime = new Date(now).toISOString();
  }

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

  const payload = (await response.json()) as GoogleComputeRoutesResponse;
  const legs = payload.routes?.[0]?.legs ?? [];
  if (legs.length === 0) {
    return [];
  }

  const expectedLegs = waypoints.length - 1;
  if (legs.length !== expectedLegs) {
    throw new GoogleRoutesError(`Unexpected route leg count (${legs.length}, expected ${expectedLegs})`);
  }

  return legs.map((leg, index) => {
    const fromWaypoint = waypoints[index];
    const toWaypoint = waypoints[index + 1];
    if (typeof leg.distanceMeters !== 'number' || !Number.isFinite(leg.distanceMeters)) {
      throw new GoogleRoutesError(`Missing distance for leg ${index + 1}`);
    }
    const durationSeconds = parseGoogleDurationSeconds(leg.duration);
    return {
      fromItemId: fromWaypoint.itemId,
      toItemId: toWaypoint.itemId,
      mode: params.mode,
      provider: 'google_routes',
      distanceMeters: leg.distanceMeters,
      durationSeconds,
      coords: extractLegCoords(leg.polyline),
      fetchedAt: now,
    } satisfies TravelSegment;
  });
}

export async function getCachedDayTravelSegments(args: DayTravelCacheArgs): Promise<CachedDayTravelSegments | null> {
  const cacheKey = buildDayTravelCacheKey(args);
  const entry = await idbGet<DayTravelCacheEntry>(IDB_STORES.routeCache, cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return {
    cacheKey: entry.cacheKey,
    segments: entry.segments,
    fetchedAt: entry.fetchedAt,
  };
}

async function setCachedDayTravelSegments(
  args: DayTravelCacheArgs,
  segments: TravelSegment[],
  ttlMs = DEFAULT_ROUTE_CACHE_TTL_MS
): Promise<CachedDayTravelSegments> {
  const cacheKey = buildDayTravelCacheKey(args);
  const fetchedAt = segments[0]?.fetchedAt ?? Date.now();
  const entry: DayTravelCacheEntry = {
    cacheKey,
    segments,
    fetchedAt,
    expiresAt: fetchedAt + ttlMs,
  };
  await idbSet(IDB_STORES.routeCache, cacheKey, entry);
  return {
    cacheKey,
    segments,
    fetchedAt,
  };
}

export async function computeDayTravelSegmentsWithCache(
  args: DayTravelCacheArgs & ComputeDayTravelSegmentsParams & { ttlMs?: number; force?: boolean }
): Promise<CachedDayTravelSegments> {
  const cacheArgs: DayTravelCacheArgs = {
    tripId: args.tripId,
    dayId: args.dayId,
    mode: args.mode,
    trafficAware: args.trafficAware,
    waypoints: args.waypoints,
  };

  if (!args.force) {
    const cached = await getCachedDayTravelSegments(cacheArgs);
    if (cached) return cached;
  }

  const segments = await computeDayTravelSegments({
    apiKey: args.apiKey,
    mode: args.mode,
    trafficAware: args.trafficAware,
    waypoints: args.waypoints,
    languageCode: args.languageCode,
    regionCode: args.regionCode,
  });
  return setCachedDayTravelSegments(cacheArgs, segments, args.ttlMs);
}

export function mapSegmentsByPair(segments: TravelSegment[]): Record<string, TravelSegment> {
  const entries = segments.map((segment) => [buildTravelSegmentPairKey(segment.fromItemId, segment.toItemId), segment] as const);
  return Object.fromEntries(entries);
}

export async function clearRoutingCache(): Promise<void> {
  await idbClear(IDB_STORES.routeCache);
}
