import type { Day, ExchangeRatesState, Item, Money, Trip } from '../types';
import { getGlobalRateLimitedQueue, queuedJson } from './requestQueue';

export const FRANKFURTER_ENDPOINT = 'https://api.frankfurter.app';
const FRANKFURTER_QUEUE = getGlobalRateLimitedQueue('frankfurter', 1000);
const RATES_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type FrankfurterResponse = {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

const memoryRateCache = new Map<string, { expiresAt: number; data: ExchangeRatesState }>();

export function normalizeCurrencyCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function fetchExchangeRates(baseCurrency: string): Promise<ExchangeRatesState> {
  const base = normalizeCurrencyCode(baseCurrency);
  const cacheKey = base;
  const cached = memoryRateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = `${FRANKFURTER_ENDPOINT}/latest?from=${encodeURIComponent(base)}`;
  const response = await queuedJson<FrankfurterResponse>(FRANKFURTER_QUEUE, url, {
    headers: { Accept: 'application/json' },
    maxRetries: 2,
  });

  const rates: Record<string, number> = {};
  for (const [currency, rate] of Object.entries(response.rates ?? {})) {
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      rates[normalizeCurrencyCode(currency)] = rate;
    }
  }

  const data: ExchangeRatesState = {
    provider: 'frankfurter',
    base: normalizeCurrencyCode(response.base ?? base),
    rates,
    fetchedAt: Date.now(),
    manualOverrides: {},
    useManualRatesOnly: false,
  };
  memoryRateCache.set(cacheKey, { expiresAt: Date.now() + RATES_CACHE_TTL_MS, data });
  return data;
}

export function getEffectiveRates(state: ExchangeRatesState): Record<string, number> {
  const effective = { ...(state.rates ?? {}) };
  if (state.manualOverrides) {
    for (const [currency, rate] of Object.entries(state.manualOverrides)) {
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        effective[normalizeCurrencyCode(currency)] = rate;
      }
    }
  }
  return effective;
}

function toBaseAmount(amount: number, sourceCurrency: string, exchange: ExchangeRatesState): number | null {
  const source = normalizeCurrencyCode(sourceCurrency);
  const base = normalizeCurrencyCode(exchange.base);
  if (source === base) return amount;
  const effectiveRates = getEffectiveRates(exchange);
  if (exchange.useManualRatesOnly && !(source in (exchange.manualOverrides ?? {}))) {
    return null;
  }
  const sourceRate = effectiveRates[source];
  if (typeof sourceRate !== 'number' || !Number.isFinite(sourceRate) || sourceRate <= 0) return null;
  return amount / sourceRate;
}

export function convertAmount(args: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  exchange: ExchangeRatesState;
}): number | null {
  const from = normalizeCurrencyCode(args.fromCurrency);
  const to = normalizeCurrencyCode(args.toCurrency);
  if (from === to) return args.amount;

  const base = normalizeCurrencyCode(args.exchange.base);
  const effectiveRates = getEffectiveRates(args.exchange);

  if (base === from) {
    if (args.exchange.useManualRatesOnly && !(to in (args.exchange.manualOverrides ?? {}))) return null;
    const rate = effectiveRates[to];
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? args.amount * rate : null;
  }

  if (base === to) {
    return toBaseAmount(args.amount, from, args.exchange);
  }

  const amountInBase = toBaseAmount(args.amount, from, args.exchange);
  if (amountInBase == null) return null;
  if (args.exchange.useManualRatesOnly && !(to in (args.exchange.manualOverrides ?? {}))) return null;
  const targetRate = effectiveRates[to];
  if (typeof targetRate !== 'number' || !Number.isFinite(targetRate) || targetRate <= 0) return null;
  return amountInBase * targetRate;
}

export function convertMoney(money: Money, toCurrency: string, exchange: ExchangeRatesState): Money | null {
  const amount = convertAmount({
    amount: money.amount,
    fromCurrency: money.currency,
    toCurrency,
    exchange,
  });
  if (amount == null) return null;
  return { amount, currency: normalizeCurrencyCode(toCurrency) };
}

export function convertMoneyToBase(money: Money, exchange: ExchangeRatesState): Money | null {
  return convertMoney(money, exchange.base, exchange);
}

export function canConvertCurrency(fromCurrency: string, toCurrency: string, exchange: ExchangeRatesState): boolean {
  return convertAmount({ amount: 1, fromCurrency, toCurrency, exchange }) != null;
}

export function convertItemCostToBase(item: Pick<Item, 'cost'>, baseCurrency: string, exchange: ExchangeRatesState): number | null {
  if (!item.cost) return 0;
  return convertAmount({
    amount: item.cost.amount,
    fromCurrency: item.cost.currency,
    toCurrency: baseCurrency,
    exchange,
  });
}

export function summarizeDayCostsInBase(day: Pick<Day, 'items'>, baseCurrency: string, exchange: ExchangeRatesState) {
  let totalBase = 0;
  const missingRateItemIds: string[] = [];
  for (const item of day.items) {
    if (!item.cost) continue;
    const converted = convertItemCostToBase(item, baseCurrency, exchange);
    if (converted == null) {
      missingRateItemIds.push(item.id);
      continue;
    }
    totalBase += converted;
  }
  return { totalBase, missingRateItemIds };
}

export function summarizeTripCostsInBase(trip: Trip, exchange: ExchangeRatesState) {
  let totalBase = 0;
  const missingRateItemIds: string[] = [];
  for (const day of trip.days) {
    const summary = summarizeDayCostsInBase(day, trip.baseCurrency, exchange);
    totalBase += summary.totalBase;
    missingRateItemIds.push(...summary.missingRateItemIds);
  }
  return { totalBase, missingRateItemIds };
}
