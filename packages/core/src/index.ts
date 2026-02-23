// @trip-planner/core — public API

export type { AppState, Trip, Day, Item, VersionedSchema, Template, DayTemplate, ItemTemplate, ThemePreference, AppSettings } from './types';

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
  STORAGE_KEY,
} from './storage';

export { createNewTrip, createNewDay, createNewItem } from './factories';

export { nanoid, deepClone, dayTotal, tripTotal, formatCurrency, CURRENCIES } from './utils';

export { useTripStore } from './hooks';

export { builtInTemplates } from './templates';
