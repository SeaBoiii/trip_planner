import React, { useEffect, useRef, useState } from 'react';
import {
  CURRENCIES,
  convertAmount,
  deleteAttachmentRecord,
  fetchOpeningHours,
  formatCurrency,
  processImageAttachmentFile,
  saveAttachmentRecord,
  searchPlaces,
  type ExchangeRatesState,
  type GeocodingSearchResult,
  type Item,
  type ItemAttachmentRef,
  type Location,
  type Participant,
} from '@trip-planner/core';
import opening_hours from 'opening_hours';
import { Button, Input, TextArea, Modal, Select } from '@trip-planner/ui';
import { ExternalLink, Image as ImageIcon, Info, Loader2, MapPin, Plus, Search, X } from 'lucide-react';
import { getOpenStreetMapViewUrl, toStructuredLocation } from '../lib/location';
import { AttachmentLightbox, AttachmentThumbs } from './AttachmentThumbs';

interface ItemFormProps {
  open: boolean;
  dayId: string;
  item?: Item;
  defaultCurrency: string;
  tripBaseCurrency: string;
  participants: Participant[];
  exchangeRates: ExchangeRatesState;
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
  defaultCurrency,
  tripBaseCurrency,
  participants,
  exchangeRates,
  geocodingProviderEndpoint,
  onSave,
  onClose,
  onPatchItem,
}: ItemFormProps) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('');
  const [costCurrency, setCostCurrency] = useState(defaultCurrency);
  const [tags, setTags] = useState('');
  const [link, setLink] = useState('');
  const [attachments, setAttachments] = useState<ItemAttachmentRef[]>([]);
  const [attachmentProcessing, setAttachmentProcessing] = useState(false);
  const [activeAttachment, setActiveAttachment] = useState<ItemAttachmentRef | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paidByParticipantId, setPaidByParticipantId] = useState('');
  const [paymentSplitType, setPaymentSplitType] = useState<'equal' | 'shares' | 'exact'>('equal');
  const [splitParticipantIds, setSplitParticipantIds] = useState<string[]>([]);
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});

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
    setCost(item?.cost?.amount?.toString() ?? '');
    setCostCurrency(item?.cost?.currency ?? defaultCurrency);
    setTags(item?.tags.join(', ') ?? '');
    setLink(item?.link ?? '');
    setAttachments(item?.attachments ?? []);
    setAttachmentProcessing(false);
    setActiveAttachment(null);
    setPaymentEnabled(!!item?.payment);
    setPaidByParticipantId(item?.payment?.paidByParticipantId ?? (participants[0]?.id ?? ''));
    setPaymentSplitType(item?.payment?.split.type ?? 'equal');
    if (item?.payment?.split.type === 'equal') {
      setSplitParticipantIds(item.payment.split.participantIds);
    } else if (item?.payment?.split.type === 'shares') {
      setSplitParticipantIds(Object.keys(item.payment.split.shares));
    } else if (item?.payment?.split.type === 'exact') {
      setSplitParticipantIds(Object.keys(item.payment.split.amounts));
    } else {
      setSplitParticipantIds(participants.map((participant) => participant.id));
    }
    setShareInputs(
      item?.payment?.split.type === 'shares'
        ? Object.fromEntries(Object.entries(item.payment.split.shares).map(([id, share]) => [id, String(share)]))
        : {}
    );
    setExactInputs(
      item?.payment?.split.type === 'exact'
        ? Object.fromEntries(Object.entries(item.payment.split.amounts).map(([id, money]) => [id, String(money.amount)]))
        : {}
    );

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
  }, [open, item?.id, defaultCurrency, participants]);

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
    const payment = buildPaymentPayload(parsedCost);
    const data: Partial<Item> & { title: string } = {
      title: title.trim(),
      time: time.trim() || undefined,
      locationText: locationText.trim() || undefined,
      location: structuredLocation,
      notes: notes.trim() || undefined,
      cost:
        Number.isFinite(parsedCost ?? NaN) && parsedCost != null
          ? { amount: parsedCost, currency: costCurrency }
          : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      payment,
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

  const handleAttachmentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentProcessing(true);
    try {
      const nextRefs: ItemAttachmentRef[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const processed = await processImageAttachmentFile(file);
        await saveAttachmentRecord(processed);
        nextRefs.push({ id: processed.meta.id, kind: 'image' });
      }
      if (nextRefs.length > 0) {
        setAttachments((prev) => [...prev, ...nextRefs]);
      }
    } finally {
      setAttachmentProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    try {
      await deleteAttachmentRecord(attachmentId);
    } catch {
      // Keep UI responsive even if cleanup fails.
    }
    if (activeAttachment?.id === attachmentId) {
      setActiveAttachment(null);
    }
  };

  const normalizedSplitParticipantIds = splitParticipantIds.filter((id, index, arr) => !!id && arr.indexOf(id) === index);

  const buildPaymentPayload = (parsedCost: number | undefined): Item['payment'] | undefined => {
    if (!paymentEnabled || !paidByParticipantId || participants.length === 0) return undefined;
    if (!Number.isFinite(parsedCost ?? NaN) || parsedCost == null) return undefined;
    if (normalizedSplitParticipantIds.length === 0) return undefined;

    if (paymentSplitType === 'equal') {
      return {
        paidByParticipantId,
        split: { type: 'equal', participantIds: normalizedSplitParticipantIds },
      };
    }

    if (paymentSplitType === 'shares') {
      const shares: Record<string, number> = {};
      for (const participantId of normalizedSplitParticipantIds) {
        const share = Number.parseFloat(shareInputs[participantId] ?? '0');
        if (Number.isFinite(share) && share > 0) {
          shares[participantId] = share;
        }
      }
      if (Object.keys(shares).length === 0) return undefined;
      return {
        paidByParticipantId,
        split: { type: 'shares', shares },
      };
    }

    const amounts: Record<string, { amount: number; currency: string }> = {};
    for (const participantId of normalizedSplitParticipantIds) {
      const amount = Number.parseFloat(exactInputs[participantId] ?? '0');
      if (Number.isFinite(amount) && amount >= 0) {
        amounts[participantId] = { amount, currency: costCurrency };
      }
    }
    if (Object.keys(amounts).length === 0) return undefined;
    return {
      paidByParticipantId,
      split: { type: 'exact', amounts },
    };
  };

  const paymentPreview = (() => {
    const parsedCost = Number.parseFloat(cost);
    if (!paymentEnabled || !Number.isFinite(parsedCost) || parsedCost < 0 || normalizedSplitParticipantIds.length === 0) {
      return null;
    }
    const result: Record<string, { original: number; base: number | null }> = {};
    if (paymentSplitType === 'equal') {
      const share = parsedCost / normalizedSplitParticipantIds.length;
      normalizedSplitParticipantIds.forEach((id, index) => {
        const original = index === normalizedSplitParticipantIds.length - 1
          ? parsedCost - share * (normalizedSplitParticipantIds.length - 1)
          : share;
        result[id] = {
          original,
          base: convertAmount({
            amount: original,
            fromCurrency: costCurrency,
            toCurrency: tripBaseCurrency,
            exchange: exchangeRates,
          }),
        };
      });
      return result;
    }
    if (paymentSplitType === 'shares') {
      const shares = normalizedSplitParticipantIds.map((id) => ({
        id,
        share: Math.max(0, Number.parseFloat(shareInputs[id] ?? '0') || 0),
      }));
      const totalShares = shares.reduce((sum, entry) => sum + entry.share, 0);
      if (totalShares <= 0) return null;
      shares.forEach((entry) => {
        const original = parsedCost * (entry.share / totalShares);
        result[entry.id] = {
          original,
          base: convertAmount({
            amount: original,
            fromCurrency: costCurrency,
            toCurrency: tripBaseCurrency,
            exchange: exchangeRates,
          }),
        };
      });
      return result;
    }
    normalizedSplitParticipantIds.forEach((id) => {
      const original = Math.max(0, Number.parseFloat(exactInputs[id] ?? '0') || 0);
      result[id] = {
        original,
        base: convertAmount({
          amount: original,
          fromCurrency: costCurrency,
          toCurrency: tripBaseCurrency,
          exchange: exchangeRates,
        }),
      };
    });
    return result;
  })();

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
            placeholder="0.00"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
        <Select
          label="Cost Currency"
          value={costCurrency}
          onChange={(e) => setCostCurrency(e.target.value)}
          options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
        />

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment / Split</span>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={paymentEnabled}
                onChange={(e) => setPaymentEnabled(e.target.checked)}
                disabled={participants.length === 0}
              />
              Track expense
            </label>
          </div>

          {participants.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Add trip participants in the Split tab to track who paid and who owes.
            </p>
          )}

          {paymentEnabled && participants.length > 0 && (
            <div className="space-y-3">
              <Select
                label="Paid by"
                value={paidByParticipantId}
                onChange={(e) => setPaidByParticipantId(e.target.value)}
                options={participants.map((participant) => ({ value: participant.id, label: participant.name }))}
              />
              <Select
                label="Split method"
                value={paymentSplitType}
                onChange={(e) => setPaymentSplitType(e.target.value as 'equal' | 'shares' | 'exact')}
                options={[
                  { value: 'equal', label: 'Equal' },
                  { value: 'shares', label: 'Shares' },
                  { value: 'exact', label: 'Exact' },
                ]}
              />

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Split participants</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {participants.map((participant) => {
                    const checked = splitParticipantIds.includes(participant.id);
                    return (
                      <label key={participant.id} className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSplitParticipantIds((prev) =>
                              e.target.checked
                                ? [...prev, participant.id]
                                : prev.filter((id) => id !== participant.id)
                            );
                          }}
                        />
                        <span className="text-gray-700 dark:text-gray-300">{participant.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {paymentSplitType === 'shares' && normalizedSplitParticipantIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Shares</p>
                  {normalizedSplitParticipantIds.map((participantId) => {
                    const participant = participants.find((p) => p.id === participantId);
                    if (!participant) return null;
                    return (
                      <div key={participantId} className="grid grid-cols-[1fr_110px] gap-2 items-center">
                        <span className="text-xs text-gray-700 dark:text-gray-300">{participant.name}</span>
                        <Input
                          value={shareInputs[participantId] ?? '1'}
                          onChange={(e) => setShareInputs((prev) => ({ ...prev, [participantId]: e.target.value }))}
                          type="number"
                          min="0"
                          step="0.1"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {paymentSplitType === 'exact' && normalizedSplitParticipantIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Exact amounts ({costCurrency})</p>
                  {normalizedSplitParticipantIds.map((participantId) => {
                    const participant = participants.find((p) => p.id === participantId);
                    if (!participant) return null;
                    return (
                      <div key={participantId} className="grid grid-cols-[1fr_110px] gap-2 items-center">
                        <span className="text-xs text-gray-700 dark:text-gray-300">{participant.name}</span>
                        <Input
                          value={exactInputs[participantId] ?? '0'}
                          onChange={(e) => setExactInputs((prev) => ({ ...prev, [participantId]: e.target.value }))}
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {paymentPreview && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Per-person preview ({tripBaseCurrency})
                  </p>
                  <div className="space-y-1">
                    {normalizedSplitParticipantIds.map((participantId) => {
                      const participant = participants.find((p) => p.id === participantId);
                      const preview = paymentPreview[participantId];
                      if (!participant || !preview) return null;
                      return (
                        <div key={participantId} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 dark:text-gray-300">{participant.name}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {formatCurrency(preview.original, costCurrency)}
                            {' '}
                            <span className="text-gray-400">/</span>
                            {' '}
                            {preview.base != null ? formatCurrency(preview.base, tripBaseCurrency) : 'Missing FX rate'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ImageIcon size={14} className="text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Attachments {attachments.length > 0 ? `(${attachments.length})` : ''}
              </span>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={attachmentProcessing}>
              <Plus size={12} />
              {attachmentProcessing ? 'Processing...' : 'Add images'}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleAttachmentFiles(e.target.files).catch(() => {
                setAttachmentProcessing(false);
              });
            }}
          />

          <AttachmentThumbs
            attachments={attachments}
            size="medium"
            interactive
            onSelect={(attachment) => setActiveAttachment(attachment)}
            onRemove={(attachmentId) => {
              handleRemoveAttachment(attachmentId).catch(() => {
                setAttachments((prev) => prev);
              });
            }}
            emptyLabel="No attachments yet"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Images are compressed in-browser and stored in IndexedDB (thumbnails + full view).
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            {item ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
      <AttachmentLightbox open={!!activeAttachment} attachment={activeAttachment} onClose={() => setActiveAttachment(null)} />
    </Modal>
  );
}
