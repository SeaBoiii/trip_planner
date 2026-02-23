import React, { useMemo, useState } from 'react';
import type { ExchangeRatesState, Participant, Trip } from '@trip-planner/core';
import { computeSplitBalances, formatCurrency, nanoid } from '@trip-planner/core';
import { Button, Input } from '@trip-planner/ui';
import { Plus, Trash2, Users, ArrowRight } from 'lucide-react';

interface SplitViewProps {
  trip: Trip;
  exchangeRates: ExchangeRatesState;
  onUpdateTrip: (updates: Partial<Pick<Trip, 'participants'>>) => void;
}

function isParticipantReferenced(trip: Trip, participantId: string) {
  for (const day of trip.days) {
    for (const item of day.items) {
      const payment = item.payment;
      if (!payment) continue;
      if (payment.paidByParticipantId === participantId) return true;
      const split = payment.split;
      if (split.type === 'equal' && split.participantIds.includes(participantId)) return true;
      if (split.type === 'shares' && participantId in split.shares) return true;
      if (split.type === 'exact' && participantId in split.amounts) return true;
    }
  }
  return false;
}

export function SplitView({ trip, exchangeRates, onUpdateTrip }: SplitViewProps) {
  const [newParticipantName, setNewParticipantName] = useState('');
  const result = useMemo(() => computeSplitBalances(trip, exchangeRates), [trip, exchangeRates]);

  const addParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) return;
    const next: Participant[] = [...trip.participants, { id: nanoid(), name }];
    onUpdateTrip({ participants: next });
    setNewParticipantName('');
  };

  const renameParticipant = (participantId: string, name: string) => {
    onUpdateTrip({
      participants: trip.participants.map((participant) =>
        participant.id === participantId ? { ...participant, name } : participant
      ),
    });
  };

  const removeParticipant = (participantId: string) => {
    const referenced = isParticipantReferenced(trip, participantId);
    if (referenced && !window.confirm('This participant is referenced by item payments. Remove anyway?')) {
      return;
    }
    onUpdateTrip({
      participants: trip.participants.filter((participant) => participant.id !== participantId),
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Split Expenses</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Base currency: {trip.baseCurrency}
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Participants</h3>
        </div>

        <div className="flex gap-2">
          <Input
            label="Add participant"
            placeholder="e.g., Alex"
            value={newParticipantName}
            onChange={(e) => setNewParticipantName(e.target.value)}
          />
          <div className="pt-6">
            <Button type="button" size="sm" onClick={addParticipant} disabled={!newParticipantName.trim()}>
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {trip.participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-2">
              <input
                value={participant.name}
                onChange={(e) => renameParticipant(participant.id, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => removeParticipant(participant.id)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                aria-label="Remove participant"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {trip.participants.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Add participants to start splitting expenses.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Net Balances</h3>
        <div className="space-y-2">
          {result.balances.map((balance) => (
            <div key={balance.participantId} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-gray-800 dark:text-gray-200">{balance.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Paid {formatCurrency(balance.paidBase, trip.baseCurrency)} • Owes {formatCurrency(balance.owedBase, trip.baseCurrency)}
                </p>
              </div>
              <span className={`font-semibold ${balance.netBase >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {balance.netBase >= 0 ? '+' : ''}
                {formatCurrency(balance.netBase, trip.baseCurrency)}
              </span>
            </div>
          ))}
          {result.balances.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">No participants yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Suggested Settlements</h3>
        <div className="space-y-2">
          {result.settlements.map((settlement, index) => {
            const from = trip.participants.find((participant) => participant.id === settlement.fromParticipantId)?.name ?? settlement.fromParticipantId;
            const to = trip.participants.find((participant) => participant.id === settlement.toParticipantId)?.name ?? settlement.toParticipantId;
            return (
              <div key={`${settlement.fromParticipantId}-${settlement.toParticipantId}-${index}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span>{from}</span>
                  <ArrowRight size={12} className="text-gray-400" />
                  <span>{to}</span>
                </div>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {formatCurrency(settlement.amountBase, trip.baseCurrency)}
                </span>
              </div>
            );
          })}
          {result.settlements.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">No settlements needed (or no split expenses yet).</p>
          )}
        </div>
      </section>

      {(result.skippedItems.length > 0 || result.warnings.length > 0) && (
        <section className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
          <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">Warnings</h3>
          {result.skippedItems.map((item) => (
            <p key={item.itemId} className="text-xs text-amber-800 dark:text-amber-300">
              Skipped item {item.itemId}: {item.reason}
            </p>
          ))}
          {result.warnings.map((warning, index) => (
            <p key={index} className="text-xs text-amber-800 dark:text-amber-300">{warning}</p>
          ))}
        </section>
      )}
    </div>
  );
}
