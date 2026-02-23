import { describe, expect, it } from 'vitest';
import type { ExchangeRatesState } from '../types';
import { convertAmount, convertMoneyToBase } from './exchangeRates';

const usdBaseRates: ExchangeRatesState = {
  provider: 'frankfurter',
  base: 'USD',
  rates: { EUR: 0.9, JPY: 150 },
  manualOverrides: {},
  useManualRatesOnly: false,
  fetchedAt: Date.now(),
};

describe('exchangeRates conversion', () => {
  it('converts via base currency', () => {
    const amount = convertAmount({
      amount: 100,
      fromCurrency: 'EUR',
      toCurrency: 'JPY',
      exchange: usdBaseRates,
    });
    expect(amount).not.toBeNull();
    expect(amount!).toBeCloseTo((100 / 0.9) * 150, 4);
  });

  it('returns null when rate missing', () => {
    const amount = convertAmount({
      amount: 50,
      fromCurrency: 'GBP',
      toCurrency: 'USD',
      exchange: usdBaseRates,
    });
    expect(amount).toBeNull();
  });

  it('applies manual overrides', () => {
    const exchange: ExchangeRatesState = {
      ...usdBaseRates,
      manualOverrides: { EUR: 0.8 },
    };
    const converted = convertMoneyToBase({ amount: 80, currency: 'EUR' }, exchange);
    expect(converted?.amount).toBeCloseTo(100, 6);
  });
});
