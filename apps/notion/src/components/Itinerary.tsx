import React, { useState } from 'react';
import type { Trip, Day, Item } from '@trip-planner/core';
import { formatCurrency, dayTotal, tripTotal, CURRENCIES } from '@trip-planner/core';
import { Button, Input, Select, Modal, ConfirmDialog, EmptyState, toast } from '@trip-planner/ui';
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Settings, CalendarDays } from 'lucide-react';
import { ItemRow } from './ItemRow';
import { ItemForm } from './ItemForm';
import { TripSettings } from './TripSettings';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ItineraryProps {
  trip: Trip;
  store: ReturnType<typeof import('@trip-planner/core').useTripStore>;
}

export function Itinerary({ trip, store }: ItineraryProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(trip.days.map((d) => d.id)));
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayLabel, setNewDayLabel] = useState('');
  const [newDayDate, setNewDayDate] = useState('');
  const [editingItem, setEditingItem] = useState<{ dayId: string; item?: Item } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'day' | 'item'; dayId: string; itemId?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const toggleDay = (dayId: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dayId) ? next.delete(dayId) : next.add(dayId);
      return next;
    });
  };

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

    // Parse drag data
    const activeData = active.data.current as { dayId: string; index: number } | undefined;
    const overData = over.data.current as { dayId: string; index: number } | undefined;
    if (!activeData || !overData) return;

    store.moveItem(
      trip.id,
      activeData.dayId,
      overData.dayId,
      active.id as string,
      overData.index
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      {/* Trip header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{trip.name}</h2>
          {(trip.startDate || trip.endDate) && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <CalendarDays size={14} />
              {trip.startDate}{trip.startDate && trip.endDate && ' → '}{trip.endDate}
            </p>
          )}
          <p className="text-sm text-gray-500">
            Total: {formatCurrency(tripTotal(trip.days), trip.currency)}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
          </Button>
          <Button size="sm" onClick={() => setShowAddDay(true)}>
            <Plus size={14} /> Day
          </Button>
        </div>
      </div>

      {trip.days.length === 0 && (
        <EmptyState
          icon={<CalendarDays size={32} />}
          title="No days yet"
          description="Add your first day to start planning"
          action={
            <Button size="sm" onClick={() => setShowAddDay(true)}>
              <Plus size={14} /> Add Day
            </Button>
          }
        />
      )}

      {/* Days list with drag & drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-3">
          {trip.days.map((day) => {
            const isExpanded = expandedDays.has(day.id);
            return (
              <div key={day.id} className="border border-gray-200 rounded-lg bg-white">
                {/* Day header */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleDay(day.id)}
                >
                  {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-800">{day.label}</span>
                    {day.date && <span className="text-xs text-gray-500 ml-2">{day.date}</span>}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatCurrency(dayTotal(day.items), trip.currency)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: 'day', dayId: day.id });
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors no-print"
                    aria-label="Delete day"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Items */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {day.items.map((item, index) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          dayId={day.id}
                          index={index}
                          currency={trip.currency}
                          onEdit={() => setEditingItem({ dayId: day.id, item })}
                          onDelete={() => setDeleteTarget({ type: 'item', dayId: day.id, itemId: item.id })}
                        />
                      ))}
                    </SortableContext>
                    {day.items.length === 0 && (
                      <p className="px-3 py-4 text-sm text-gray-400 text-center">No items yet</p>
                    )}
                    <div className="px-3 py-2 border-t border-gray-50 no-print">
                      <button
                        onClick={() => setEditingItem({ dayId: day.id })}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <Plus size={14} /> Add item
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
          <Input
            label="Day Label"
            placeholder="e.g., Day 1 — Arrival"
            value={newDayLabel}
            onChange={(e) => setNewDayLabel(e.target.value)}
            autoFocus
            required
          />
          <Input
            label="Date (optional)"
            type="date"
            value={newDayDate}
            onChange={(e) => setNewDayDate(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddDay(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newDayLabel.trim()}>
              Add Day
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item Form Modal */}
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
        message={
          deleteTarget?.type === 'day'
            ? 'This will delete this day and all its items.'
            : 'This item will be permanently deleted.'
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Trip Settings */}
      <TripSettings
        open={showSettings}
        trip={trip}
        onClose={() => setShowSettings(false)}
        onUpdate={(updates) => store.updateTrip(trip.id, updates)}
      />
    </div>
  );
}

// Sortable item wrapper
function SortableItem({ item, dayId, index, currency, onEdit, onDelete }: {
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
      <ItemRow
        item={item}
        currency={currency}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
