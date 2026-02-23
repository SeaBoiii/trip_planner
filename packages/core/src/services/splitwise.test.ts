import { describe, expect, it } from 'vitest';
import type { ExchangeRatesState, Trip } from '../types';
import { computeSplitBalances } from './splitwise';

const exchange: ExchangeRatesState = {
  provider: 'frankfurter',
  base: 'USD',
  rates: {},
  manualOverrides: {},
  useManualRatesOnly: false,
  fetchedAt: Date.now(),
};

function sampleTrip(): Trip {
  return {
    id: 'trip1',
    name: 'Test Trip',
    baseCurrency: 'USD',
    participants: [
      { id: 'a', name: 'Alex' },
      { id: 'b', name: 'Blair' },
      { id: 'c', name: 'Casey' },
    ],
    travelDefaults: { mode: 'WALK', trafficAware: false },
    days: [
      {
        id: 'd1',
        label: 'Day 1',
        items: [
          {
            id: 'i1',
            title: 'Dinner',
            cost: { amount: 90, currency: 'USD' },
            payment: {
              paidByParticipantId: 'a',
              split: { type: 'equal', participantIds: ['a', 'b', 'c'] },
            },
            tags: [],
          },
          {
            id: 'i2',
            title: 'Taxi',
            cost: { amount: 30, currency: 'USD' },
            payment: {
              paidByParticipantId: 'b',
              split: { type: 'shares', shares: { a: 1, b: 1 } },
            },
            tags: [],
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('splitwise calculations', () => {
  it('computes net balances and suggested settlements', () => {
    const result = computeSplitBalances(sampleTrip(), exchange);
    const alex = result.balances.find((balance) => balance.participantId === 'a');
    const blair = result.balances.find((balance) => balance.participantId === 'b');
    const casey = result.balances.find((balance) => balance.participantId === 'c');

    expect(alex?.netBase).toBeCloseTo(45, 2); // paid 90, owes 45
    expect(blair?.netBase).toBeCloseTo(-15, 2); // owes dinner share minus taxi payment
    expect(casey?.netBase).toBeCloseTo(-30, 2); // owes dinner share only

    expect(result.settlements).toEqual([
      { fromParticipantId: 'c', toParticipantId: 'a', amountBase: 30 },
      { fromParticipantId: 'b', toParticipantId: 'a', amountBase: 15 },
    ]);
  });
});
