import React, { useState } from 'react';
import type { Item } from '@trip-planner/core';
import { Button, Input, TextArea, Modal } from '@trip-planner/ui';

interface ItemFormProps {
  open: boolean;
  dayId: string;
  item?: Item;
  onSave: (dayId: string, data: Partial<Item> & { title: string }, itemId?: string) => void;
  onClose: () => void;
}

export function ItemForm({ open, dayId, item, onSave, onClose }: ItemFormProps) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [time, setTime] = useState(item?.time ?? '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [cost, setCost] = useState(item?.cost?.toString() ?? '');
  const [tags, setTags] = useState(item?.tags.join(', ') ?? '');
  const [link, setLink] = useState(item?.link ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const data: Partial<Item> & { title: string } = {
      title: title.trim(),
      time: time || undefined,
      location: location || undefined,
      notes: notes || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      link: link || undefined,
    };
    onSave(dayId, data, item?.id);
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Item' : 'Add Item'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Title *"
          placeholder="e.g., Snorkeling at Blue Lagoon"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Time" placeholder="e.g., 10:00" value={time} onChange={(e) => setTime(e.target.value)} />
          <Input label="Cost" type="number" step="0.01" min="0" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <Input label="Location" placeholder="e.g., Nusa Penida" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Input label="Link" placeholder="https://maps.google.com/..." value={link} onChange={(e) => setLink(e.target.value)} />
        <Input label="Tags (comma separated)" placeholder="e.g., adventure, water" value={tags} onChange={(e) => setTags(e.target.value)} />
        <TextArea label="Notes" placeholder="Any details..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!title.trim()}>{item ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  );
}
