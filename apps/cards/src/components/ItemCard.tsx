import React from 'react';
import type { Item } from '@trip-planner/core';
import { formatCurrency } from '@trip-planner/core';
import { Clock, MapPin, GripVertical, ExternalLink, Tag, Trash2 } from 'lucide-react';

interface ItemCardProps {
  item: Item;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function ItemCard({ item, currency, onEdit, onDelete, dragHandleProps }: ItemCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-3 hover:shadow-md transition-all group">
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className="mt-0.5 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none self-start no-print"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-gray-800 truncate">{item.title}</h4>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sky-500 hover:text-sky-700 shrink-0"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.time && (
            <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full">
              <Clock size={11} /> {item.time}
            </span>
          )}
          {item.location && (
            <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full">
              <MapPin size={11} /> {item.location}
            </span>
          )}
          {item.cost != null && item.cost > 0 && (
            <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
              {formatCurrency(item.cost, currency)}
            </span>
          )}
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.notes && (
          <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{item.notes}</p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="self-start p-1 rounded-lg text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all no-print"
        aria-label="Delete item"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
