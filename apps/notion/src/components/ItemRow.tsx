import React from 'react';
import type { Item } from '@trip-planner/core';
import { formatCurrency } from '@trip-planner/core';
import { Clock, MapPin, GripVertical, ExternalLink, Tag } from 'lucide-react';

interface ItemRowProps {
  item: Item;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function ItemRow({ item, currency, onEdit, onDelete, dragHandleProps }: ItemRowProps) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-b-0">
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className="mt-1 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none no-print"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-500 hover:text-blue-700 shrink-0"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {item.time && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={11} /> {item.time}
            </span>
          )}
          {item.location && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin size={11} /> {item.location}
            </span>
          )}
          {item.tags.length > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Tag size={11} />
              {item.tags.join(', ')}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.notes}</p>
        )}
      </div>

      {/* Cost */}
      {item.cost != null && item.cost > 0 && (
        <span className="text-xs font-medium text-gray-600 whitespace-nowrap mt-0.5">
          {formatCurrency(item.cost, currency)}
        </span>
      )}
    </div>
  );
}
