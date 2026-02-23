import React, { useState } from 'react';
import type { Trip, Item } from '@trip-planner/core';
import { formatCurrency, dayTotal, tripTotal, CURRENCIES } from '@trip-planner/core';
import { Button, Input, Select, Modal, ConfirmDialog, EmptyState, toast } from '@trip-planner/ui';
import { Plus, Trash2, Settings, CalendarDays, GripVertical } from 'lucide-react';
import { ItemCard } from './ItemCard';
import { ItemForm } from './ItemForm';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TripDetailProps {
  trip: Trip;
  store: ReturnType<typeof import('@trip-planner/core').useTripStore>;
}

export function TripDetail({ trip, store }: TripDetailProps) {
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayLabel, setNewDayLabel] = useState('');
  const [newDayDate, setNewDayDate] = useState('');
  const [editingItem, setEditingItem] = useState<{ dayId: string; item?: Item } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'day' | 'item'; dayId: string; itemId?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState(trip.name);
  const [settingsStart, setSettingsStart] = useState(trip.startDate ?? '');
  const [settingsEnd, setSettingsEnd] = useState(trip.endDate ?? '');
  const [settingsCurrency, setSettingsCurrency] = useState(trip.currency);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleAddDay = () => {
    if (!newDayLabel.trim()) return;
    store.addDay(trip.id, newDayLabel.trim(), newDayDate || undefined);
    setNewDayLabel('');
    setNewDayDate('');
    setShowAddDay(false);
    toast('Day added');
  };

  const handleSaveItem = (dayId: string, data: Partial<Item> & { title: string }, itemId?: string) => {
    if (itemId) {
      store.updateItem(trip.id, dayId, itemId, data);
      toast('Item updated');
    } else {
      const { title, ...rest } = data;
      store.addItem(trip.id, dayId, title, rest);
      toast('Item added');
    }
    setEditingItem(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'day') {
      store.deleteDay(trip.id, deleteTarget.dayId);
      toast('Day deleted');
    } else if (deleteTarget.itemId) {
      store.deleteItem(trip.id, deleteTarget.dayId, deleteTarget.itemId);
      toast('Item deleted');
    }
    setDeleteTarget(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeData = active.data.current as { dayId: string; index: number } | undefined;
    const overData = over.data.current as { dayId: string; index: number } | undefined;
    if (!activeData || !overData) return;
    store.moveItem(trip.id, activeData.dayId, overData.dayId, active.id as string, overData.index);
  };

  const handleSaveSettings = () => {
    store.updateTrip(trip.id, {
      name: settingsName.trim() || trip.name,
      startDate: settingsStart || undefined,
      endDate: settingsEnd || undefined,
      currency: settingsCurrency,
    });
    toast('Trip updated');
    setShowSettings(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-sky-400 to-indigo-500 p-6 text-white">
        {trip.coverPhoto && (
          <img src={trip.coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-extrabold drop-shadow-sm">{trip.name}</h2>
              {(trip.startDate || trip.endDate) && (
                <p className="text-sm opacity-90 mt-0.5 flex items-center gap-1">
                  <CalendarDays size={14} />
                  {trip.startDate}{trip.startDate && trip.endDate && ' → '}{trip.endDate}
                </p>
              )}
              <p className="text-lg font-bold mt-1 drop-shadow-sm">
                {formatCurrency(tripTotal(trip.days), trip.currency)}
              </p>
            </div>
            <div className="flex gap-2 no-print">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setShowSettings(true)}>
                <Settings size={16} />
              </Button>
            </div>
          </div>
        </div>
        {trip.coverPhoto && <div className="absolute inset-0 bg-black/30" />}
      </div>

      {/* Add day FAB on mobile */}
      <div className="sm:hidden fixed bottom-24 right-4 z-30 no-print">
        <button
          onClick={() => setShowAddDay(true)}
          className="w-14 h-14 rounded-full bg-sky-500 text-white shadow-lg flex items-center justify-center hover:bg-sky-600 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Desktop add day */}
      <div className="hidden sm:flex justify-end mb-4 no-print">
        <Button onClick={() => setShowAddDay(true)} className="rounded-full">
          <Plus size={14} /> Add Day
        </Button>
      </div>

      {trip.days.length === 0 && (
        <EmptyState
          icon={<CalendarDays size={40} className="text-sky-400" />}
          title="No days yet!"
          description="Tap + to add your first day"
        />
      )}

      {/* Days as sections */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-6">
          {trip.days.map((day) => (
            <section key={day.id}>
              {/* Day header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{day.label}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {day.date && <span>{day.date}</span>}
                    <span>{formatCurrency(dayTotal(day.items), trip.currency)}</span>
                  </div>
                </div>
                <div className="flex gap-2 no-print">
                  <button
                    onClick={() => setEditingItem({ dayId: day.id })}
                    className="p-2 rounded-xl bg-white text-sky-600 shadow-sm hover:shadow transition-all"
                    aria-label="Add item"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ type: 'day', dayId: day.id })}
                    className="p-2 rounded-xl bg-white text-gray-400 shadow-sm hover:shadow hover:text-red-500 transition-all"
                    aria-label="Delete day"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Item cards */}
              <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {day.items.map((item, index) => (
                    <SortableItemCard
                      key={item.id}
                      item={item}
                      dayId={day.id}
                      index={index}
                      currency={trip.currency}
                      onEdit={() => setEditingItem({ dayId: day.id, item })}
                      onDelete={() => setDeleteTarget({ type: 'item', dayId: day.id, itemId: item.id })}
                    />
                  ))}
                </div>
              </SortableContext>

              {day.items.length === 0 && (
                <div className="text-center py-8 text-gray-300 text-sm">
                  No items — tap + to add
                </div>
              )}
            </section>
          ))}
        </div>
      </DndContext>

      {/* Add Day Modal */}
      <Modal open={showAddDay} onClose={() => setShowAddDay(false)} title="Add Day">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddDay();
          }}
          className="flex flex-col gap-4"
        >
          <Input label="Day Label" placeholder="e.g., Day 1 — Beach Day" value={newDayLabel} onChange={(e) => setNewDayLabel(e.target.value)} autoFocus required />
          <Input label="Date (optional)" type="date" value={newDayDate} onChange={(e) => setNewDayDate(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddDay(false)}>Cancel</Button>
            <Button type="submit" disabled={!newDayLabel.trim()}>Add Day</Button>
          </div>
        </form>
      </Modal>

      {/* Item Form */}
      {editingItem && (
        <ItemForm
          open
          dayId={editingItem.dayId}
          item={editingItem.item}
          onSave={handleSaveItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'day' ? 'Delete Day' : 'Delete Item'}
        message={deleteTarget?.type === 'day' ? 'This day and all items will be removed.' : 'This item will be permanently deleted.'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Settings modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Trip Settings">
        <div className="flex flex-col gap-4">
          <Input label="Trip Name" value={settingsName} onChange={(e) => setSettingsName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={settingsStart} onChange={(e) => setSettingsStart(e.target.value)} />
            <Input label="End Date" type="date" value={settingsEnd} onChange={(e) => setSettingsEnd(e.target.value)} />
          </div>
          <Select
            label="Currency"
            value={settingsCurrency}
            onChange={(e) => setSettingsCurrency(e.target.value)}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SortableItemCard({ item, dayId, index, currency, onEdit, onDelete }: {
  item: Item;
  dayId: string;
  index: number;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { dayId, index },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ItemCard
        item={item}
        currency={currency}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
