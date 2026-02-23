import React from 'react';
import type { TravelMode, TravelSegmentComputation } from '@trip-planner/core';
import { Button } from '@trip-planner/ui';
import { Loader2, Route, Navigation } from 'lucide-react';

interface TravelSegmentRowProps {
  mode: TravelMode;
  status: 'idle' | 'loading' | 'done';
  data?: TravelSegmentComputation;
  onCompute: () => void;
  onRetry: () => void;
  transitLinks?: { google: string; apple: string };
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
  if (mode === 'walk') return 'Walk';
  if (mode === 'drive') return 'Drive';
  return 'Transit';
}

export function TravelSegmentRow({ mode, status, data, onCompute, onRetry, transitLinks }: TravelSegmentRowProps) {
  const distance = data?.route?.distanceMeters ?? data?.fallbackDistanceMeters;
  const duration = data?.route?.durationSeconds ?? data?.fallbackDurationSeconds;

  return (
    <div className="mx-3 py-2 px-2 rounded-md border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 no-print">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-300">
            <Route size={11} />
            {modeLabel(mode)}
          </span>
          {distance != null && (
            <span className="text-gray-600 dark:text-gray-400">{formatDistance(distance)}</span>
          )}
          {duration != null && (
            <span className="text-gray-600 dark:text-gray-400">{formatDuration(duration)}</span>
          )}
          {!data?.route && data?.fallbackDistanceMeters != null && (
            <span className="text-gray-400 dark:text-gray-500">(straight-line fallback)</span>
          )}
        </div>

        {status === 'idle' && (
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
        {status === 'done' && data?.error && (
          <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>

      {status === 'done' && data?.error && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Route API unavailable: {data.error}
        </p>
      )}

      {mode === 'transit' && transitLinks && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <a
            href={transitLinks.google}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
          >
            <Navigation size={11} />
            Open transit in Google Maps
          </a>
          <a
            href={transitLinks.apple}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
          >
            <Navigation size={11} />
            Apple Maps
          </a>
        </div>
      )}
    </div>
  );
}
