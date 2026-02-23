import type { RoutingProviderId, TravelMode } from '../types';
import { DEFAULT_ROUTE_CACHE_TTL_MS } from '../storage';
import { IDB_STORES, idbClear, idbGet, idbSet } from './indexedDb';
import { getGlobalRateLimitedQueue, queuedJson } from './requestQueue';

type GeoJsonLineString = { type: 'LineString'; coordinates: number[][] };
type GeoJsonMultiLineString = { type: 'MultiLineString'; coordinates: number[][][] };

export type RouteGeometry =
  | { type: 'polyline6'; value: string }
  | { type: 'geojson'; value: GeoJsonLineString | GeoJsonMultiLineString };

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry?: RouteGeometry;
  provider: string;
  fetchedAt: number;
}

export interface RoutingProvider {
  id: RoutingProviderId;
  label: string;
  supports: TravelMode[];
  requiresApiKey: boolean;
  getRoute(args: { from: [number, number]; to: [number, number]; mode: TravelMode; apiKey?: string }): Promise<RouteResult>;
}

interface RouteCacheEntry {
  key: string;
  expiresAt: number;
  result: RouteResult;
}

const OSRM_QUEUE = getGlobalRateLimitedQueue('routing_osrm', 1000);
const VALHALLA_QUEUE = getGlobalRateLimitedQueue('routing_valhalla', 1000);
const ORS_QUEUE = getGlobalRateLimitedQueue('routing_ors', 1000);

function roundCoord(value: number): string {
  return value.toFixed(5);
}

export function buildRouteCacheKey(args: {
  providerId: RoutingProviderId;
  mode: TravelMode;
  from: [number, number];
  to: [number, number];
  schemaVersion?: string;
}) {
  const version = args.schemaVersion ?? 'v1';
  const [fromLon, fromLat] = args.from;
  const [toLon, toLat] = args.to;
  return [
    'route',
    version,
    args.providerId,
    args.mode,
    `${roundCoord(fromLon)},${roundCoord(fromLat)}`,
    `${roundCoord(toLon)},${roundCoord(toLat)}`,
  ].join(':');
}

async function getCachedRoute(key: string): Promise<RouteResult | null> {
  const entry = await idbGet<RouteCacheEntry>(IDB_STORES.routeCache, key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.result;
}

export async function getCachedRouteByArgs(args: {
  providerId: RoutingProviderId;
  mode: TravelMode;
  from: [number, number];
  to: [number, number];
}): Promise<RouteResult | null> {
  return getCachedRoute(
    buildRouteCacheKey({
      providerId: args.providerId,
      mode: args.mode,
      from: args.from,
      to: args.to,
    })
  );
}

async function setCachedRoute(key: string, result: RouteResult, ttlMs = DEFAULT_ROUTE_CACHE_TTL_MS) {
  const entry: RouteCacheEntry = {
    key,
    expiresAt: Date.now() + ttlMs,
    result,
  };
  await idbSet(IDB_STORES.routeCache, key, entry);
}

export async function clearRoutingCache(): Promise<void> {
  await idbClear(IDB_STORES.routeCache);
}

export function haversineDistanceMeters(from: [number, number], to: [number, number]): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371008.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateTravelDurationSeconds(distanceMeters: number, mode: TravelMode): number {
  const metersPerSecond =
    mode === 'walk' ? 1.35 :
    mode === 'drive' ? 11.11 :
    6.94; // transit rough average incl waits
  return Math.round(distanceMeters / metersPerSecond);
}

export function getTravelFallback(distanceMeters: number, mode: TravelMode) {
  return {
    distanceMeters,
    durationSeconds: estimateTravelDurationSeconds(distanceMeters, mode),
  };
}

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{ distance?: number; duration?: number; geometry?: string }>;
  message?: string;
};

const osrmDemoProvider: RoutingProvider = {
  id: 'osrm_demo',
  label: 'OSRM Demo',
  supports: ['walk', 'drive'],
  requiresApiKey: false,
  async getRoute({ from, to, mode }) {
    if (mode === 'transit') {
      throw new Error('OSRM demo does not support transit');
    }
    const profile = mode === 'walk' ? 'foot' : 'driving';
    const [fromLon, fromLat] = from;
    const [toLon, toLat] = to;
    const url = new URL(`https://router.project-osrm.org/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}`);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'polyline6');
    const response = await queuedJson<OsrmRouteResponse>(OSRM_QUEUE, url.toString(), {
      headers: { Accept: 'application/json' },
      maxRetries: 2,
    });
    const route = response.routes?.[0];
    if (!route || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
      throw new Error(response.message || 'No OSRM route found');
    }
    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry ? { type: 'polyline6', value: route.geometry } : undefined,
      provider: 'osrm_demo',
      fetchedAt: Date.now(),
    };
  },
};

type ValhallaResponse = {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: Array<{ shape?: string }>;
  };
  error?: string;
};

const valhallaDemoProvider: RoutingProvider = {
  id: 'valhalla_demo',
  label: 'Valhalla Demo',
  supports: ['walk', 'drive', 'transit'],
  requiresApiKey: false,
  getRoute: getValhallaRoute,
};

// Valhalla wrapper uses a custom fetch path because queuedJson expects (queue, url, options).
async function getValhallaRoute(args: { from: [number, number]; to: [number, number]; mode: TravelMode }) {
  const [fromLon, fromLat] = args.from;
  const [toLon, toLat] = args.to;
  const costing = args.mode === 'walk' ? 'pedestrian' : args.mode === 'drive' ? 'auto' : 'multimodal';
  const body = {
    locations: [
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
    ],
    costing,
    directions_options: { units: 'kilometers' },
  };
  const response = await queuedJson<ValhallaResponse>(VALHALLA_QUEUE, 'https://valhalla1.openstreetmap.de/route', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    maxRetries: 2,
  });
  const lengthKm = response.trip?.summary?.length;
  const duration = response.trip?.summary?.time;
  if (typeof lengthKm !== 'number' || typeof duration !== 'number') {
    throw new Error(response.error || 'No Valhalla route found');
  }
  const shape = response.trip?.legs?.[0]?.shape;
  return {
    distanceMeters: lengthKm * 1000,
    durationSeconds: duration,
    geometry: shape ? ({ type: 'polyline6', value: shape } as const) : undefined,
    provider: 'valhalla_demo',
    fetchedAt: Date.now(),
  } satisfies RouteResult;
}

type OrsGeoJsonResponse = {
  features?: Array<{
    geometry?: GeoJsonLineString | GeoJsonMultiLineString;
    properties?: { summary?: { distance?: number; duration?: number } };
  }>;
};

const openrouteserviceProvider: RoutingProvider = {
  id: 'openrouteservice',
  label: 'openrouteservice',
  supports: ['walk', 'drive'],
  requiresApiKey: true,
  async getRoute({ from, to, mode, apiKey }) {
    if (!apiKey?.trim()) {
      throw new Error('openrouteservice API key required');
    }
    if (mode === 'transit') {
      throw new Error('openrouteservice transit not configured');
    }
    const profile = mode === 'walk' ? 'foot-walking' : 'driving-car';
    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;
    const response = await queuedJson<OrsGeoJsonResponse>(ORS_QUEUE, url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiKey.trim(),
      },
      body: JSON.stringify({
        coordinates: [from, to],
      }),
      maxRetries: 2,
    });
    const feature = response.features?.[0];
    const distance = feature?.properties?.summary?.distance;
    const duration = feature?.properties?.summary?.duration;
    if (typeof distance !== 'number' || typeof duration !== 'number') {
      throw new Error('No openrouteservice route found');
    }
    return {
      distanceMeters: distance,
      durationSeconds: duration,
      geometry: feature.geometry ? { type: 'geojson', value: feature.geometry } : undefined,
      provider: 'openrouteservice',
      fetchedAt: Date.now(),
    };
  },
};

const providers: RoutingProvider[] = [valhallaDemoProvider, osrmDemoProvider, openrouteserviceProvider];

export function getRoutingProviders(): RoutingProvider[] {
  return providers.slice();
}

export function getRoutingProviderById(providerId: RoutingProviderId): RoutingProvider {
  const provider = providers.find((candidate) => candidate.id === providerId);
  if (!provider) {
    throw new Error(`Unknown routing provider: ${providerId}`);
  }
  return provider;
}

export async function getRouteWithCache(args: {
  providerId: RoutingProviderId;
  from: [number, number];
  to: [number, number];
  mode: TravelMode;
  apiKey?: string;
  ttlMs?: number;
  force?: boolean;
}): Promise<RouteResult> {
  const key = buildRouteCacheKey({
    providerId: args.providerId,
    mode: args.mode,
    from: args.from,
    to: args.to,
  });

  if (!args.force) {
    const cached = await getCachedRoute(key);
    if (cached) return cached;
  }

  const provider = getRoutingProviderById(args.providerId);
  if (!provider.supports.includes(args.mode)) {
    throw new Error(`${provider.label} does not support ${args.mode}`);
  }

  const result = await provider.getRoute({
    from: args.from,
    to: args.to,
    mode: args.mode,
    apiKey: args.apiKey,
  });
  await setCachedRoute(key, result, args.ttlMs);
  return result;
}

export interface TravelSegmentComputation {
  route?: RouteResult;
  fallbackDistanceMeters: number;
  fallbackDurationSeconds: number;
  error?: string;
}

export async function computeTravelSegment(args: {
  providerId: RoutingProviderId;
  from: [number, number];
  to: [number, number];
  mode: TravelMode;
  apiKey?: string;
  ttlMs?: number;
  force?: boolean;
}): Promise<TravelSegmentComputation> {
  const fallbackDistanceMeters = haversineDistanceMeters(args.from, args.to);
  const fallbackDurationSeconds = estimateTravelDurationSeconds(fallbackDistanceMeters, args.mode);

  try {
    if (args.mode === 'transit') {
      const provider = getRoutingProviderById(args.providerId);
      if (!provider.supports.includes('transit')) {
        return { fallbackDistanceMeters, fallbackDurationSeconds };
      }
    }
    const route = await getRouteWithCache(args);
    return { route, fallbackDistanceMeters, fallbackDurationSeconds };
  } catch (error) {
    return {
      fallbackDistanceMeters,
      fallbackDurationSeconds,
      error: error instanceof Error ? error.message : 'Routing request failed',
    };
  }
}

export function buildGoogleTransitLink(from: [number, number], to: [number, number]) {
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}&travelmode=transit`;
}

export function buildAppleTransitLink(from: [number, number], to: [number, number]) {
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;
  return `https://maps.apple.com/?saddr=${fromLat},${fromLon}&daddr=${toLat},${toLon}&dirflg=r`;
}

export function decodePolyline6(polyline: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lon = 0;
  const coordinates: [number, number][] = [];
  const factor = 1e6;

  while (index < polyline.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLon = (result & 1) ? ~(result >> 1) : (result >> 1);
    lon += deltaLon;

    coordinates.push([lat / factor, lon / factor]); // [lat, lon]
  }

  return coordinates;
}

export function routeGeometryToLatLngs(route?: RouteResult): [number, number][] {
  if (!route?.geometry) return [];
  if (route.geometry.type === 'polyline6') {
    return decodePolyline6(route.geometry.value);
  }

  const geometry = route.geometry.value;
  if (geometry.type === 'LineString') {
    return geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.flat().map(([lon, lat]) => [lat, lon]);
  }
  return [];
}
