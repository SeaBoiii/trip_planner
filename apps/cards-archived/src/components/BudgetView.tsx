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
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-extrabold text-gray-800 mb-1">{trip.name}</h2>
      <p className="text-3xl font-extrabold text-sky-600 mb-6">
        {formatCurrency(total, trip.currency)}
      </p>

      <div className="flex flex-col gap-4">
        {trip.days.map((day) => {
          const dt = dayTotal(day.items);
          const pct = total > 0 ? (dt / total) * 100 : 0;
          return (
            <div key={day.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-800">{day.label}</span>
                <span className="font-bold text-sky-600">{formatCurrency(dt, trip.currency)}</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {day.items.filter((i) => i.cost).map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-gray-600 py-0.5">
                  <span>{item.title}</span>
                  <span className="font-medium">{formatCurrency(item.cost!, trip.currency)}</span>
                </div>
              ))}
              {day.items.filter((i) => i.cost).length === 0 && (
                <p className="text-xs text-gray-300">No costs recorded</p>
              )}
            </div>
          );
        })}
      </div>

      {trip.days.length === 0 && (
        <div className="text-center text-gray-300 py-12">
          <DollarSign size={40} className="mx-auto mb-2" />
          <p>No data yet</p>
        </div>
      )}
    </div>
  );
}
