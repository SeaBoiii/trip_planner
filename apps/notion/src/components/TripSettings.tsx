import React, { useEffect, useState } from 'react';
import type { Trip } from '@trip-planner/core';
import { CURRENCIES } from '@trip-planner/core';
import { Button, Input, Select, Modal, toast } from '@trip-planner/ui';

interface TripSettingsProps {
  open: boolean;
  trip: Trip;
  onClose: () => void;
  onUpdate: (updates: Partial<Pick<Trip, 'name' | 'startDate' | 'endDate' | 'baseCurrency'>>) => void;
}

export function TripSettings({ open, trip, onClose, onUpdate }: TripSettingsProps) {
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate ?? '');
  const [endDate, setEndDate] = useState(trip.endDate ?? '');
  const [baseCurrency, setBaseCurrency] = useState(trip.baseCurrency);

  useEffect(() => {
    if (!open) return;
    setName(trip.name);
    setStartDate(trip.startDate ?? '');
    setEndDate(trip.endDate ?? '');
    setBaseCurrency(trip.baseCurrency);
  }, [open, trip]);

  const handleSave = () => {
    onUpdate({
      name: name.trim() || trip.name,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      baseCurrency: (baseCurrency || trip.baseCurrency).toUpperCase(),
    });
    toast('Trip details saved');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Trip Details">
      <div className="flex flex-col gap-4">
        <Input label="Trip Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Select
          label="Base Currency"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

