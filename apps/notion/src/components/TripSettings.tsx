import React, { useEffect, useState } from 'react';
import type { AppSettings, Trip, ThemePreference } from '@trip-planner/core';
import { CURRENCIES, DEFAULT_NOMINATIM_ENDPOINT } from '@trip-planner/core';
import { Button, Input, Select, Modal, toast } from '@trip-planner/ui';
import { Sun, Moon, Monitor, Info } from 'lucide-react';

interface TripSettingsProps {
  open: boolean;
  trip: Trip;
  onClose: () => void;
  onUpdate: (updates: Partial<Pick<Trip, 'name' | 'startDate' | 'endDate' | 'currency'>>) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  geocodingProviderEndpoint: string;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
}

const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
];

export function TripSettings({
  open,
  trip,
  onClose,
  onUpdate,
  theme,
  onThemeChange,
  geocodingProviderEndpoint,
  onUpdateSettings,
}: TripSettingsProps) {
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate ?? '');
  const [endDate, setEndDate] = useState(trip.endDate ?? '');
  const [currency, setCurrency] = useState(trip.currency);
  const [endpoint, setEndpoint] = useState(geocodingProviderEndpoint);

  useEffect(() => {
    if (!open) return;
    setName(trip.name);
    setStartDate(trip.startDate ?? '');
    setEndDate(trip.endDate ?? '');
    setCurrency(trip.currency);
    setEndpoint(geocodingProviderEndpoint);
  }, [open, trip.id, trip.name, trip.startDate, trip.endDate, trip.currency, geocodingProviderEndpoint]);

  const handleSave = () => {
    onUpdate({
      name: name.trim() || trip.name,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      currency,
    });

    const trimmedEndpoint = endpoint.trim() || DEFAULT_NOMINATIM_ENDPOINT;
    if (trimmedEndpoint !== geocodingProviderEndpoint) {
      onUpdateSettings({ geocodingProviderEndpoint: trimmedEndpoint });
    }

    toast('Trip updated');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Trip Settings">
      <div className="flex flex-col gap-4">
        <Input label="Trip Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Select
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</span>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onThemeChange(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Info size={14} className="text-gray-500 dark:text-gray-400" />
            Location Search (Advanced)
          </div>
          <Input
            label="Geocoding provider endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={DEFAULT_NOMINATIM_ENDPOINT}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Default is OpenStreetMap Nominatim. Keep requests at or under 1 request/sec and cache results.
          </p>
          <button
            type="button"
            onClick={() => setEndpoint(DEFAULT_NOMINATIM_ENDPOINT)}
            className="self-start text-xs text-blue-600 hover:text-blue-700"
          >
            Reset to default
          </button>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">About data</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Map and place data use OpenStreetMap. Search uses Nominatim, and opening hours are best-effort from OSM tags via Overpass.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Hours may be missing or outdated. Verify important details directly with the venue.
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              OpenStreetMap attribution
            </a>
            <a
              href="https://operations.osmfoundation.org/policies/nominatim/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              Nominatim usage policy
            </a>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
