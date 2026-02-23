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

export interface Item {
  id: string;
  title: string;
  time?: string;
  locationText?: string;
  location?: Location;
  notes?: string;
  cost?: number;
  tags: string[];
  link?: string;
}

export interface Day {
  id: string;
  label: string;
  date?: string;
  items: Item[];
}

export interface Trip {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  coverPhoto?: string;
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
  cost?: number;
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
  currency: string;
  days: DayTemplate[];
  createdAt: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePreference;
  geocodingProviderEndpoint: string;
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
