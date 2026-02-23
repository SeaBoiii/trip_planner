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
    <div className="max-w-3xl mx-auto px-4 py-6 bg-white min-h-screen">
      <div className="flex items-center gap-3 mb-6 no-print">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft size={16} /> Back
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </Button>
      </div>

      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">{trip.name}</h1>
      {(trip.startDate || trip.endDate) && (
        <p className="text-sm text-gray-500 mb-1">
          {trip.startDate}{trip.startDate && trip.endDate && ' → '}{trip.endDate}
        </p>
      )}
      <p className="text-lg font-bold text-gray-700 mb-6">
        Total: {formatCurrency(tripTotal(trip.days), trip.currency)}
      </p>

      {trip.days.map((day) => (
        <div key={day.id} className="mb-6">
          <div className="flex items-center justify-between border-b-2 border-sky-200 pb-1 mb-2">
            <h2 className="text-base font-bold text-gray-800">
              {day.label}{day.date ? ` — ${day.date}` : ''}
            </h2>
            <span className="text-sm font-semibold text-sky-600">{formatCurrency(dayTotal(day.items), trip.currency)}</span>
          </div>
          {day.items.length === 0 && <p className="text-sm text-gray-400 italic">No items</p>}
          <table className="w-full text-sm">
            <tbody>
              {day.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-2 font-medium text-gray-800">{item.title}</td>
                  <td className="py-1.5 pr-2 text-gray-500">{item.time ?? ''}</td>
                  <td className="py-1.5 pr-2 text-gray-500">{item.location ?? ''}</td>
                  <td className="py-1.5 text-right text-gray-600 font-medium">
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
