import { nanoid } from './utils';
import type { Trip, Day, Item } from './types';

export function createNewTrip(name: string, baseCurrency = 'SGD'): Trip {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    name,
    baseCurrency,
    participants: [],
    defaultTravelMode: 'WALK',
    days: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createNewDay(label: string, date?: string): Day {
  return {
    id: nanoid(),
    label,
    date,
    items: [],
  };
}

export function createNewItem(title: string, partial?: Partial<Omit<Item, 'id' | 'title'>>): Item {
  return {
    id: nanoid(),
    title,
    tags: [],
    attachments: [],
    ...partial,
  };
}
