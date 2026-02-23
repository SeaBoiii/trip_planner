import type {
  AppState,
  AppSettings,
  ExchangeRatesState,
  RoutingSettings,
  TravelMode,
  TravelDefaults,
  TravelOverride,
  VersionedSchema,
  Money,
} from './types';
import { builtInTemplates } from './templates';
import { DEFAULT_NOMINATIM_ENDPOINT } from './services/geocoding';

const STORAGE_KEY = 'trip_planner_v1';
const CURRENT_VERSION = 6;
const DEFAULT_ROUTE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Migration = (data: unknown) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTravelMode(value: unknown): value is TravelMode {
  return value === 'WALK' || value === 'DRIVE' || value === 'TRANSIT';
}

function normalizeTravelMode(value: unknown, fallback: TravelMode = 'WALK'): TravelMode {
  if (value === 'WALK' || value === 'DRIVE' || value === 'TRANSIT') return value;
  if (value === 'walk') return 'WALK';
  if (value === 'drive') return 'DRIVE';
  if (value === 'transit') return 'TRANSIT';
  return fallback;
}

function normalizeTravelDefaults(value: unknown, fallback: TravelDefaults = { mode: 'WALK', trafficAware: false }): TravelDefaults {
  if (!isRecord(value)) return { ...fallback };
  const mode = normalizeTravelMode(value.mode, fallback.mode);
  const trafficAware =
    typeof value.trafficAware === 'boolean'
      ? value.trafficAware
      : typeof fallback.trafficAware === 'boolean'
      ? fallback.trafficAware
      : false;
  return {
    mode,
    trafficAware: mode === 'DRIVE' ? trafficAware : false,
  };
}

function normalizeTravelOverridesRecord(value: unknown): Record<string, TravelOverride> | undefined {
  if (!isRecord(value)) return undefined;
  const overrides: Record<string, TravelOverride> = {};
  for (const [edgeKey, rawOverride] of Object.entries(value)) {
    if (typeof edgeKey !== 'string' || !edgeKey.includes('->')) continue;
    if (isRecord(rawOverride)) {
      const mode = normalizeTravelMode(rawOverride.mode, 'WALK');
      const trafficAware = typeof rawOverride.trafficAware === 'boolean' ? rawOverride.trafficAware : undefined;
      overrides[edgeKey] = {
        mode,
        trafficAware: mode === 'DRIVE' ? trafficAware : false,
      };
      continue;
    }
    // Legacy payloads may store mode string directly.
    overrides[edgeKey] = {
      mode: normalizeTravelMode(rawOverride, 'WALK'),
      trafficAware: false,
    };
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function collectAdjacentLocatedEdgeKeys(items: unknown[]): Set<string> {
  const keys = new Set<string>();
  for (let index = 0; index < items.length - 1; index += 1) {
    const from = items[index];
    const to = items[index + 1];
    if (!isRecord(from) || !isRecord(to)) continue;
    if (typeof from.id !== 'string' || typeof to.id !== 'string') continue;
    if (!isRecord(from.location) || !isRecord(to.location)) continue;
    keys.add(`${from.id}->${to.id}`);
  }
  return keys;
}

function pruneInvalidTravelOverrides(items: unknown[], overrides: Record<string, TravelOverride> | undefined) {
  if (!overrides) return undefined;
  const validEdges = collectAdjacentLocatedEdgeKeys(items);
  const prunedEntries = Object.entries(overrides).filter(([edgeKey]) => validEdges.has(edgeKey));
  if (prunedEntries.length === 0) return undefined;
  return Object.fromEntries(prunedEntries) as Record<string, TravelOverride>;
}

function defaultRoutingSettings(): RoutingSettings {
  return {
    providerId: 'google_routes',
    googleApiKey: '',
    computeTravelLazily: true,
    showRoutesOnMapByDefault: false,
    routeCacheTtlMs: DEFAULT_ROUTE_CACHE_TTL_MS,
  };
}

function defaultExchangeRates(): ExchangeRatesState {
  return {
    provider: 'frankfurter',
    base: 'USD',
    rates: {},
    manualOverrides: {},
    useManualRatesOnly: false,
  };
}

export function defaultSettings(): AppSettings {
  return {
    theme: 'system',
    geocodingProviderEndpoint: DEFAULT_NOMINATIM_ENDPOINT,
    routing: defaultRoutingSettings(),
    exchangeRates: defaultExchangeRates(),
  };
}

function normalizeRoutingSettings(value: unknown): RoutingSettings {
  const defaults = defaultRoutingSettings();
  if (!isRecord(value)) return defaults;
  return {
    providerId: 'google_routes',
    googleApiKey:
      typeof value.googleApiKey === 'string'
        ? value.googleApiKey
        : defaults.googleApiKey,
    computeTravelLazily:
      typeof value.computeTravelLazily === 'boolean' ? value.computeTravelLazily : defaults.computeTravelLazily,
    showRoutesOnMapByDefault:
      typeof value.showRoutesOnMapByDefault === 'boolean'
        ? value.showRoutesOnMapByDefault
        : defaults.showRoutesOnMapByDefault,
    routeCacheTtlMs:
      typeof value.routeCacheTtlMs === 'number' && Number.isFinite(value.routeCacheTtlMs) && value.routeCacheTtlMs > 0
        ? value.routeCacheTtlMs
        : defaults.routeCacheTtlMs,
  };
}

function normalizeExchangeRates(value: unknown): ExchangeRatesState {
  const defaults = defaultExchangeRates();
  if (!isRecord(value)) return defaults;

  const rates: Record<string, number> = {};
  if (isRecord(value.rates)) {
    for (const [code, amount] of Object.entries(value.rates)) {
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        rates[code.toUpperCase()] = amount;
      }
    }
  }

  const manualOverrides: Record<string, number> = {};
  if (isRecord(value.manualOverrides)) {
    for (const [code, amount] of Object.entries(value.manualOverrides)) {
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        manualOverrides[code.toUpperCase()] = amount;
      }
    }
  }

  return {
    provider: 'frankfurter',
    base: typeof value.base === 'string' && value.base.trim() ? value.base.toUpperCase() : defaults.base,
    rates,
    fetchedAt: typeof value.fetchedAt === 'number' && Number.isFinite(value.fetchedAt) ? value.fetchedAt : undefined,
    manualOverrides,
    useManualRatesOnly: typeof value.useManualRatesOnly === 'boolean' ? value.useManualRatesOnly : defaults.useManualRatesOnly,
  };
}

function normalizeSettings(value: unknown): AppSettings {
  const defaults = defaultSettings();
  if (!isRecord(value)) return defaults;
  return {
    theme:
      value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
        ? value.theme
        : defaults.theme,
    geocodingProviderEndpoint:
      typeof value.geocodingProviderEndpoint === 'string' && value.geocodingProviderEndpoint.trim()
        ? value.geocodingProviderEndpoint
        : defaults.geocodingProviderEndpoint,
    routing: normalizeRoutingSettings(value.routing),
    exchangeRates: normalizeExchangeRates(value.exchangeRates),
  };
}

function normalizeMoney(value: unknown, fallbackCurrency: string): Money | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { amount: value, currency: fallbackCurrency };
  }
  if (!isRecord(value)) return undefined;
  const amount = value.amount;
  const currency = value.currency;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return undefined;
  return {
    amount,
    currency: typeof currency === 'string' && currency.trim() ? currency.toUpperCase() : fallbackCurrency,
  };
}

function normalizeAttachmentRefs(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const refs = value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.id !== 'string') return null;
      return {
        id: entry.id,
        kind: 'image' as const,
        caption: typeof entry.caption === 'string' ? entry.caption : undefined,
      };
    })
    .filter(Boolean);
  return refs.length > 0 ? refs : undefined;
}

function normalizePayment(value: unknown, fallbackCurrency: string) {
  if (!isRecord(value) || typeof value.paidByParticipantId !== 'string' || !isRecord(value.split)) return undefined;
  const split = value.split;
  if (split.type === 'equal') {
    return {
      paidByParticipantId: value.paidByParticipantId,
      split: {
        type: 'equal' as const,
        participantIds: Array.isArray(split.participantIds)
          ? split.participantIds.filter((id): id is string => typeof id === 'string')
          : [],
      },
    };
  }
  if (split.type === 'shares') {
    const shares: Record<string, number> = {};
    if (isRecord(split.shares)) {
      for (const [id, share] of Object.entries(split.shares)) {
        if (typeof share === 'number' && Number.isFinite(share) && share >= 0) {
          shares[id] = share;
        }
      }
    }
    return {
      paidByParticipantId: value.paidByParticipantId,
      split: { type: 'shares' as const, shares },
    };
  }
  if (split.type === 'exact') {
    const amounts: Record<string, Money> = {};
    if (isRecord(split.amounts)) {
      for (const [id, rawMoney] of Object.entries(split.amounts)) {
        const money = normalizeMoney(rawMoney, fallbackCurrency);
        if (money) amounts[id] = money;
      }
    }
    return {
      paidByParticipantId: value.paidByParticipantId,
      split: { type: 'exact' as const, amounts },
    };
  }
  return undefined;
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

function normalizeItemRecord(item: unknown, fallbackCurrency: string) {
  if (!isRecord(item)) return item;
  const withLocation = migrateLegacyItemLocation(item);
  if (!isRecord(withLocation)) return withLocation;
  const normalizedCost = normalizeMoney(withLocation.cost, fallbackCurrency);
  return {
    ...withLocation,
    cost: normalizedCost,
    attachments: normalizeAttachmentRefs(withLocation.attachments),
    payment: normalizePayment(withLocation.payment, normalizedCost?.currency ?? fallbackCurrency),
    tags: Array.isArray(withLocation.tags)
      ? withLocation.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
  };
}

function normalizeTripCollection(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  return value.map((trip) => {
    if (!isRecord(trip)) return trip;
    const baseCurrencyCandidate =
      typeof trip.baseCurrency === 'string' && trip.baseCurrency.trim()
        ? trip.baseCurrency
        : typeof trip.currency === 'string' && trip.currency.trim()
        ? trip.currency
        : 'USD';
    const baseCurrency = baseCurrencyCandidate.toUpperCase();

    const participants = Array.isArray(trip.participants)
      ? trip.participants
          .map((participant) => {
            if (!isRecord(participant) || typeof participant.id !== 'string' || typeof participant.name !== 'string') {
              return null;
            }
            return { id: participant.id, name: participant.name };
          })
          .filter(Boolean)
      : [];

    const legacyTripDefaultMode = normalizeTravelMode(trip.defaultTravelMode, 'WALK');
    const travelDefaults = normalizeTravelDefaults(trip.travelDefaults, {
      mode: legacyTripDefaultMode,
      trafficAware: false,
    });

    const normalizedTrip = {
      ...trip,
      baseCurrency,
      participants,
      travelDefaults,
      days: Array.isArray(trip.days)
        ? trip.days.map((day) => {
            if (!isRecord(day)) return day;
            const items = Array.isArray(day.items) ? day.items.map((item) => normalizeItemRecord(item, baseCurrency)) : [];
            const dayTravelDefaults = isRecord(day.travelDefaults)
              ? normalizeTravelDefaults(day.travelDefaults, travelDefaults)
              : undefined;
            const legacyOverrides =
              isRecord(day.travelPreferences) && isRecord(day.travelPreferences.modeOverridesBySegmentKey)
                ? normalizeTravelOverridesRecord(day.travelPreferences.modeOverridesBySegmentKey)
                : undefined;
            const explicitOverrides = normalizeTravelOverridesRecord(day.travelOverrides);
            const mergedOverrides = explicitOverrides ?? legacyOverrides;
            return {
              ...day,
              items,
              travelDefaults: dayTravelDefaults,
              travelOverrides: pruneInvalidTravelOverrides(items, mergedOverrides),
            };
          })
        : [],
    };

    delete (normalizedTrip as Record<string, unknown>).currency;
    delete (normalizedTrip as Record<string, unknown>).defaultTravelMode;
    for (const day of Array.isArray(normalizedTrip.days) ? normalizedTrip.days : []) {
      if (isRecord(day)) {
        delete day.travelPreferences;
      }
    }
    return normalizedTrip;
  });
}

function normalizeTemplateCollection(value: unknown): unknown {
  if (!Array.isArray(value)) return builtInTemplates();
  return value.map((template) => {
    if (!isRecord(template)) return template;
    const baseCurrencyCandidate =
      typeof template.baseCurrency === 'string' && template.baseCurrency.trim()
        ? template.baseCurrency
        : typeof template.currency === 'string' && template.currency.trim()
        ? template.currency
        : 'USD';
    const baseCurrency = baseCurrencyCandidate.toUpperCase();
    const normalizedTemplate = {
      ...template,
      baseCurrency,
      days: Array.isArray(template.days)
        ? template.days.map((day) => {
            if (!isRecord(day)) return day;
            return {
              ...day,
              items: Array.isArray(day.items) ? day.items.map((item) => normalizeItemRecord(item, baseCurrency)) : [],
            };
          })
        : [],
    };
    delete (normalizedTemplate as Record<string, unknown>).currency;
    return normalizedTemplate;
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
  3: (data: unknown) => {
    if (!isRecord(data)) return data;
    return {
      ...data,
      trips: normalizeTripCollection(data.trips),
      templates: normalizeTemplateCollection(data.templates),
      settings: normalizeSettings(data.settings),
    };
  },
  4: (data: unknown) => {
    if (!isRecord(data)) return data;
    return {
      ...data,
      trips: normalizeTripCollection(data.trips),
      templates: normalizeTemplateCollection(data.templates),
      settings: normalizeSettings(data.settings),
    };
  },
  5: (data: unknown) => {
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

export { CURRENT_VERSION, DEFAULT_ROUTE_CACHE_TTL_MS, STORAGE_KEY };
