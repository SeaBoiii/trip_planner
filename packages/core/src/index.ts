// @trip-planner/core — public API

export type {
  AppState,
  Trip,
  Day,
  Item,
  VersionedSchema,
  Template,
  DayTemplate,
  ItemTemplate,
  ThemePreference,
  AppSettings,
  ExchangeRatesState,
  RoutingSettings,
  RoutingProviderId,
  TravelMode,
  TravelSegment,
  Money,
  Location,
  LocationSource,
  OSMRef,
  OSMType,
  LocationOpeningHours,
  Attachment,
  ItemAttachmentRef,
  Participant,
  ItemPayment,
  ItemPaymentSplit,
} from './types';

export {
  createTrip,
  updateTrip,
  deleteTrip,
  duplicateTrip,
  addDay,
  updateDay,
  deleteDay,
  reorderDays,
  addItem,
  updateItem,
  deleteItem,
  moveItem,
  reorderItems,
  saveAsTemplate,
  deleteTemplate,
  createTripFromTemplate,
  updateSettings,
  setTheme,
} from './store';

export {
  loadState,
  saveState,
  exportTrips,
  importTrips,
  defaultState,
  defaultSettings,
  CURRENT_VERSION,
  DEFAULT_ROUTE_CACHE_TTL_MS,
  STORAGE_KEY,
} from './storage';

export { createNewTrip, createNewDay, createNewItem } from './factories';

export { nanoid, deepClone, dayTotal, tripTotal, moneyAmount, formatCurrency, formatMoney, CURRENCIES } from './utils';

export { useTripStore } from './hooks';

export { builtInTemplates } from './templates';

export {
  searchPlaces,
  DEFAULT_NOMINATIM_ENDPOINT,
  type GeocodingSearchResult,
  type SearchPlacesOptions,
} from './services/geocoding';

export {
  fetchOpeningHours,
  DEFAULT_OVERPASS_ENDPOINT,
  type OsmOpeningHoursDetails,
  type FetchOpeningHoursOptions,
} from './services/osmDetails';

export {
  processImageAttachmentFile,
  saveAttachmentRecord,
  getAttachmentRecord,
  getAttachmentThumbBlob,
  getAttachmentFullBlob,
  deleteAttachmentRecord,
  getAllAttachmentRecords,
  getAttachmentRecordsByIds,
  type AttachmentBlobRecord,
} from './services/attachments';

export {
  fetchExchangeRates,
  FRANKFURTER_ENDPOINT,
  convertAmount,
  convertMoney,
  convertMoneyToBase,
  getEffectiveRates,
  canConvertCurrency,
  convertItemCostToBase,
  summarizeDayCostsInBase,
  summarizeTripCostsInBase,
} from './services/exchangeRates';

export {
  GOOGLE_ROUTES_ENDPOINT,
  computeDayTravelSegments,
  computeDayTravelSegmentsWithCache,
  haversineDistanceMeters,
  estimateTravelDurationSeconds,
  clearRoutingCache,
  getCachedDayTravelSegments,
  buildDayTravelCacheKey,
  mapSegmentsByPair,
  buildTravelSegmentPairKey,
  parseGoogleDurationSeconds,
  formatGoogleRoutesError,
  buildGoogleDirectionsLink,
  buildAppleTransitLink,
  type CachedDayTravelSegments,
  type ComputeDayTravelSegmentsParams,
  type GoogleRouteWaypoint,
} from './services/routing';

export {
  computeSplitBalances,
  suggestSettlements,
  type SplitComputationResult,
  type ParticipantBalance,
  type SettlementTransfer,
} from './services/splitwise';
