import React from 'react';
import type { Trip } from '@trip-planner/core';
import { formatCurrency, dayTotal, tripTotal } from '@trip-planner/core';
import { DollarSign } from 'lucide-react';

interface BudgetViewProps {
  trip: Trip;
}

export function BudgetView({ trip }: BudgetViewProps) {
  const total = tripTotal(trip.days);

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <h2 className="text-xl font-bold text-gray-900 mb-1">{trip.name} — Budget</h2>
      <p className="text-2xl font-bold text-blue-600 mb-6">
        {formatCurrency(total, trip.currency)}
      </p>

      <div className="flex flex-col gap-3">
        {trip.days.map((day) => {
          const dt = dayTotal(day.items);
          return (
            <div key={day.id} className="border border-gray-200 rounded-lg bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-gray-800">{day.label}</span>
                <span className="text-sm font-semibold text-gray-700">{formatCurrency(dt, trip.currency)}</span>
              </div>
              {day.items.filter((i) => i.cost).map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-gray-600 py-0.5">
                  <span>{item.title}</span>
                  <span>{formatCurrency(item.cost!, trip.currency)}</span>
                </div>
              ))}
              {day.items.filter((i) => i.cost).length === 0 && (
                <p className="text-xs text-gray-400">No costs</p>
              )}
            </div>
          );
        })}
      </div>

      {trip.days.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          <DollarSign size={32} className="mx-auto mb-2" />
          <p>No days or items to show</p>
        </div>
      )}
    </div>
  );
}
