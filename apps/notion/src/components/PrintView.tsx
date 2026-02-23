import React from 'react';
import type { Trip } from '@trip-planner/core';
import { formatCurrency, dayTotal, tripTotal } from '@trip-planner/core';
import { Button } from '@trip-planner/ui';
import { ArrowLeft, Printer } from 'lucide-react';

interface PrintViewProps {
  trip: Trip;
  onClose: () => void;
}

export function PrintView({ trip, onClose }: PrintViewProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6 no-print">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft size={16} /> Back
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </Button>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{trip.name}</h1>
      {(trip.startDate || trip.endDate) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {trip.startDate}{trip.startDate && trip.endDate && ' → '}{trip.endDate}
        </p>
      )}
      <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-6">
        Total: {formatCurrency(tripTotal(trip.days), trip.currency)}
      </p>

      {trip.days.map((day) => (
        <div key={day.id} className="mb-6">
          <div className="flex items-center justify-between border-b border-gray-300 dark:border-gray-600 pb-1 mb-2">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {day.label}{day.date ? ` — ${day.date}` : ''}
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(dayTotal(day.items), trip.currency)}</span>
          </div>
          {day.items.length === 0 && <p className="text-sm text-gray-400 italic">No items</p>}
          <table className="w-full text-sm">
            <tbody>
              {day.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-1 pr-2 font-medium text-gray-800 dark:text-gray-200">{item.title}</td>
                  <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{item.time ?? ''}</td>
                  <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">{item.location ?? ''}</td>
                  <td className="py-1 text-right text-gray-600 dark:text-gray-400">
                    {item.cost != null ? formatCurrency(item.cost, trip.currency) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
