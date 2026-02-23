import React, { useEffect, useState } from 'react';
import type { Trip, Day, Item } from '@trip-planner/core';
import {
  buildAppleTransitLink,
  buildGoogleDirectionsLink,
  buildTravelSegmentPairKey,
  computeSegmentRoute,
  computeTravelForDay,
  formatCurrency,
  dayTotal,
  estimateTravelDurationSeconds,
  getCachedSegmentRoute,
  getEffectiveTravelForEdge,
  haversineDistanceMeters,
  resolveDayTravelDefaults,
  resolveTripTravelDefaults,
  tripTotal,
  type CachedSegmentRoute,
  type TravelMode,
  type TravelOverride,
} from '@trip-planner/core';
import { Button, Input, Modal, ConfirmDialog, EmptyState, toast } from '@trip-planner/ui';
import { Plus, Trash2, ChevronDown, ChevronRight, Settings, CalendarDays, ArrowUpDown, Check, ArrowRightLeft, Route } from 'lucide-react';
import { ItemRow } from './ItemRow';
import { ItemForm } from './ItemForm';
import { TripSettings } from './TripSettings';
import { MoveToModal } from './MoveToModal';
import { TravelSegmentRow } from './TravelSegmentRow';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ItineraryProps {
  trip: Trip;
  store: ReturnType<typeof import('@trip-planner/core').useTripStore>;
}

type SegmentRouteState = {
  status: 'idle' | 'loading' | 'done';
  route?: CachedSegmentRoute;
  error?: string;
};

export function Itinerary({ trip, store }: ItineraryProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(trip.days.map((d) => d.id)));
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayLabel, setNewDayLabel] = useState('');
  const [newDayDate, setNewDayDate] = useState('');
  const [editingItem, setEditingItem] = useState<{ dayId: string; item?: Item } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'day' | 'item'; dayId: string; itemId?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ dayId: string; item: Item } | null>(null);
  const [segmentRouteStates, setSegmentRouteStates] = useState<Record<string, SegmentRouteState>>({});
  const [dayTravelComputeStatus, setDayTravelComputeStatus] = useState<Record<string, 'idle' | 'loading'>>({});

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
    if (!reorderMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as { dayId: string; index: number } | undefined;
    const overData = over.data.current as { dayId: string; index: number } | undefined;
    if (!activeData || !overData) return;

    if (activeData.dayId === overData.dayId) {
      // Within-day reorder
      const day = trip.days.find((d) => d.id === activeData.dayId);
      if (!day) return;
      const ids = day.items.map((i) => i.id);
      const oldIdx = ids.indexOf(active.id as string);
      const newIdx = ids.indexOf(over.id as string);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = [...ids];
      reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, active.id as string);
      store.reorderItems(trip.id, activeData.dayId, reordered);
    } else {
      // Cross-day move
      store.moveItem(trip.id, activeData.dayId, overData.dayId, active.id as string, overData.index);
    }
  };

  const handleMoveTo = (targetDayId: string, position: number) => {
    if (!moveTarget) return;
    store.moveItem(trip.id, moveTarget.dayId, targetDayId, moveTarget.item.id, position);
    toast('Item moved');
    setMoveTarget(null);
  };

  const routingSettings = store.state.settings.routing;
  const tripTravelDefaults = resolveTripTravelDefaults(trip.travelDefaults);
  const activeTravelMode: TravelMode = tripTravelDefaults.mode;

  const getDayDefaults = (day: Day) => resolveDayTravelDefaults(day, tripTravelDefaults);

  const getEffectiveEdgeTravel = (day: Day, fromItemId: string, toItemId: string) =>
    getEffectiveTravelForEdge(day, fromItemId, toItemId, tripTravelDefaults);

  const segmentStateKey = (dayId: string, edgeKey: string, mode: TravelMode, trafficAware?: boolean) =>
    `${dayId}:${edgeKey}:${mode}:${mode === 'DRIVE' && trafficAware ? 'traffic' : 'no-traffic'}`;

  const loadCachedTravelForDay = async (day: Day) => {
    for (let index = 0; index < day.items.length - 1; index += 1) {
      const fromItem = day.items[index];
      const toItem = day.items[index + 1];
      if (!fromItem.location || !toItem.location) continue;
      const edgeKey = buildTravelSegmentPairKey(fromItem.id, toItem.id);
      const effective = getEffectiveEdgeTravel(day, fromItem.id, toItem.id);
      const stateKey = segmentStateKey(day.id, edgeKey, effective.mode, effective.trafficAware);
      const existing = segmentRouteStates[stateKey];
      if (existing?.status === 'loading' || (existing?.status === 'done' && (existing.route || existing.error))) {
        continue;
      }
      const cached = await getCachedSegmentRoute({
        from: [fromItem.location.lon, fromItem.location.lat],
        to: [toItem.location.lon, toItem.location.lat],
        mode: effective.mode,
        trafficAware: effective.trafficAware,
      }).catch(() => null);
      if (!cached) continue;
      setSegmentRouteStates((prev) => ({
        ...prev,
        [stateKey]: { status: 'done', route: cached },
      }));
    }
  };

  const computeDayTravel = async (day: Day, force = false) => {
    if (dayTravelComputeStatus[day.id] === 'loading') return;
    setDayTravelComputeStatus((prev) => ({ ...prev, [day.id]: 'loading' }));
    try {
      const result = await computeTravelForDay({
        tripId: trip.id,
        day,
        tripTravelDefaults,
        apiKey: routingSettings.googleApiKey ?? '',
        ttlMs: routingSettings.routeCacheTtlMs,
        force,
      });

      const updates: Record<string, SegmentRouteState> = {};
      for (const [edgeKey, route] of Object.entries(result.segmentsByEdge)) {
        updates[segmentStateKey(day.id, edgeKey, route.mode, route.trafficAware)] = { status: 'done', route };
      }
      for (const [edgeKey, message] of Object.entries(result.errorsByEdge)) {
        const override = day.travelOverrides?.[edgeKey];
        const fromTo = edgeKey.split('->');
        const effective = fromTo.length === 2 ? getEffectiveEdgeTravel(day, fromTo[0], fromTo[1]) : (override ?? getDayDefaults(day));
        updates[segmentStateKey(day.id, edgeKey, effective.mode, effective.trafficAware)] = { status: 'done', error: message };
      }
      setSegmentRouteStates((prev) => ({ ...prev, ...updates }));

      toast(
        `Travel: ${result.computedCount} computed, ${result.cachedCount} cached${result.failedCount ? `, ${result.failedCount} failed` : ''}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to compute travel for this day';
      toast(message, 'error');
    } finally {
      setDayTravelComputeStatus((prev) => ({ ...prev, [day.id]: 'idle' }));
    }
  };

  const computeSegmentForPair = async (day: Day, fromItem: Item, toItem: Item, force = false) => {
    if (!fromItem.location || !toItem.location) return;
    const edgeKey = buildTravelSegmentPairKey(fromItem.id, toItem.id);
    const effective = getEffectiveEdgeTravel(day, fromItem.id, toItem.id);
    const stateKey = segmentStateKey(day.id, edgeKey, effective.mode, effective.trafficAware);
    setSegmentRouteStates((prev) => ({
      ...prev,
      [stateKey]: { status: 'loading', route: prev[stateKey]?.route },
    }));
    const result = await computeSegmentRoute({
      apiKey: routingSettings.googleApiKey ?? '',
      from: [fromItem.location.lon, fromItem.location.lat],
      to: [toItem.location.lon, toItem.location.lat],
      mode: effective.mode,
      trafficAware: effective.trafficAware,
      fromItemId: fromItem.id,
      toItemId: toItem.id,
      ttlMs: routingSettings.routeCacheTtlMs,
      force,
    });
    setSegmentRouteStates((prev) => ({
      ...prev,
      [stateKey]: {
        status: 'done',
        route: result.route,
        error: result.route ? undefined : result.error,
      },
    }));
  };

  const setSegmentOverrideMode = (day: Day, fromItemId: string, toItemId: string, nextMode: TravelMode | null) => {
    const edgeKey = buildTravelSegmentPairKey(fromItemId, toItemId);
    const nextOverrides = { ...(day.travelOverrides ?? {}) } as Record<string, TravelOverride>;
    if (!nextMode) {
      delete nextOverrides[edgeKey];
    } else {
      const dayDefaults = getDayDefaults(day);
      nextOverrides[edgeKey] = {
        mode: nextMode,
        trafficAware: nextMode === 'DRIVE' ? (dayDefaults.trafficAware ?? false) : false,
      };
    }
    store.updateDay(trip.id, day.id, {
      travelOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    });
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const day of trip.days) {
        if (!expandedDays.has(day.id)) continue;
        if (cancelled) return;
        await loadCachedTravelForDay(day);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.days, expandedDays, trip.travelDefaults]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      {/* Trip header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{trip.name}</h2>
          {(trip.startDate || trip.endDate) && (
            <div className="mt-0.5 grid grid-cols-[14px_minmax(0,1fr)] items-start gap-x-1">
              <CalendarDays size={14} className="mt-0.5 text-gray-500 dark:text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-4 break-words">
              {trip.startDate}{trip.startDate && trip.endDate && ' → '}{trip.endDate}
              </p>
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: {formatCurrency(tripTotal(trip.days), trip.baseCurrency)}
          </p>
          <div className="mt-2 grid grid-cols-[14px_minmax(0,1fr)] items-start gap-x-1 no-print">
            <Route size={14} className="mt-0.5 text-gray-500 dark:text-gray-400" />
            <div className="min-w-0 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Travel mode</span>
            {(['WALK', 'DRIVE', 'TRANSIT'] as TravelMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  store.updateTrip(trip.id, {
                    travelDefaults: {
                      ...(trip.travelDefaults ?? { trafficAware: false }),
                      mode,
                      trafficAware: mode === 'DRIVE' ? !!trip.travelDefaults?.trafficAware : false,
                    },
                  })
                }
                className={`rounded-full px-2 py-0.5 text-xs border transition-colors ${
                  activeTravelMode === mode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 no-print">
          {trip.days.some((d) => d.items.length > 0) && (
            <Button
              variant={reorderMode ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setReorderMode(!reorderMode)}
            >
              {reorderMode ? <><Check size={14} /> Done</> : <><ArrowUpDown size={14} /> Reorder</>}
            </Button>
          )}
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
            const dayDefaults = getDayDefaults(day);
            const dayModeSource = day.travelDefaults ? 'Day' : 'Trip';
            const travelPairCount = day.items.reduce((count, item, index) => {
              const next = day.items[index + 1];
              return count + (item.location && next?.location ? 1 : 0);
            }, 0);
            return (
              <div key={day.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                {/* Day header */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  onClick={() => toggleDay(day.id)}
                >
                  {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{day.label}</span>
                    {day.date && <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{day.date}</span>}
                    <span className="ml-2 inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400 no-print">
                      Mode: {dayDefaults.mode} ({dayModeSource})
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatCurrency(dayTotal(day.items), trip.baseCurrency)}
                  </span>
                  {!reorderMode && travelPairCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void computeDayTravel(day);
                      }}
                      disabled={dayTravelComputeStatus[day.id] === 'loading'}
                      className="px-2 py-1 rounded text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 no-print"
                      title="Compute travel for this day"
                    >
                      {dayTravelComputeStatus[day.id] === 'loading' ? 'Computing…' : 'Compute travel for this day'}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: 'day', dayId: day.id });
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors no-print"
                    aria-label="Delete day"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Items */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                      <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {day.items.map((item, index) => {
                          const nextItem = day.items[index + 1];
                          const segmentKey =
                            item.location && nextItem?.location
                              ? buildTravelSegmentPairKey(item.id, nextItem.id)
                              : null;
                          const effective =
                            segmentKey ? getEffectiveEdgeTravel(day, item.id, nextItem.id) : null;
                          const segmentUiKey =
                            segmentKey && effective
                              ? segmentStateKey(day.id, segmentKey, effective.mode, effective.trafficAware)
                              : null;
                          const segmentState = segmentUiKey ? segmentRouteStates[segmentUiKey] : undefined;

                          return (
                            <React.Fragment key={item.id}>
                            <SortableItem
                              item={item}
                              dayId={day.id}
                              index={index}
                              baseCurrency={trip.baseCurrency}
                              exchangeRates={store.state.settings.exchangeRates}
                              reorderMode={reorderMode}
                              showMoveTo={trip.days.length > 1}
                              onEdit={() => setEditingItem({ dayId: day.id, item })}
                              onDelete={() => setDeleteTarget({ type: 'item', dayId: day.id, itemId: item.id })}
                              onMoveTo={() => setMoveTarget({ dayId: day.id, item })}
                              />
                              {!reorderMode && item.location && nextItem?.location && (
                                (() => {
                                  const fallbackDistance = haversineDistanceMeters(
                                    item.location.lat,
                                    item.location.lon,
                                    nextItem.location.lat,
                                    nextItem.location.lon
                                  );
                                  const autoSourceLabel = day.travelDefaults ? 'Day' : 'Trip';
                                  return (
                              <TravelSegmentRow
                                mode={effective?.mode ?? activeTravelMode}
                                overrideMode={segmentKey ? day.travelOverrides?.[segmentKey]?.mode : undefined}
                                autoSourceLabel={autoSourceLabel}
                                onChangeMode={(nextMode) => {
                                  if (!nextItem) return;
                                  setSegmentOverrideMode(day, item.id, nextItem.id, nextMode);
                                }}
                                status={
                                  segmentState?.status === 'loading' || dayTravelComputeStatus[day.id] === 'loading'
                                    ? 'loading'
                                    : segmentState
                                    ? 'done'
                                    : 'idle'
                                }
                                segment={segmentState?.route}
                                fallbackDistanceMeters={fallbackDistance}
                                fallbackDurationSeconds={estimateTravelDurationSeconds(
                                  fallbackDistance,
                                  effective?.mode ?? activeTravelMode
                                )}
                                error={segmentState?.error}
                                onCompute={() => {
                                  void computeSegmentForPair(day, item, nextItem);
                                }}
                                onRetry={() => {
                                  void computeSegmentForPair(day, item, nextItem, true);
                                }}
                                mapsLinks={{
                                  google: buildGoogleDirectionsLink(
                                    [item.location.lon, item.location.lat],
                                    [nextItem.location.lon, nextItem.location.lat],
                                    effective?.mode ?? activeTravelMode
                                  ),
                                  appleTransit:
                                    (effective?.mode ?? activeTravelMode) === 'TRANSIT'
                                      ? buildAppleTransitLink(
                                          [item.location.lon, item.location.lat],
                                          [nextItem.location.lon, nextItem.location.lat]
                                        )
                                      : undefined,
                                }}
                              />
                                );
                              })()
                            )}
                          </React.Fragment>
                        );
                      })}
                    </SortableContext>
                    {day.items.length === 0 && (
                      <p className="px-3 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">No items yet</p>
                    )}
                    {!reorderMode && (
                      <div className="px-3 py-2 border-t border-gray-50 dark:border-gray-700 no-print">
                        <button
                          onClick={() => setEditingItem({ dayId: day.id })}
                          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Plus size={14} /> Add item
                        </button>
                      </div>
                    )}
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
          defaultCurrency={trip.baseCurrency}
          tripBaseCurrency={trip.baseCurrency}
          participants={trip.participants}
          exchangeRates={store.state.settings.exchangeRates}
          geocodingProviderEndpoint={store.state.settings.geocodingProviderEndpoint}
          onSave={handleSaveItem}
          onPatchItem={(dayId, itemId, updates) => store.updateItem(trip.id, dayId, itemId, updates)}
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
        settings={store.state.settings}
        onClose={() => setShowSettings(false)}
        onUpdate={(updates) => store.updateTrip(trip.id, updates)}
        theme={store.state.settings.theme}
        onThemeChange={store.setTheme}
        onUpdateSettings={store.updateSettings}
      />

      {/* Move-to Modal */}
      <MoveToModal
        open={!!moveTarget}
        days={trip.days}
        currentDayId={moveTarget?.dayId ?? ''}
        itemTitle={moveTarget?.item.title ?? ''}
        onMove={handleMoveTo}
        onClose={() => setMoveTarget(null)}
      />
    </div>
  );
}

// Sortable item wrapper
function SortableItem({ item, dayId, index, baseCurrency, exchangeRates, reorderMode, showMoveTo, onEdit, onDelete, onMoveTo }: {
  item: Item;
  dayId: string;
  index: number;
  baseCurrency: string;
  exchangeRates: import('@trip-planner/core').ExchangeRatesState;
  reorderMode: boolean;
  showMoveTo: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveTo: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { dayId, index },
    disabled: !reorderMode,
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
        baseCurrency={baseCurrency}
        exchangeRates={exchangeRates}
        onEdit={onEdit}
        onDelete={onDelete}
        onMoveTo={showMoveTo ? onMoveTo : undefined}
        reorderMode={reorderMode}
        dragHandleProps={reorderMode ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}
