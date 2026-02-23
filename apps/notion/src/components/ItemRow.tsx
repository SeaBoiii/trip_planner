import React from 'react';
import type { ExchangeRatesState, Item } from '@trip-planner/core';
import { convertItemCostToBase, formatCurrency } from '@trip-planner/core';
import { Clock, MapPin, GripVertical, ExternalLink, Tag, ArrowRightLeft, Image as ImageIcon } from 'lucide-react';
import { getItemLocationLabel } from '../lib/location';
import { AttachmentThumbs } from './AttachmentThumbs';

interface ItemRowProps {
  item: Item;
  baseCurrency: string;
  exchangeRates?: ExchangeRatesState;
  onEdit: () => void;
  onDelete: () => void;
  onMoveTo?: () => void;
  reorderMode?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function ItemRow({ item, baseCurrency, exchangeRates, onEdit, onDelete, onMoveTo, reorderMode, dragHandleProps }: ItemRowProps) {
  const locationLabel = getItemLocationLabel(item);
  const convertedToBase = item.cost && exchangeRates
    ? convertItemCostToBase(item, baseCurrency, exchangeRates)
    : null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group border-b border-gray-50 dark:border-gray-700 last:border-b-0">
      {/* Drag handle — only visible in reorder mode */}
      {reorderMode && (
        <button
          {...dragHandleProps}
          className="mt-1 p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none no-print"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={reorderMode ? undefined : onEdit}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.title}</span>
          {item.link && !reorderMode && (
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
        {!reorderMode && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {item.time && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock size={11} /> {item.time}
              </span>
            )}
            {locationLabel && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <MapPin size={11} /> {locationLabel}
              </span>
            )}
            {item.tags.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <Tag size={11} />
                {item.tags.join(', ')}
              </span>
            )}
            {!!item.attachments?.length && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <ImageIcon size={11} />
                {item.attachments.length}
              </span>
            )}
          </div>
        )}
        {!reorderMode && item.notes && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{item.notes}</p>
        )}
        {!reorderMode && !!item.attachments?.length && (
          <div className="mt-1">
            <AttachmentThumbs attachments={item.attachments} maxCount={3} size="tiny" />
          </div>
        )}
      </div>

      {/* Move-to button — visible on hover when not in reorder mode */}
      {!reorderMode && onMoveTo && (
        <button
          onClick={onMoveTo}
          className="mt-0.5 p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 opacity-0 group-hover:opacity-100 transition-all no-print"
          aria-label="Move to another day"
          title="Move to…"
        >
          <ArrowRightLeft size={13} />
        </button>
      )}

      {/* Cost */}
      {!reorderMode && item.cost != null && item.cost.amount > 0 && (
        <div className="text-right whitespace-nowrap mt-0.5">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {formatCurrency(item.cost.amount, item.cost.currency)}
          </div>
          {item.cost.currency !== baseCurrency && convertedToBase != null && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500">
              {formatCurrency(convertedToBase, baseCurrency)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
