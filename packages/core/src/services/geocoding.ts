import type { OSMType } from '../types';
import { getGlobalRateLimitedQueue, queuedJson } from './requestQueue';

export const DEFAULT_NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org';
const NOMINATIM_QUEUE = getGlobalRateLimitedQueue('nominatim', 1000);
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

export interface GeocodingSearchResult {
  displayName: string;
  lat: number;
  lon: number;
  address?: Record<string, string>;
  osmType: OSMType;
  osmId: number;
}

interface NominatimSearchResponseRow {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
  osm_type?: string;
  osm_id?: number | string;
}

const searchCache = new Map<string, { expiresAt: number; data: GeocodingSearchResult[] }>();

function normalizeEndpoint(endpoint?: string) {
  const value = (endpoint ?? DEFAULT_NOMINATIM_ENDPOINT).trim();
  return value.replace(/\/+$/, '');
}

function normalizeOsmType(value: unknown): OSMType | null {
  if (value === 'node' || value === 'way' || value === 'relation') return value;
  if (value === 'N') return 'node';
  if (value === 'W') return 'way';
  if (value === 'R') return 'relation';
  return null;
}

function normalizeResults(rows: NominatimSearchResponseRow[]): GeocodingSearchResult[] {
  const results: GeocodingSearchResult[] = [];
  for (const row of rows) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    const osmId = Number(row.osm_id);
    const osmType = normalizeOsmType(row.osm_type);
    if (!row.display_name || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(osmId) || !osmType) {
      continue;
    }
    results.push({
      displayName: row.display_name,
      lat,
      lon,
      address: row.address,
      osmType,
      osmId,
    });
  }
  return results;
}

export interface SearchPlacesOptions {
  endpoint?: string;
  signal?: AbortSignal;
  limit?: number;
}

export async function searchPlaces(query: string, options: SearchPlacesOptions = {}): Promise<GeocodingSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${normalizeEndpoint(options.endpoint)}::${trimmed.toLowerCase()}::${options.limit ?? 5}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const endpoint = normalizeEndpoint(options.endpoint);
  const url = new URL(`${endpoint}/search`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(options.limit ?? 5));

  const rows = await queuedJson<NominatimSearchResponseRow[]>(NOMINATIM_QUEUE, url.toString(), {
    signal: options.signal,
    headers: {
      Accept: 'application/json',
    },
  });

  const normalized = normalizeResults(rows);
  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    data: normalized,
  });
  return normalized;
}
