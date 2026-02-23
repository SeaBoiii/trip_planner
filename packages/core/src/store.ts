import { deepClone, nanoid } from './utils';
import { createNewTrip, createNewDay, createNewItem } from './factories';
import type { AppState, Trip, Day, Item, Template, ThemePreference, AppSettings } from './types';

// ── Trip Operations ──

export function createTrip(state: AppState, name: string, currency = 'SGD'): AppState {
  const trip = createNewTrip(name, currency);
  return {
    ...state,
    trips: [...state.trips, trip],
    activeTripId: trip.id,
  };
}

export function updateTrip(state: AppState, tripId: string, updates: Partial<Pick<Trip, 'name' | 'startDate' | 'endDate' | 'currency' | 'coverPhoto'>>): AppState {
  return {
    ...state,
    trips: state.trips.map((t) =>
      t.id === tripId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ),
  };
}

export function deleteTrip(state: AppState, tripId: string): AppState {
  const trips = state.trips.filter((t) => t.id !== tripId);
  return {
    ...state,
    trips,
    activeTripId: state.activeTripId === tripId ? (trips[0]?.id ?? null) : state.activeTripId,
  };
}

export function duplicateTrip(state: AppState, tripId: string): AppState {
  const original = state.trips.find((t) => t.id === tripId);
  if (!original) return state;
  const cloned = deepClone(original);
  const now = new Date().toISOString();
  // Assign new IDs
  cloned.id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  cloned.name = `${original.name} (copy)`;
  cloned.createdAt = now;
  cloned.updatedAt = now;
  cloned.days.forEach((day) => {
    day.id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    day.items.forEach((item) => {
      item.id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    });
  });
  return {
    ...state,
    trips: [...state.trips, cloned],
  };
}

// ── Day Operations ──

export function addDay(state: AppState, tripId: string, label: string, date?: string): AppState {
  return mapTrip(state, tripId, (trip) => ({
    ...trip,
    days: [...trip.days, createNewDay(label, date)],
    updatedAt: new Date().toISOString(),
  }));
}

export function updateDay(state: AppState, tripId: string, dayId: string, updates: Partial<Pick<Day, 'label' | 'date'>>): AppState {
  return mapTrip(state, tripId, (trip) => ({
    ...trip,
    days: trip.days.map((d) => (d.id === dayId ? { ...d, ...updates } : d)),
    updatedAt: new Date().toISOString(),
  }));
}

export function deleteDay(state: AppState, tripId: string, dayId: string): AppState {
  return mapTrip(state, tripId, (trip) => ({
    ...trip,
    days: trip.days.filter((d) => d.id !== dayId),
    updatedAt: new Date().toISOString(),
  }));
}

export function reorderDays(state: AppState, tripId: string, dayIds: string[]): AppState {
  return mapTrip(state, tripId, (trip) => {
    const dayMap = new Map(trip.days.map((d) => [d.id, d]));
    const reordered = dayIds.map((id) => dayMap.get(id)).filter(Boolean) as Day[];
    return { ...trip, days: reordered, updatedAt: new Date().toISOString() };
  });
}

// ── Item Operations ──

export function addItem(
  state: AppState,
  tripId: string,
  dayId: string,
  title: string,
  partial?: Partial<Omit<Item, 'id' | 'title'>>
): AppState {
  const item = createNewItem(title, partial);
  return mapDay(state, tripId, dayId, (day) => ({
    ...day,
    items: [...day.items, item],
  }));
}

export function updateItem(
  state: AppState,
  tripId: string,
  dayId: string,
  itemId: string,
  updates: Partial<Omit<Item, 'id'>>
): AppState {
  return mapDay(state, tripId, dayId, (day) => ({
    ...day,
    items: day.items.map((it) => (it.id === itemId ? { ...it, ...updates } : it)),
  }));
}

export function deleteItem(
  state: AppState,
  tripId: string,
  dayId: string,
  itemId: string
): AppState {
  return mapDay(state, tripId, dayId, (day) => ({
    ...day,
    items: day.items.filter((it) => it.id !== itemId),
  }));
}

export function moveItem(
  state: AppState,
  tripId: string,
  dayIdFrom: string,
  dayIdTo: string,
  itemId: string,
  newIndex: number
): AppState {
  return mapTrip(state, tripId, (trip) => {
    const days = deepClone(trip.days);
    const fromDay = days.find((d) => d.id === dayIdFrom);
    const toDay = days.find((d) => d.id === dayIdTo);
    if (!fromDay || !toDay) return trip;

    const itemIndex = fromDay.items.findIndex((it) => it.id === itemId);
    if (itemIndex === -1) return trip;

    const [item] = fromDay.items.splice(itemIndex, 1);
    toDay.items.splice(newIndex, 0, item);

    return { ...trip, days, updatedAt: new Date().toISOString() };
  });
}

export function reorderItems(state: AppState, tripId: string, dayId: string, itemIds: string[]): AppState {
  return mapDay(state, tripId, dayId, (day) => {
    const itemMap = new Map(day.items.map((it) => [it.id, it]));
    const reordered = itemIds.map((id) => itemMap.get(id)).filter(Boolean) as Item[];
    return { ...day, items: reordered };
  });
}

// ── Template Operations ──

export function saveAsTemplate(state: AppState, tripId: string, templateName: string, description: string): AppState {
  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) return state;
  const template: Template = {
    id: nanoid(),
    name: templateName,
    description,
    builtIn: false,
    currency: trip.currency,
    days: trip.days.map((d) => ({
      label: d.label,
      items: d.items.map(({ title, time, locationText, location, notes, cost, tags, link }) => ({
        title, time, locationText, location, notes, cost, tags, link,
      })),
    })),
    createdAt: new Date().toISOString(),
  };
  return { ...state, templates: [...state.templates, template] };
}

export function deleteTemplate(state: AppState, templateId: string): AppState {
  return { ...state, templates: state.templates.filter((t) => t.id !== templateId || t.builtIn) };
}

export function createTripFromTemplate(state: AppState, template: Template, tripName: string): AppState {
  const trip = createNewTrip(tripName, template.currency);
  trip.days = template.days.map((dt) => {
    const day = createNewDay(dt.label);
    day.items = dt.items.map((it) => createNewItem(it.title, {
      time: it.time,
      locationText: it.locationText,
      location: it.location,
      notes: it.notes,
      cost: it.cost,
      tags: it.tags ?? [],
      link: it.link,
    }));
    return day;
  });
  return {
    ...state,
    trips: [...state.trips, trip],
    activeTripId: trip.id,
  };
}

// ── Settings Operations ──

export function updateSettings(state: AppState, updates: Partial<AppSettings>): AppState {
  return { ...state, settings: { ...state.settings, ...updates } };
}

export function setTheme(state: AppState, theme: ThemePreference): AppState {
  return updateSettings(state, { theme });
}

// ── Helpers ──

function mapTrip(state: AppState, tripId: string, fn: (trip: Trip) => Trip): AppState {
  return {
    ...state,
    trips: state.trips.map((t) => (t.id === tripId ? fn(t) : t)),
  };
}

function mapDay(state: AppState, tripId: string, dayId: string, fn: (day: Day) => Day): AppState {
  return mapTrip(state, tripId, (trip) => ({
    ...trip,
    days: trip.days.map((d) => (d.id === dayId ? fn(d) : d)),
    updatedAt: new Date().toISOString(),
  }));
}
