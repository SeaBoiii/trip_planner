import type { OSMType } from '../types';
import { getGlobalRateLimitedQueue, queuedJson } from './requestQueue';

export const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const OVERPASS_QUEUE = getGlobalRateLimitedQueue('overpass', 1000);
const DETAILS_CACHE_PREFIX = 'trip_planner_osm_details_v1';
const DETAILS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface OverpassElement {
  id?: number;
  type?: string;
  tags?: Record<string, string>;
  center?: { lat?: number; lon?: number };
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

export interface OsmOpeningHoursDetails {
  name?: string;
  opening_hours?: string;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  fetchedAt: number;
}

interface CachedOsmOpeningHoursDetails {
  expiresAt: number;
  data: OsmOpeningHoursDetails;
}

const memoryCache = new Map<string, CachedOsmOpeningHoursDetails>();

function getCacheKey(osmType: OSMType, osmId: number) {
  return `${DETAILS_CACHE_PREFIX}:${osmType}:${osmId}`;
}

function readLocalCache(key: string): CachedOsmOpeningHoursDetails | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOsmOpeningHoursDetails;
    if (!parsed || typeof parsed.expiresAt !== 'number' || !parsed.data) return null;
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(key: string, entry: CachedOsmOpeningHoursDetails) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore quota/cache errors.
  }
}

function normalizeEndpoint(endpoint?: string) {
  const value = (endpoint ?? DEFAULT_OVERPASS_ENDPOINT).trim();
  return value || DEFAULT_OVERPASS_ENDPOINT;
}

function buildOverpassQuery(osmType: OSMType, osmId: number) {
  return `[out:json][timeout:20];\n${osmType}(${osmId});\nout tags center;`;
}

function normalizeResult(response: OverpassResponse): Omit<OsmOpeningHoursDetails, 'fetchedAt'> {
  const element = response.elements?.[0];
  const tags = element?.tags ?? {};
  return {
    name: tags.name,
    opening_hours: tags.opening_hours,
    tags,
    lat: element?.center?.lat,
    lon: element?.center?.lon,
  };
}

export interface FetchOpeningHoursOptions {
  endpoint?: string;
  signal?: AbortSignal;
  force?: boolean;
}

export async function fetchOpeningHours(
  osmType: OSMType,
  osmId: number,
  options: FetchOpeningHoursOptions = {}
): Promise<OsmOpeningHoursDetails> {
  const cacheKey = getCacheKey(osmType, osmId);
  const now = Date.now();

  if (!options.force) {
    const memoryEntry = memoryCache.get(cacheKey);
    if (memoryEntry && memoryEntry.expiresAt > now) {
      return memoryEntry.data;
    }

    const localEntry = readLocalCache(cacheKey);
    if (localEntry) {
      memoryCache.set(cacheKey, localEntry);
      return localEntry.data;
    }
  }

  const endpoint = normalizeEndpoint(options.endpoint);
  const response = await queuedJson<OverpassResponse>(OVERPASS_QUEUE, endpoint, {
    method: 'POST',
    body: buildOverpassQuery(osmType, osmId),
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'text/plain;charset=UTF-8',
    },
  });

  const data: OsmOpeningHoursDetails = {
    ...normalizeResult(response),
    fetchedAt: now,
  };
  const cacheEntry: CachedOsmOpeningHoursDetails = {
    expiresAt: now + DETAILS_CACHE_TTL_MS,
    data,
  };
  memoryCache.set(cacheKey, cacheEntry);
  writeLocalCache(cacheKey, cacheEntry);
  return data;
}
