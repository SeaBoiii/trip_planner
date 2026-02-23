import React, { useEffect, useMemo, useState } from 'react';
import type { AppSettings, Item, RouteResult, TravelMode, Trip } from '@trip-planner/core';
import { EmptyState, Button } from '@trip-planner/ui';
import { MapContainer, TileLayer, CircleMarker, Polyline, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import { CalendarDays, ExternalLink, MapPin, Route, Loader2 } from 'lucide-react';
import { getItemLocationLabel, getOpenStreetMapViewUrl } from '../lib/location';
import { computeTravelSegment, getCachedRouteByArgs, routeGeometryToLatLngs } from '@trip-planner/core';

interface MapViewProps {
  trip: Trip;
  settings: AppSettings;
  onOpenItinerary?: () => void;
}

type DayFilter = 'all' | string;

interface PinnedItem {
  key: string;
  dayId: string;
  dayLabel: string;
  dayDate?: string;
  item: Item;
  lat: number;
  lon: number;
}

interface RoutePair {
  key: string;
  dayId: string;
  fromItem: Item;
  toItem: Item;
}

function collectPinnedItems(trip: Trip): PinnedItem[] {
  const pins: PinnedItem[] = [];
  for (const day of trip.days) {
    for (const item of day.items) {
      if (!item.location) continue;
      pins.push({
        key: `${day.id}:${item.id}`,
        dayId: day.id,
        dayLabel: day.label,
        dayDate: day.date,
        item,
        lat: item.location.lat,
        lon: item.location.lon,
      });
    }
  }
  return pins;
}

function collectRoutePairs(trip: Trip, dayFilter: DayFilter): RoutePair[] {
  const pairs: RoutePair[] = [];
  for (const day of trip.days) {
    if (dayFilter !== 'all' && day.id !== dayFilter) continue;
    for (let index = 0; index < day.items.length - 1; index += 1) {
      const fromItem = day.items[index];
      const toItem = day.items[index + 1];
      if (!fromItem.location || !toItem.location) continue;
      pairs.push({
        key: `${day.id}:${fromItem.id}:${toItem.id}`,
        dayId: day.id,
        fromItem,
        toItem,
      });
    }
  }
  return pairs;
}

function FitMapToPins({ pins }: { pins: PinnedItem[] }) {
  const map = useMap();

  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lon], 15, { animate: false });
      return;
    }
    const bounds = latLngBounds(pins.map((pin) => [pin.lat, pin.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, pins]);

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(timer);
  }, [map, pins.length]);

  return null;
}

export function MapView({ trip, settings, onOpenItinerary }: MapViewProps) {
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);
  const [routeSegments, setRouteSegments] = useState<Record<string, RouteResult | null>>({});
  const [routesLoading, setRoutesLoading] = useState(false);

  useEffect(() => {
    setDayFilter('all');
    setSelectedKey(null);
    setShowRoutes(settings.routing.showRoutesOnMapByDefault);
    setRouteSegments({});
  }, [trip.id]);

  const allPins = useMemo(() => collectPinnedItems(trip), [trip]);
  const visiblePins = useMemo(
    () => (dayFilter === 'all' ? allPins : allPins.filter((pin) => pin.dayId === dayFilter)),
    [allPins, dayFilter]
  );
  const routePairs = useMemo(() => collectRoutePairs(trip, dayFilter), [trip, dayFilter]);
  const activeTravelMode: TravelMode = trip.defaultTravelMode ?? 'walk';

  useEffect(() => {
    if (!selectedKey) return;
    if (!visiblePins.some((pin) => pin.key === selectedKey)) {
      setSelectedKey(null);
    }
  }, [selectedKey, visiblePins]);

  useEffect(() => {
    if (!showRoutes || routePairs.length === 0) return;
    let cancelled = false;
    const providerId = settings.routing.providerId;
    const mode = activeTravelMode;

    Promise.all(
      routePairs.map(async (pair) => {
        if (!pair.fromItem.location || !pair.toItem.location) return [pair.key, null] as const;
        const cached = await getCachedRouteByArgs({
          providerId,
          mode,
          from: [pair.fromItem.location.lon, pair.fromItem.location.lat],
          to: [pair.toItem.location.lon, pair.toItem.location.lat],
        });
        return [pair.key, cached] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      setRouteSegments((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }));
    }).catch(() => {
      // Ignore cache peek failures.
    });

    return () => {
      cancelled = true;
    };
  }, [showRoutes, routePairs, settings.routing.providerId, activeTravelMode]);

  const computeVisibleRoutes = async () => {
    setRoutesLoading(true);
    try {
      for (const pair of routePairs) {
        if (!pair.fromItem.location || !pair.toItem.location) continue;
        const computed = await computeTravelSegment({
          providerId: settings.routing.providerId,
          mode: activeTravelMode,
          from: [pair.fromItem.location.lon, pair.fromItem.location.lat],
          to: [pair.toItem.location.lon, pair.toItem.location.lat],
          apiKey: settings.routing.openrouteserviceApiKey,
          ttlMs: settings.routing.routeCacheTtlMs,
        });
        if (computed.route) {
          setRouteSegments((prev) => ({ ...prev, [pair.key]: computed.route ?? null }));
        }
      }
    } finally {
      setRoutesLoading(false);
    }
  };

  const selectedPin = visiblePins.find((pin) => pin.key === selectedKey) ?? null;

  if (allPins.length === 0) {
    return (
      <div className="h-full p-4">
        <div className="max-w-3xl mx-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <EmptyState
            icon={<MapPin size={34} />}
            title="No mapped locations yet"
            description="Add a location to an itinerary item to see it pinned on the map."
            action={
              onOpenItinerary ? (
                <Button size="sm" onClick={onOpenItinerary}>
                  Go to Itinerary
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setDayFilter('all')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              dayFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            All days
          </button>
          {trip.days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setDayFilter(day.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                dayFilter === day.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} />
            <Route size={12} /> Show routes
          </label>
          {showRoutes && routePairs.length > 0 && (
            <Button type="button" size="sm" variant="secondary" onClick={() => { void computeVisibleRoutes(); }} disabled={routesLoading}>
              {routesLoading ? <><Loader2 size={12} className="animate-spin" /> Computing</> : 'Compute visible routes'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden lg:flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-0">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {visiblePins.length} mapped item{visiblePins.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex flex-col gap-1.5">
              {visiblePins.map((pin) => {
                const selected = pin.key === selectedKey;
                return (
                  <button
                    key={pin.key}
                    type="button"
                    onClick={() => setSelectedKey(pin.key)}
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                      selected
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{pin.item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{pin.dayLabel}</p>
                    {getItemLocationLabel(pin.item) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {getItemLocationLabel(pin.item)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="relative min-h-[320px] h-full">
          {visiblePins.length === 0 ? (
            <div className="h-full p-4">
              <div className="h-full rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No locations for this filter</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pick another day or add a location to an item.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <MapContainer
                center={[visiblePins[0].lat, visiblePins[0].lon]}
                zoom={13}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitMapToPins pins={visiblePins} />
                {showRoutes && routePairs.map((pair) => {
                  const route = routeSegments[pair.key];
                  const latLngs = route ? routeGeometryToLatLngs(route) : [];
                  if (latLngs.length < 2) return null;
                  return (
                    <Polyline
                      key={`route:${pair.key}`}
                      positions={latLngs}
                      pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.75 }}
                    />
                  );
                })}
                {visiblePins.map((pin) => {
                  const isSelected = pin.key === selectedKey;
                  return (
                    <CircleMarker
                      key={pin.key}
                      center={[pin.lat, pin.lon]}
                      radius={isSelected ? 9 : 7}
                      pathOptions={{
                        color: isSelected ? '#1d4ed8' : '#2563eb',
                        weight: 2,
                        fillColor: isSelected ? '#1d4ed8' : '#3b82f6',
                        fillOpacity: 0.9,
                      }}
                      eventHandlers={{
                        click: () => setSelectedKey(pin.key),
                      }}
                    />
                  );
                })}
              </MapContainer>

              {selectedPin && (
                <div className="absolute inset-x-3 bottom-3 z-[500]">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-xl backdrop-blur p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                          {selectedPin.item.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                          <CalendarDays size={12} />
                          {selectedPin.dayLabel}
                          {selectedPin.item.time ? ` • ${selectedPin.item.time}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Close
                      </button>
                    </div>

                    {getItemLocationLabel(selectedPin.item) && (
                      <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                        {getItemLocationLabel(selectedPin.item)}
                      </p>
                    )}

                    {selectedPin.item.notes && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {selectedPin.item.notes}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {onOpenItinerary && (
                        <Button type="button" size="sm" variant="secondary" onClick={onOpenItinerary}>
                          Itinerary
                        </Button>
                      )}
                      {selectedPin.item.location && (
                        <a
                          href={getOpenStreetMapViewUrl(selectedPin.item.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                        >
                          OpenStreetMap <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
