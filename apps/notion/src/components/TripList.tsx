import React, { useState } from 'react';
import type { Trip } from '@trip-planner/core';
import { Button, Input, Modal, ConfirmDialog, EmptyState, toast } from '@trip-planner/ui';
import { Plus, MoreHorizontal, Copy, Trash2, MapPin } from 'lucide-react';

interface TripListProps {
  trips: Trip[];
  activeTripId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, currency?: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function TripList({ trips, activeTripId, onSelect, onCreate, onDelete, onDuplicate }: TripListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowCreate(false);
    toast('Trip created');
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
      toast('Trip deleted');
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">My Trips</span>
        <button
          onClick={() => setShowCreate(true)}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Create trip"
        >
          <Plus size={16} />
        </button>
      </div>

      {trips.length === 0 && (
        <EmptyState
          icon={<MapPin size={32} />}
          title="No trips yet"
          description="Create your first trip to get started"
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Trip
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-0.5">
        {trips.map((trip) => (
          <div
            key={trip.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              trip.id === activeTripId
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => onSelect(trip.id)}
          >
            <span className="flex-1 text-sm font-medium truncate">{trip.name}</span>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuId(menuId === trip.id ? null : trip.id);
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all"
                aria-label="Trip actions"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuId === trip.id && (
                <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36 animate-fade-in">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(trip.id);
                      setMenuId(null);
                      toast('Trip duplicated');
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(trip.id);
                      setMenuId(null);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Trip">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Trip Name"
            placeholder="e.g., Tokyo 2026"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Trip"
        message="This will permanently delete this trip and all its data."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
