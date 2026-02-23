import React, { useState, useRef } from 'react';
import type { Trip } from '@trip-planner/core';
import { formatCurrency, tripTotal } from '@trip-planner/core';
import { Button, Input, Modal, ConfirmDialog, EmptyState, toast } from '@trip-planner/ui';
import { Plus, Trash2, Copy, Plane, ImagePlus, MoreVertical } from 'lucide-react';

interface TripGalleryProps {
  trips: Trip[];
  onSelect: (id: string) => void;
  onCreate: (name: string, currency?: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUpdateCover: (tripId: string, url: string) => void;
}

export function TripGallery({ trips, onSelect, onCreate, onDelete, onDuplicate, onUpdateCover }: TripGalleryProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [coverTripId, setCoverTripId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowCreate(false);
    toast('Trip created!');
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coverTripId) return;
    // Resize to reasonable size
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 600;
        let w = img.width, h = img.height;
        if (w > MAX) { h = (h * MAX) / w; w = MAX; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        onUpdateCover(coverTripId, dataUrl);
        setCoverTripId(null);
        toast('Cover photo updated');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Default gradient covers
  const gradients = [
    'from-sky-400 to-indigo-500',
    'from-rose-400 to-orange-400',
    'from-emerald-400 to-teal-500',
    'from-violet-400 to-purple-500',
    'from-amber-400 to-yellow-500',
    'from-pink-400 to-rose-500',
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800">My Trips</h2>
        <Button onClick={() => setShowCreate(true)} className="rounded-full shadow-md">
          <Plus size={16} /> New Trip
        </Button>
      </div>

      {trips.length === 0 && (
        <EmptyState
          icon={<Plane size={40} className="text-sky-400" />}
          title="No trips yet!"
          description="Tap the button above to plan your next adventure"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {trips.map((trip, i) => (
          <div
            key={trip.id}
            className="relative group rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all cursor-pointer"
            onClick={() => onSelect(trip.id)}
          >
            {/* Cover */}
            <div className={`h-36 relative ${!trip.coverPhoto ? `bg-gradient-to-br ${gradients[i % gradients.length]}` : ''}`}>
              {trip.coverPhoto && (
                <img src={trip.coverPhoto} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              {/* Menu */}
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId(menuId === trip.id ? null : trip.id);
                  }}
                  className="p-1.5 rounded-full bg-white/30 backdrop-blur-sm text-white hover:bg-white/50 transition-colors"
                >
                  <MoreVertical size={16} />
                </button>
                {menuId === trip.id && (
                  <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl py-1 w-40 animate-fade-in z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverTripId(trip.id);
                        fileRef.current?.click();
                        setMenuId(null);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <ImagePlus size={14} /> Set Cover
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(trip.id);
                        setMenuId(null);
                        toast('Trip duplicated');
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Copy size={14} /> Duplicate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(trip.id);
                        setMenuId(null);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-bold text-gray-800 text-base truncate">{trip.name}</h3>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">
                  {trip.days.length} day{trip.days.length !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-semibold text-sky-600">
                  {formatCurrency(tripTotal(trip.days), trip.currency)}
                </span>
              </div>
              {trip.startDate && (
                <p className="text-xs text-gray-400 mt-1">
                  {trip.startDate}{trip.endDate ? ` → ${trip.endDate}` : ''}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />

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
            placeholder="e.g., Bali Getaway 2026"
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
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
          setDeleteId(null);
          toast('Trip deleted');
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
