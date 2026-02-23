import type { AppState, AppSettings, VersionedSchema } from './types';
import { builtInTemplates } from './templates';
import { DEFAULT_NOMINATIM_ENDPOINT } from './services/geocoding';

const STORAGE_KEY = 'trip_planner_v1';
const CURRENT_VERSION = 3;

type Migration = (data: unknown) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function defaultSettings(): AppSettings {
  return {
    theme: 'system',
    geocodingProviderEndpoint: DEFAULT_NOMINATIM_ENDPOINT,
  };
}

function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return defaultSettings();
  const defaults = defaultSettings();
  return {
    theme:
      value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
        ? value.theme
        : defaults.theme,
    geocodingProviderEndpoint:
      typeof value.geocodingProviderEndpoint === 'string' && value.geocodingProviderEndpoint.trim()
        ? value.geocodingProviderEndpoint
        : defaults.geocodingProviderEndpoint,
  };
}

function migrateLegacyItemLocation(item: unknown): unknown {
  if (!isRecord(item)) return item;
  const next = { ...item };
  if (typeof next.location === 'string') {
    const legacy = next.location.trim();
    delete next.location;
    if (legacy && (!('locationText' in next) || typeof next.locationText !== 'string' || !next.locationText.trim())) {
      next.locationText = legacy;
    }
  }
  return next;
}

function normalizeTripCollection(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  return value.map((trip) => {
    if (!isRecord(trip)) return trip;
    return {
      ...trip,
      days: Array.isArray(trip.days)
        ? trip.days.map((day) => {
            if (!isRecord(day)) return day;
            return {
              ...day,
              items: Array.isArray(day.items) ? day.items.map(migrateLegacyItemLocation) : [],
            };
          })
        : [],
    };
  });
}

function normalizeTemplateCollection(value: unknown): unknown {
  if (!Array.isArray(value)) return builtInTemplates();
  return value.map((template) => {
    if (!isRecord(template)) return template;
    return {
      ...template,
      days: Array.isArray(template.days)
        ? template.days.map((day) => {
            if (!isRecord(day)) return day;
            return {
              ...day,
              items: Array.isArray(day.items) ? day.items.map(migrateLegacyItemLocation) : [],
            };
          })
        : [],
    };
  });
}

function normalizeAppState(value: unknown): AppState {
  if (!isRecord(value)) return defaultState();
  return {
    trips: normalizeTripCollection(value.trips) as AppState['trips'],
    activeTripId: typeof value.activeTripId === 'string' || value.activeTripId === null ? value.activeTripId : null,
    templates: normalizeTemplateCollection(value.templates) as AppState['templates'],
    settings: normalizeSettings(value.settings),
  };
}

const migrations: Record<number, Migration> = {
  1: (data: unknown) => {
    const d = isRecord(data) ? data : {};
    return {
      ...d,
      templates: builtInTemplates(),
      settings: defaultSettings(),
    };
  },
  2: (data: unknown) => {
    if (!isRecord(data)) return data;
    return {
      ...data,
      trips: normalizeTripCollection(data.trips),
      templates: normalizeTemplateCollection(data.templates),
      settings: normalizeSettings(data.settings),
    };
  },
};

function applyMigrations(stored: { version: number; data: unknown }): AppState {
  let { version, data } = stored;
  while (version < CURRENT_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      console.warn(`No migration for version ${version}, resetting state`);
      return defaultState();
    }
    data = migrate(data);
    version += 1;
  }
  return normalizeAppState(data);
}

export function defaultState(): AppState {
  return {
    trips: [],
    activeTripId: null,
    templates: builtInTemplates(),
    settings: defaultSettings(),
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as VersionedSchema;
    if (!parsed || typeof parsed.version !== 'number') return defaultState();
    if (parsed.version === CURRENT_VERSION) return normalizeAppState(parsed.data);
    return applyMigrations(parsed);
  } catch (error) {
    console.error('Failed to load state:', error);
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  const versioned: VersionedSchema = {
    version: CURRENT_VERSION,
    data: normalizeAppState(state),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versioned));
}

export function exportTrips(state: AppState, tripIds?: string[]): string {
  const trips = tripIds ? state.trips.filter((trip) => tripIds.includes(trip.id)) : state.trips;
  const payload: VersionedSchema = {
    version: CURRENT_VERSION,
    data: normalizeAppState({ ...state, trips }),
  };
  return JSON.stringify(payload, null, 2);
}

export function importTrips(json: string): AppState {
  const parsed = JSON.parse(json) as VersionedSchema;
  if (!parsed || typeof parsed.version !== 'number' || !parsed.data) {
    throw new Error('Invalid trip data format');
  }
  if (parsed.version === CURRENT_VERSION) return normalizeAppState(parsed.data);
  return applyMigrations(parsed);
}

export { CURRENT_VERSION, STORAGE_KEY };
