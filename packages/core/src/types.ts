export type LocationSource = 'nominatim_osm';

export type OSMType = 'node' | 'way' | 'relation';

export interface OSMRef {
  osmType: OSMType;
  osmId: number;
}

export interface LocationOpeningHours {
  raw?: string;
  timezoneHint?: string;
  fetchedAt?: number;
}

export interface Location {
  source: LocationSource;
  displayName: string;
  lat: number;
  lon: number;
  address?: Record<string, string>;
  osm?: OSMRef;
  lastFetchedAt?: number;
  openingHours?: LocationOpeningHours;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface Attachment {
  id: string;
  kind: 'image';
  mime: string;
  width: number;
  height: number;
  createdAt: number;
  sizeBytes: number;
}

export interface ItemAttachmentRef {
  id: string;
  kind: 'image';
  caption?: string;
}

export interface Participant {
  id: string;
  name: string;
}

export type TravelMode = 'WALK' | 'DRIVE' | 'TRANSIT';
export type RoutingProviderId = 'google_routes';

export interface TravelSegment {
  fromItemId: string;
  toItemId: string;
  mode: TravelMode;
  provider: 'google_routes';
  distanceMeters: number;
  durationSeconds: number;
  coords?: Array<[number, number]>; // [lat, lon]
  fetchedAt: number;
}

export interface DayTravelPreferences {
  modeOverridesBySegmentKey?: Record<string, TravelMode>;
}

export type PaymentSplitEqual = {
  type: 'equal';
  participantIds: string[];
};

export type PaymentSplitShares = {
  type: 'shares';
  shares: Record<string, number>;
};

export type PaymentSplitExact = {
  type: 'exact';
  amounts: Record<string, Money>;
};

export type ItemPaymentSplit = PaymentSplitEqual | PaymentSplitShares | PaymentSplitExact;

export interface ItemPayment {
  paidByParticipantId: string;
  split: ItemPaymentSplit;
}

export interface Item {
  id: string;
  title: string;
  time?: string;
  locationText?: string;
  location?: Location;
  notes?: string;
  cost?: Money;
  attachments?: ItemAttachmentRef[];
  payment?: ItemPayment;
  tags: string[];
  link?: string;
}

export interface Day {
  id: string;
  label: string;
  date?: string;
  travelPreferences?: DayTravelPreferences;
  items: Item[];
}

export interface Trip {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  baseCurrency: string;
  coverPhoto?: string;
  participants: Participant[];
  defaultTravelMode?: TravelMode;
  days: Day[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemTemplate {
  title: string;
  time?: string;
  locationText?: string;
  location?: Location;
  notes?: string;
  cost?: Money;
  attachments?: ItemAttachmentRef[];
  payment?: ItemPayment;
  tags: string[];
  link?: string;
}

export interface DayTemplate {
  label: string;
  items: ItemTemplate[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  builtIn: boolean;
  baseCurrency: string;
  days: DayTemplate[];
  createdAt: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface ExchangeRatesState {
  provider: 'frankfurter';
  base: string;
  rates: Record<string, number>;
  fetchedAt?: number;
  manualOverrides?: Record<string, number>;
  useManualRatesOnly?: boolean;
}

export interface RoutingSettings {
  providerId: RoutingProviderId;
  googleApiKey?: string;
  trafficAwareDriveRoutes: boolean;
  computeTravelLazily: boolean;
  showRoutesOnMapByDefault: boolean;
  routeCacheTtlMs: number;
}

export interface AppSettings {
  theme: ThemePreference;
  geocodingProviderEndpoint: string;
  routing: RoutingSettings;
  exchangeRates: ExchangeRatesState;
}

export interface AppState {
  trips: Trip[];
  activeTripId: string | null;
  templates: Template[];
  settings: AppSettings;
}

export interface VersionedSchema {
  version: number;
  data: AppState;
}
