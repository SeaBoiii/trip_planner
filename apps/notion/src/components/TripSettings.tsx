import React, { useState } from 'react';
import type { Trip, ThemePreference } from '@trip-planner/core';
import { CURRENCIES } from '@trip-planner/core';
import { Button, Input, Select, Modal, toast } from '@trip-planner/ui';
import { Sun, Moon, Monitor } from 'lucide-react';

interface TripSettingsProps {
  open: boolean;
  trip: Trip;
  onClose: () => void;
  onUpdate: (updates: Partial<Pick<Trip, 'name' | 'startDate' | 'endDate' | 'currency'>>) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}

const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
];

export function TripSettings({ open, trip, onClose, onUpdate, theme, onThemeChange }: TripSettingsProps) {
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate ?? '');
  const [endDate, setEndDate] = useState(trip.endDate ?? '');
  const [currency, setCurrency] = useState(trip.currency);

  const handleSave = () => {
    onUpdate({
      name: name.trim() || trip.name,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      currency,
    });
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

        {/* Theme selector */}
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

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
