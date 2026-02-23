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

export interface AppState {
  trips: Trip[];
  activeTripId: string | null;
}

export interface VersionedSchema {
  version: number;
  data: AppState;
}
