// ── Core Types ──

export interface Item {
  id: string;
  title: string;
  time?: string;
  location?: string;
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
  coverPhoto?: string; // data URL for cards variant
  days: Day[];
  createdAt: string;
  updatedAt: string;
}

// ── Template Types ──

export interface ItemTemplate {
  title: string;
  time?: string;
  location?: string;
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

// ── Settings Types ──

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePreference;
}

// ── App State ──

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
