import React, { useEffect, useState } from 'react';
import {
  fetchOpeningHours,
  searchPlaces,
  type GeocodingSearchResult,
  type Item,
  type Location,
} from '@trip-planner/core';
import opening_hours from 'opening_hours';
import { Button, Input, TextArea, Modal } from '@trip-planner/ui';
import { ExternalLink, Info, Loader2, MapPin, Search, X } from 'lucide-react';
import { getOpenStreetMapViewUrl, toStructuredLocation } from '../lib/location';

interface ItemFormProps {
  open: boolean;
  dayId: string;
  item?: Item;
  geocodingProviderEndpoint?: string;
  onSave: (dayId: string, data: Partial<Item> & { title: string }, itemId?: string) => void;
  onClose: () => void;
  onPatchItem?: (dayId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => void;
}

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function formatNextChange(date: Date) {
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  const formatter = new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return formatter.format(date);
}

function getOpeningHoursSummary(location?: Location) {
  const raw = location?.openingHours?.raw;
  if (!raw) return null;

  try {
    const countryCode = location.address?.country_code;
    const state = location.address?.state ?? '';
    const nominatimObject = countryCode
      ? ({
          lat: location.lat,
          lon: location.lon,
          address: {
            country_code: countryCode,
            state,
          },
        } as const)
      : undefined;

    const parser = nominatimObject ? new opening_hours(raw, nominatimObject as never) : new opening_hours(raw);
    const now = new Date();
    const unknown = parser.getUnknown(now);
    const isOpen = parser.getState(now);
    const nextChange = parser.getNextChange(now, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

    return {
      raw,
      parseFailed: false,
      unknown,
      isOpen,
      statusLabel: unknown ? 'Status unknown' : isOpen ? 'Open now' : 'Closed',
      nextChangeLabel: nextChange
        ? `${unknown ? 'Next change' : isOpen ? 'Closes' : 'Opens'} ${formatNextChange(nextChange)}`
        : undefined,
    };
  } catch {
    return {
      raw,
      parseFailed: true,
      unknown: false,
      isOpen: false,
      statusLabel: undefined,
      nextChangeLabel: undefined,
    };
  }
}

export function ItemForm({
  open,
  dayId,
  item,
  geocodingProviderEndpoint,
  onSave,
  onClose,
  onPatchItem,
}: ItemFormProps) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('');
  const [tags, setTags] = useState('');
  const [link, setLink] = useState('');

  const [locationText, setLocationText] = useState('');
  const [structuredLocation, setStructuredLocation] = useState<Location | undefined>(undefined);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<AsyncStatus>('idle');
  const [searchResults, setSearchResults] = useState<GeocodingSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRefreshNonce, setSearchRefreshNonce] = useState(0);
  const [hoursStatus, setHoursStatus] = useState<AsyncStatus>('idle');
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursRefreshNonce, setHoursRefreshNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? '');
    setTime(item?.time ?? '');
    setNotes(item?.notes ?? '');
    setCost(item?.cost?.toString() ?? '');
    setTags(item?.tags.join(', ') ?? '');
    setLink(item?.link ?? '');

    setLocationText(item?.locationText ?? '');
    setStructuredLocation(item?.location);
    const initialQuery = item?.location?.displayName ?? item?.locationText ?? '';
    setLocationQuery(initialQuery);
    setShowLocationSearch(!item?.location && !item?.locationText);

    setSearchStatus('idle');
    setSearchResults([]);
    setSearchError(null);
    setSearchRefreshNonce(0);
    setHoursStatus('idle');
    setHoursError(null);
    setHoursRefreshNonce(0);
  }, [open, item?.id]);

  const debouncedLocationQuery = useDebouncedValue(locationQuery, 400);

  useEffect(() => {
    if (!open || !showLocationSearch) return;
    const query = debouncedLocationQuery.trim();

    if (query.length < 2) {
      setSearchStatus('idle');
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setSearchStatus('loading');
    setSearchError(null);

    searchPlaces(query, {
      endpoint: geocodingProviderEndpoint,
      signal: controller.signal,
      limit: 5,
    })
      .then((results) => {
        if (!active) return;
        setSearchResults(results);
        setSearchStatus('success');
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setSearchResults([]);
        setSearchStatus('error');
        setSearchError(error instanceof Error ? error.message : 'Failed to search locations');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, showLocationSearch, debouncedLocationQuery, geocodingProviderEndpoint, searchRefreshNonce]);

  useEffect(() => {
    if (!open) return;
    if (!structuredLocation?.osm) {
      setHoursStatus(structuredLocation ? 'success' : 'idle');
      setHoursError(null);
      return;
    }

    const fetchedAt = structuredLocation.openingHours?.fetchedAt ?? 0;
    const isFresh = fetchedAt > 0 && Date.now() - fetchedAt < 7 * 24 * 60 * 60 * 1000;
    if (isFresh && hoursRefreshNonce === 0) {
      setHoursStatus('success');
      setHoursError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setHoursStatus('loading');
    setHoursError(null);

    fetchOpeningHours(structuredLocation.osm.osmType, structuredLocation.osm.osmId, {
      signal: controller.signal,
      force: hoursRefreshNonce > 0,
    })
      .then((details) => {
        if (!active) return;
        const nextLocation: Location = {
          ...structuredLocation,
          lastFetchedAt: Date.now(),
          openingHours: {
            ...structuredLocation.openingHours,
            raw: details.opening_hours,
            fetchedAt: details.fetchedAt,
          },
        };
        setStructuredLocation(nextLocation);
        setHoursStatus('success');
        setHoursError(null);
        if (hoursRefreshNonce > 0) {
          setHoursRefreshNonce(0);
        }

        if (item?.id && onPatchItem) {
          onPatchItem(dayId, item.id, { location: nextLocation });
        }
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setHoursStatus('error');
        setHoursError(error instanceof Error ? error.message : 'Failed to load opening hours');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    open,
    dayId,
    item?.id,
    onPatchItem,
    structuredLocation?.osm?.osmId,
    structuredLocation?.osm?.osmType,
    structuredLocation?.openingHours?.fetchedAt,
    hoursRefreshNonce,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedCost = cost.trim() ? Number.parseFloat(cost) : undefined;
    const data: Partial<Item> & { title: string } = {
      title: title.trim(),
      time: time.trim() || undefined,
      locationText: locationText.trim() || undefined,
      location: structuredLocation,
      notes: notes.trim() || undefined,
      cost: Number.isFinite(parsedCost ?? NaN) ? parsedCost : undefined,
      tags: tags
        ? tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      link: link.trim() || undefined,
    };
    onSave(dayId, data, item?.id);
  };

  const selectStructuredLocation = (result: GeocodingSearchResult) => {
    const next = toStructuredLocation(result);
    setStructuredLocation(next);
    setLocationText('');
    setLocationQuery(result.displayName);
    setShowLocationSearch(false);
    setSearchStatus('idle');
    setSearchResults([]);
    setSearchError(null);
    setSearchRefreshNonce(0);
    setHoursStatus('idle');
    setHoursError(null);
    setHoursRefreshNonce(0);
  };

  const useAsFreeText = () => {
    const value = locationQuery.trim();
    if (!value) return;
    setLocationText(value);
    setStructuredLocation(undefined);
    setShowLocationSearch(false);
    setSearchStatus('idle');
    setSearchResults([]);
    setSearchError(null);
    setSearchRefreshNonce(0);
    setHoursStatus('idle');
    setHoursError(null);
  };

  const clearLocation = () => {
    setLocationText('');
    setStructuredLocation(undefined);
    setLocationQuery('');
    setShowLocationSearch(false);
    setSearchStatus('idle');
    setSearchResults([]);
    setSearchError(null);
    setSearchRefreshNonce(0);
    setHoursStatus('idle');
    setHoursError(null);
  };

  const openLocationEditor = () => {
    setShowLocationSearch(true);
    setLocationQuery(structuredLocation?.displayName ?? locationText);
    setSearchStatus('idle');
    setSearchResults([]);
    setSearchError(null);
    setSearchRefreshNonce(0);
  };

  const openingHoursSummary = getOpeningHoursSummary(structuredLocation);

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Item' : 'Add Item'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Title *"
          placeholder="e.g., Visit Senso-ji Temple"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Time"
            placeholder="e.g., 09:00"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <Input
            label="Cost"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</span>
            </div>
            {!showLocationSearch && (
              <Button type="button" size="sm" variant="secondary" onClick={openLocationEditor}>
                {structuredLocation || locationText ? 'Change' : 'Add location'}
              </Button>
            )}
          </div>

          {!showLocationSearch && structuredLocation && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3">
              <p className="text-sm text-gray-800 dark:text-gray-200">{structuredLocation.displayName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={getOpenStreetMapViewUrl(structuredLocation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  View on map <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  onClick={clearLocation}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  Remove <X size={12} />
                </button>
              </div>

              <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <span>Opening hours</span>
                  <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500" title="Hours come from OpenStreetMap data and may be missing or outdated.">
                    <Info size={12} />
                    OSM data
                  </span>
                </div>

                {hoursStatus === 'loading' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Loader2 size={12} className="animate-spin" />
                    Checking hours...
                  </div>
                )}

                {hoursStatus === 'error' && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Could not load hours. {hoursError ? `(${hoursError})` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => setHoursRefreshNonce((n) => n + 1)}
                      className="self-start text-xs text-blue-600 hover:text-blue-700"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {hoursStatus !== 'loading' && hoursStatus !== 'error' && (
                  <div className="mt-2 space-y-1">
                    {openingHoursSummary?.statusLabel && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          openingHoursSummary.unknown
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : openingHoursSummary.isOpen
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {openingHoursSummary.statusLabel}
                      </span>
                    )}
                    {openingHoursSummary?.nextChangeLabel && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{openingHoursSummary.nextChangeLabel}</p>
                    )}
                    {structuredLocation.openingHours?.raw ? (
                      <p className="text-xs text-gray-700 dark:text-gray-300 break-words">
                        {structuredLocation.openingHours.raw}
                        {openingHoursSummary?.parseFailed && (
                          <span className="ml-1 text-gray-500 dark:text-gray-400">(raw format shown)</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Hours unavailable</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!showLocationSearch && !structuredLocation && locationText && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3">
              <p className="text-sm text-gray-800 dark:text-gray-200">{locationText}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openLocationEditor}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={clearLocation}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {showLocationSearch && (
            <div className="flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Search places"
                    placeholder="Search address or place name"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowLocationSearch(false);
                    setSearchStatus('idle');
                    setSearchResults([]);
                    setSearchError(null);
                    setSearchRefreshNonce(0);
                  }}
                >
                  Cancel
                </Button>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {searchStatus === 'loading' && (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    Searching...
                  </div>
                )}

                {searchStatus === 'error' && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Search failed. {searchError ?? ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchRefreshNonce((n) => n + 1)}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-700"
                      disabled={!locationQuery.trim()}
                    >
                      Try again
                    </button>
                  </div>
                )}

                {searchStatus !== 'loading' && searchStatus !== 'error' && debouncedLocationQuery.trim().length < 2 && (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    Type at least 2 characters to search.
                  </div>
                )}

                {searchStatus !== 'loading' && searchStatus !== 'error' && debouncedLocationQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    No places found.
                  </div>
                )}

                {searchResults.length > 0 && (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {searchResults.map((result) => (
                      <li key={`${result.osmType}:${result.osmId}`}>
                        <button
                          type="button"
                          onClick={() => selectStructuredLocation(result)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <Search size={13} className="mt-0.5 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{result.displayName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {result.lat.toFixed(4)}, {result.lon.toFixed(4)}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={useAsFreeText}
                  disabled={!locationQuery.trim()}
                >
                  Use as free text
                </Button>
                {(structuredLocation || locationText) && (
                  <Button type="button" size="sm" variant="ghost" onClick={clearLocation}>
                    Remove location
                  </Button>
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Search uses OpenStreetMap Nominatim (debounced + rate limited to 1 request/sec). Your browser sends the site referer.
              </p>
            </div>
          )}
        </div>

        <Input
          label="Link"
          placeholder="https://maps.google.com/..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Input
          label="Tags (comma separated)"
          placeholder="e.g., food, temple, shopping"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <TextArea
          label="Notes"
          placeholder="Any additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            {item ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
