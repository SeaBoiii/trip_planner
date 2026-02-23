import type {
  AppState,
  AppSettings,
  ExchangeRatesState,
  RoutingSettings,
  TravelMode,
  VersionedSchema,
  Money,
} from './types';
import { builtInTemplates } from './templates';
import { DEFAULT_NOMINATIM_ENDPOINT } from './services/geocoding';

const STORAGE_KEY = 'trip_planner_v1';
const CURRENT_VERSION = 4;
const DEFAULT_ROUTE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Migration = (data: unknown) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTravelMode(value: unknown): value is TravelMode {
  return value === 'walk' || value === 'drive' || value === 'transit';
}

function defaultRoutingSettings(): RoutingSettings {
  return {
    providerId: 'valhalla_demo',
    openrouteserviceApiKey: '',
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
  const providerId =
    value.providerId === 'osrm_demo' || value.providerId === 'valhalla_demo' || value.providerId === 'openrouteservice'
      ? value.providerId
      : defaults.providerId;
  return {
    providerId,
    openrouteserviceApiKey:
      typeof value.openrouteserviceApiKey === 'string' ? value.openrouteserviceApiKey : defaults.openrouteserviceApiKey,
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

    const normalizedTrip = {
      ...trip,
      baseCurrency,
      participants,
      defaultTravelMode: isTravelMode(trip.defaultTravelMode) ? trip.defaultTravelMode : 'walk',
      days: Array.isArray(trip.days)
        ? trip.days.map((day) => {
            if (!isRecord(day)) return day;
            const travelPreferences = isRecord(day.travelPreferences)
              ? {
                  modeOverridesBySegmentKey: isRecord(day.travelPreferences.modeOverridesBySegmentKey)
                    ? Object.fromEntries(
                        Object.entries(day.travelPreferences.modeOverridesBySegmentKey).filter(([, mode]) => isTravelMode(mode))
                      )
                    : undefined,
                }
              : undefined;
            return {
              ...day,
              travelPreferences,
              items: Array.isArray(day.items) ? day.items.map((item) => normalizeItemRecord(item, baseCurrency)) : [],
            };
          })
        : [],
    };

    delete (normalizedTrip as Record<string, unknown>).currency;
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
