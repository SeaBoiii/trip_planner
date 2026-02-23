import React from 'react';
import type { ExchangeRatesState, Trip } from '@trip-planner/core';
import {
  formatCurrency,
  formatMoney,
  summarizeDayCostsInBase,
  summarizeTripCostsInBase,
  convertItemCostToBase,
} from '@trip-planner/core';
import { DollarSign, AlertTriangle } from 'lucide-react';

interface BudgetViewProps {
  trip: Trip;
  exchangeRates: ExchangeRatesState;
}

export function BudgetView({ trip, exchangeRates }: BudgetViewProps) {
  const tripSummary = summarizeTripCostsInBase(trip, exchangeRates);

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{trip.name} â€” Budget</h2>
      <p className="text-2xl font-bold text-blue-600 mb-1">
        {formatCurrency(tripSummary.totalBase, trip.baseCurrency)}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Totals shown in base currency ({trip.baseCurrency})
      </p>

      {tripSummary.missingRateItemIds.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle size={14} />
          {tripSummary.missingRateItemIds.length} item{tripSummary.missingRateItemIds.length !== 1 ? 's' : ''} excluded (missing FX rate).
        </div>
      )}

      <div className="flex flex-col gap-3">
        {trip.days.map((day) => {
          const daySummary = summarizeDayCostsInBase(day, trip.baseCurrency, exchangeRates);
          const costItems = day.items.filter((item) => item.cost);
          return (
            <div key={day.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{day.label}</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(daySummary.totalBase, trip.baseCurrency)}
                </span>
              </div>

              {costItems.map((item) => {
                const converted = convertItemCostToBase(item, trip.baseCurrency, exchangeRates);
                return (
                  <div key={item.id} className="flex justify-between items-start gap-3 text-xs text-gray-600 dark:text-gray-400 py-0.5">
                    <span className="truncate">{item.title}</span>
                    <span className="text-right shrink-0">
                      <span>{formatMoney(item.cost!)}</span>
                      {converted != null && item.cost!.currency !== trip.baseCurrency && (
                        <span className="ml-1 text-gray-500 dark:text-gray-500">
                          ({formatCurrency(converted, trip.baseCurrency)})
                        </span>
                      )}
                      {converted == null && (
                        <span className="ml-1 text-amber-600 dark:text-amber-300">(missing rate)</span>
                      )}
                    </span>
                  </div>
                );
              })}

              {costItems.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">No costs</p>
              )}
            </div>
          );
        })}
      </div>

      {trip.days.length === 0 && (
        <div className="text-center text-gray-400 dark:text-gray-500 py-12">
          <DollarSign size={32} className="mx-auto mb-2" />
          <p>No days or items to show</p>
        </div>
      )}
    </div>
  );
}
