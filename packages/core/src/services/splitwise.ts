import type { ExchangeRatesState, Item, Money, Participant, Trip } from '../types';
import { convertAmount } from './exchangeRates';

export interface ParticipantBalance {
  participantId: string;
  name: string;
  paidBase: number;
  owedBase: number;
  netBase: number;
}

export interface SettlementTransfer {
  fromParticipantId: string;
  toParticipantId: string;
  amountBase: number;
}

export interface SplitComputationResult {
  balances: ParticipantBalance[];
  settlements: SettlementTransfer[];
  skippedItems: Array<{ itemId: string; reason: string }>;
  warnings: string[];
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function convertToTripBase(money: Money, trip: Trip, rates: ExchangeRatesState): number | null {
  const converted = convertAmount({
    amount: money.amount,
    fromCurrency: money.currency,
    toCurrency: trip.baseCurrency,
    exchange: rates,
  });
  return converted == null ? null : roundCents(converted);
}

function equalSplit(total: number, participantIds: string[]): Record<string, number> {
  const ids = participantIds.filter(Boolean);
  if (ids.length === 0) return {};
  const each = roundCents(total / ids.length);
  const amounts: Record<string, number> = {};
  let assigned = 0;
  ids.forEach((id, index) => {
    const amount = index === ids.length - 1 ? roundCents(total - assigned) : each;
    amounts[id] = amount;
    assigned = roundCents(assigned + amount);
  });
  return amounts;
}

function shareSplit(total: number, shares: Record<string, number>): Record<string, number> {
  const entries = Object.entries(shares).filter(([, share]) => share > 0);
  const shareTotal = entries.reduce((sum, [, share]) => sum + share, 0);
  if (shareTotal <= 0) return {};
  const result: Record<string, number> = {};
  let assigned = 0;
  entries.forEach(([id, share], index) => {
    const raw = total * (share / shareTotal);
    const amount = index === entries.length - 1 ? roundCents(total - assigned) : roundCents(raw);
    result[id] = amount;
    assigned = roundCents(assigned + amount);
  });
  return result;
}

function exactSplitToBase(
  exactAmounts: Record<string, Money>,
  trip: Trip,
  rates: ExchangeRatesState
): { amounts: Record<string, number>; warning?: string } | null {
  const converted: Record<string, number> = {};
  for (const [participantId, money] of Object.entries(exactAmounts)) {
    const base = convertToTripBase(money, trip, rates);
    if (base == null) {
      return null;
    }
    converted[participantId] = base;
  }
  return { amounts: converted };
}

function getItemSplitAmountsInBase(item: Item, trip: Trip, rates: ExchangeRatesState): { totalBase: number; owedByParticipant: Record<string, number> } | null {
  if (!item.cost || !item.payment) return null;
  const totalBase = convertToTripBase(item.cost, trip, rates);
  if (totalBase == null) return null;

  const split = item.payment.split;
  if (split.type === 'equal') {
    return { totalBase, owedByParticipant: equalSplit(totalBase, split.participantIds) };
  }
  if (split.type === 'shares') {
    return { totalBase, owedByParticipant: shareSplit(totalBase, split.shares) };
  }
  const exact = exactSplitToBase(split.amounts, trip, rates);
  if (!exact) return null;

  const sumExact = roundCents(Object.values(exact.amounts).reduce((sum, amount) => sum + amount, 0));
  if (sumExact <= 0) {
    return { totalBase, owedByParticipant: {} };
  }
  if (Math.abs(sumExact - totalBase) < 0.01) {
    return { totalBase, owedByParticipant: exact.amounts };
  }
  // Normalize exact amounts proportionally so balances settle exactly to item total.
  const scaled: Record<string, number> = {};
  let assigned = 0;
  const entries = Object.entries(exact.amounts);
  entries.forEach(([id, amount], index) => {
    const scaledAmount =
      index === entries.length - 1
        ? roundCents(totalBase - assigned)
        : roundCents((amount / sumExact) * totalBase);
    scaled[id] = scaledAmount;
    assigned = roundCents(assigned + scaledAmount);
  });
  return { totalBase, owedByParticipant: scaled };
}

export function computeSplitBalances(trip: Trip, rates: ExchangeRatesState): SplitComputationResult {
  const participantsById = new Map<string, Participant>(trip.participants.map((participant) => [participant.id, participant]));
  const balances = new Map<string, { paidBase: number; owedBase: number }>();
  const skippedItems: Array<{ itemId: string; reason: string }> = [];
  const warnings: string[] = [];

  const ensureParticipant = (participantId: string) => {
    if (!balances.has(participantId)) {
      balances.set(participantId, { paidBase: 0, owedBase: 0 });
    }
  };

  for (const day of trip.days) {
    for (const item of day.items) {
      if (!item.payment || !item.cost) continue;
      const payerId = item.payment.paidByParticipantId;
      if (!participantsById.has(payerId)) {
        skippedItems.push({ itemId: item.id, reason: 'Missing payer participant' });
        continue;
      }

      const split = getItemSplitAmountsInBase(item, trip, rates);
      if (!split) {
        skippedItems.push({ itemId: item.id, reason: 'Missing conversion rate or invalid split' });
        continue;
      }

      ensureParticipant(payerId);
      const payer = balances.get(payerId)!;
      payer.paidBase = roundCents(payer.paidBase + split.totalBase);

      for (const [participantId, owed] of Object.entries(split.owedByParticipant)) {
        if (!participantsById.has(participantId)) {
          warnings.push(`Item "${item.title}" references unknown participant "${participantId}"`);
          continue;
        }
        ensureParticipant(participantId);
        const entry = balances.get(participantId)!;
        entry.owedBase = roundCents(entry.owedBase + owed);
      }
    }
  }

  const outputBalances: ParticipantBalance[] = trip.participants.map((participant) => {
    const entry = balances.get(participant.id) ?? { paidBase: 0, owedBase: 0 };
    return {
      participantId: participant.id,
      name: participant.name,
      paidBase: roundCents(entry.paidBase),
      owedBase: roundCents(entry.owedBase),
      netBase: roundCents(entry.paidBase - entry.owedBase),
    };
  });

  return {
    balances: outputBalances,
    settlements: suggestSettlements(outputBalances),
    skippedItems,
    warnings,
  };
}

export function suggestSettlements(balances: Array<Pick<ParticipantBalance, 'participantId' | 'netBase'>>): SettlementTransfer[] {
  const creditors = balances
    .filter((balance) => balance.netBase > 0.009)
    .map((balance) => ({ participantId: balance.participantId, amount: roundCents(balance.netBase) }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((balance) => balance.netBase < -0.009)
    .map((balance) => ({ participantId: balance.participantId, amount: roundCents(Math.abs(balance.netBase)) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c];
    const debtor = debtors[d];
    const amount = roundCents(Math.min(creditor.amount, debtor.amount));
    if (amount > 0) {
      transfers.push({
        fromParticipantId: debtor.participantId,
        toParticipantId: creditor.participantId,
        amountBase: amount,
      });
      creditor.amount = roundCents(creditor.amount - amount);
      debtor.amount = roundCents(debtor.amount - amount);
    }
    if (creditor.amount <= 0.009) c += 1;
    if (debtor.amount <= 0.009) d += 1;
  }
  return transfers;
}
