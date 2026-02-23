import React from 'react';
import type { TravelMode, TravelSegment } from '@trip-planner/core';
import { Button } from '@trip-planner/ui';
import { Loader2, Route, Navigation } from 'lucide-react';

interface TravelSegmentRowProps {
  mode: TravelMode; // effective mode
  status: 'idle' | 'loading' | 'done';
  segment?: TravelSegment;
  fallbackDistanceMeters: number;
  fallbackDurationSeconds: number;
  error?: string;
  overrideMode?: TravelMode;
  autoSourceLabel?: 'Trip' | 'Day';
  onChangeMode?: (mode: TravelMode | null) => void;
  onCompute?: () => void;
  onRetry?: () => void;
  mapsLinks?: { google: string; appleTransit?: string };
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)} km`;
  }
  return `${Math.round(distanceMeters)} m`;
}

function formatDuration(durationSeconds: number) {
  const mins = Math.round(durationSeconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} min`;
}

function modeLabel(mode: TravelMode) {
  if (mode === 'WALK') return 'Walk';
  if (mode === 'DRIVE') return 'Drive';
  return 'Transit';
}

export function TravelSegmentRow({
  mode,
  status,
  segment,
  fallbackDistanceMeters,
  fallbackDurationSeconds,
  error,
  overrideMode,
  autoSourceLabel = 'Trip',
  onChangeMode,
  onCompute,
  onRetry,
  mapsLinks,
}: TravelSegmentRowProps) {
  const distance = segment?.distanceMeters ?? fallbackDistanceMeters;
  const duration = segment?.durationSeconds ?? fallbackDurationSeconds;

  return (
    <div className="mx-3 py-2 px-2 rounded-md border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 no-print">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-300">
            <Route size={11} />
            {modeLabel(mode)}
          </span>
          {overrideMode && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              Override
            </span>
          )}
          {distance != null && (
            <span className="text-gray-600 dark:text-gray-400">{formatDistance(distance)}</span>
          )}
          {duration != null && (
            <span className="text-gray-600 dark:text-gray-400">{formatDuration(duration)}</span>
          )}
          {!segment && (
            <span className="text-gray-400 dark:text-gray-500">(straight-line fallback)</span>
          )}
        </div>

        {status === 'idle' && onCompute && (
          <Button type="button" size="sm" variant="ghost" onClick={onCompute}>
            Compute
          </Button>
        )}
        {status === 'loading' && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 size={12} className="animate-spin" />
            Computing...
          </span>
        )}
        {status === 'done' && error && onRetry && (
          <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>

      {onChangeMode && (
        <div className="mt-2 flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Mode</label>
          <select
            value={overrideMode ?? 'AUTO'}
            onChange={(e) => onChangeMode(e.target.value === 'AUTO' ? null : (e.target.value as TravelMode))}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="AUTO">Auto ({autoSourceLabel})</option>
            <option value="WALK">Walk</option>
            <option value="DRIVE">Drive</option>
            <option value="TRANSIT">Transit</option>
          </select>
        </div>
      )}

      {status === 'done' && error && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          {mode === 'TRANSIT' ? `Transit unavailable: ${error}` : `Route API unavailable: ${error}`}
        </p>
      )}

      {mapsLinks && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <a
            href={mapsLinks.google}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
          >
            <Navigation size={11} />
            Open in Google Maps
          </a>
          {mode === 'TRANSIT' && mapsLinks.appleTransit && (
            <a
              href={mapsLinks.appleTransit}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              <Navigation size={11} />
              Apple Maps
            </a>
          )}
        </div>
      )}
    </div>
  );
}
