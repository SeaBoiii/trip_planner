import React, { createContext, useContext, useCallback, useSyncExternalStore } from 'react';
import type { AppState, Trip, Day, Item, Template, ThemePreference, AppSettings } from './types';
import { loadState, saveState, exportTrips, importTrips } from './storage';
import * as ops from './store';

// ── External store (framework-agnostic core) ──

let currentState: AppState = loadState();
const listeners = new Set<() => void>();

function getState(): AppState {
  return currentState;
}

function setState(next: AppState) {
  currentState = next;
  saveState(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── React hook ──

export function useTripStore() {
  const state = useSyncExternalStore(subscribe, getState, getState);

  const dispatch = useCallback((fn: (s: AppState) => AppState) => {
    setState(fn(getState()));
  }, []);

  // Trip actions
  const createTrip = useCallback((name: string, baseCurrency?: string) => {
    dispatch((s) => ops.createTrip(s, name, baseCurrency));
  }, [dispatch]);

  const updateTrip = useCallback((
    tripId: string,
    updates: Partial<Pick<Trip, 'name' | 'startDate' | 'endDate' | 'baseCurrency' | 'coverPhoto' | 'participants' | 'travelDefaults'>>
  ) => {
    dispatch((s) => ops.updateTrip(s, tripId, updates));
  }, [dispatch]);

  const deleteTrip = useCallback((tripId: string) => {
    dispatch((s) => ops.deleteTrip(s, tripId));
  }, [dispatch]);

  const duplicateTrip = useCallback((tripId: string) => {
    dispatch((s) => ops.duplicateTrip(s, tripId));
  }, [dispatch]);

  const setActiveTrip = useCallback((tripId: string | null) => {
    dispatch((s) => ({ ...s, activeTripId: tripId }));
  }, [dispatch]);

  // Day actions
  const addDay = useCallback((tripId: string, label: string, date?: string) => {
    dispatch((s) => ops.addDay(s, tripId, label, date));
  }, [dispatch]);

  const updateDay = useCallback((tripId: string, dayId: string, updates: Partial<Pick<Day, 'label' | 'date' | 'travelDefaults' | 'travelOverrides'>>) => {
    dispatch((s) => ops.updateDay(s, tripId, dayId, updates));
  }, [dispatch]);

  const deleteDay = useCallback((tripId: string, dayId: string) => {
    dispatch((s) => ops.deleteDay(s, tripId, dayId));
  }, [dispatch]);

  const reorderDays = useCallback((tripId: string, dayIds: string[]) => {
    dispatch((s) => ops.reorderDays(s, tripId, dayIds));
  }, [dispatch]);

  // Item actions
  const addItem = useCallback((tripId: string, dayId: string, title: string, partial?: Partial<Omit<Item, 'id' | 'title'>>) => {
    dispatch((s) => ops.addItem(s, tripId, dayId, title, partial));
  }, [dispatch]);

  const updateItem = useCallback((tripId: string, dayId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => {
    dispatch((s) => ops.updateItem(s, tripId, dayId, itemId, updates));
  }, [dispatch]);

  const deleteItem = useCallback((tripId: string, dayId: string, itemId: string) => {
    dispatch((s) => ops.deleteItem(s, tripId, dayId, itemId));
  }, [dispatch]);

  const moveItem = useCallback((tripId: string, dayIdFrom: string, dayIdTo: string, itemId: string, newIndex: number) => {
    dispatch((s) => ops.moveItem(s, tripId, dayIdFrom, dayIdTo, itemId, newIndex));
  }, [dispatch]);

  const reorderItems = useCallback((tripId: string, dayId: string, itemIds: string[]) => {
    dispatch((s) => ops.reorderItems(s, tripId, dayId, itemIds));
  }, [dispatch]);

  // Template actions
  const saveAsTemplate = useCallback((tripId: string, templateName: string, description: string) => {
    dispatch((s) => ops.saveAsTemplate(s, tripId, templateName, description));
  }, [dispatch]);

  const deleteTemplate = useCallback((templateId: string) => {
    dispatch((s) => ops.deleteTemplate(s, templateId));
  }, [dispatch]);

  const createTripFromTemplate = useCallback((template: Template, tripName: string) => {
    dispatch((s) => ops.createTripFromTemplate(s, template, tripName));
  }, [dispatch]);

  // Settings actions
  const setTheme = useCallback((theme: ThemePreference) => {
    dispatch((s) => ops.setTheme(s, theme));
  }, [dispatch]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    dispatch((s) => ops.updateSettings(s, updates));
  }, [dispatch]);

  // Export / Import
  const exportData = useCallback((tripIds?: string[]) => {
    return exportTrips(getState(), tripIds);
  }, []);

  const importData = useCallback((json: string) => {
    const imported = importTrips(json);
    // Merge imported trips (add non-duplicate trips)
    dispatch((s) => {
      const existingIds = new Set(s.trips.map((t) => t.id));
      const newTrips = imported.trips.filter((t) => !existingIds.has(t.id));
      return { ...s, trips: [...s.trips, ...newTrips] };
    });
    return imported.trips.length;
  }, [dispatch]);

  // Computed
  const activeTrip = state.trips.find((t) => t.id === state.activeTripId) ?? null;

  return {
    state,
    activeTrip,
    createTrip,
    updateTrip,
    deleteTrip,
    duplicateTrip,
    setActiveTrip,
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
    setTheme,
    updateSettings,
    exportData,
    importData,
  };
}

// Re-export types and utilities for convenience
export type { AppState, Trip, Day, Item, Template, ThemePreference, AppSettings } from './types';
export type { VersionedSchema } from './types';
