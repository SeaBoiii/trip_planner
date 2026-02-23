import type { VersionedSchema, AppState, AppSettings, Template } from './types';
import { builtInTemplates } from './templates';

const STORAGE_KEY = 'trip_planner_v1';
const CURRENT_VERSION = 2;

// ── Default settings ──

export function defaultSettings(): AppSettings {
  return { theme: 'system' };
}

// ── Migrations ──
// Each migration transforms from version N to N+1
type Migration = (data: unknown) => unknown;

const migrations: Record<number, Migration> = {
  // v1 → v2: add templates[] and settings to AppState
  1: (data: unknown) => {
    const d = data as { trips: unknown[]; activeTripId: string | null };
    return {
      ...d,
      templates: builtInTemplates(),
      settings: defaultSettings(),
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
    version++;
  }
  return data as AppState;
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
    const parsed: VersionedSchema = JSON.parse(raw);
    if (!parsed || typeof parsed.version !== 'number') return defaultState();
    if (parsed.version === CURRENT_VERSION) return parsed.data;
    return applyMigrations(parsed);
  } catch (e) {
    console.error('Failed to load state:', e);
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  const versioned: VersionedSchema = {
    version: CURRENT_VERSION,
    data: state,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versioned));
}

export function exportTrips(state: AppState, tripIds?: string[]): string {
  const trips = tripIds
    ? state.trips.filter((t) => tripIds.includes(t.id))
    : state.trips;
  const payload: VersionedSchema = {
    version: CURRENT_VERSION,
    data: { ...state, trips },
  };
  return JSON.stringify(payload, null, 2);
}

export function importTrips(json: string): AppState {
  const parsed: VersionedSchema = JSON.parse(json);
  if (!parsed || typeof parsed.version !== 'number' || !parsed.data) {
    throw new Error('Invalid trip data format');
  }
  if (parsed.version === CURRENT_VERSION) return parsed.data;
  return applyMigrations(parsed);
}

export { CURRENT_VERSION, STORAGE_KEY };
