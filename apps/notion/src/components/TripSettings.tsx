import React, { useState } from 'react';
import type { Trip } from '@trip-planner/core';
import { CURRENCIES } from '@trip-planner/core';
import { Button, Input, Select, Modal, toast } from '@trip-planner/ui';

interface TripSettingsProps {
  open: boolean;
  trip: Trip;
  onClose: () => void;
  onUpdate: (updates: Partial<Pick<Trip, 'name' | 'startDate' | 'endDate' | 'currency'>>) => void;
}

export function TripSettings({ open, trip, onClose, onUpdate }: TripSettingsProps) {
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
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
