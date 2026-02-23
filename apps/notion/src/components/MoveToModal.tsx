import React, { useState } from 'react';
import type { Day } from '@trip-planner/core';
import { Button, Modal, Select } from '@trip-planner/ui';
import { ArrowRightLeft } from 'lucide-react';

interface MoveToModalProps {
  open: boolean;
  days: Day[];
  currentDayId: string;
  itemTitle: string;
  onMove: (targetDayId: string, position: number) => void;
  onClose: () => void;
}

export function MoveToModal({ open, days, currentDayId, itemTitle, onMove, onClose }: MoveToModalProps) {
  const otherDays = days.filter((d) => d.id !== currentDayId);
  const [targetDayId, setTargetDayId] = useState(otherDays[0]?.id ?? '');
  const [position, setPosition] = useState('end');

  const targetDay = days.find((d) => d.id === targetDayId);
  const positionOptions = [
    { value: 'start', label: 'Beginning' },
    ...(targetDay?.items.map((it, i) => ({
      value: String(i + 1),
      label: `After "${it.title}"`,
    })) ?? []),
    { value: 'end', label: 'End' },
  ];

  const handleMove = () => {
    if (!targetDayId) return;
    let pos: number;
    if (position === 'start') {
      pos = 0;
    } else if (position === 'end') {
      pos = targetDay?.items.length ?? 0;
    } else {
      pos = parseInt(position, 10);
    }
    onMove(targetDayId, pos);
  };

  // Reset when opening
  React.useEffect(() => {
    if (open) {
      const first = days.filter((d) => d.id !== currentDayId)[0];
      setTargetDayId(first?.id ?? '');
      setPosition('end');
    }
  }, [open, currentDayId, days]);

  if (otherDays.length === 0) return null;

  return (
    <Modal open={open} onClose={onClose} title="Move Item">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Move <span className="font-medium text-gray-900 dark:text-gray-100">"{itemTitle}"</span> to another day.
        </p>

        <Select
          label="Destination Day"
          value={targetDayId}
          onChange={(e) => {
            setTargetDayId(e.target.value);
            setPosition('end');
          }}
          options={otherDays.map((d) => ({
            value: d.id,
            label: d.label + (d.date ? ` (${d.date})` : ''),
          }))}
        />

        <Select
          label="Position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          options={positionOptions}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMove} disabled={!targetDayId}>
            <ArrowRightLeft size={14} /> Move
          </Button>
        </div>
      </div>
    </Modal>
  );
}
