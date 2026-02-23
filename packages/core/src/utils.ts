import type { Money } from './types';

export function nanoid(size = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i += 1) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function moneyAmount(value?: Money | null): number {
  return value?.amount ?? 0;
}

export function dayTotal(items: { cost?: Money }[]): number {
  return items.reduce((sum, item) => sum + moneyAmount(item.cost), 0);
}

export function tripTotal(days: { items: { cost?: Money }[] }[]): number {
  return days.reduce((sum, day) => sum + dayTotal(day.items), 0);
}

export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    SGD: 'S$',
    USD: '$',
    EUR: 'EUR ',
    GBP: 'GBP ',
    JPY: 'JPY ',
    KRW: 'KRW ',
    THB: 'THB ',
    MYR: 'RM',
    AUD: 'A$',
    CAD: 'C$',
    NZD: 'NZ$',
    PHP: 'PHP ',
    IDR: 'IDR ',
    VND: 'VND ',
    TWD: 'TWD ',
    HKD: 'HK$',
    CNY: 'CNY ',
    INR: 'INR ',
  };
  const sym = symbols[currency] ?? `${currency} `;
  return `${sym}${amount.toFixed(2)}`;
}

export function formatMoney(money: Money): string {
  return formatCurrency(money.amount, money.currency);
}

export const CURRENCIES = [
  'SGD', 'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'THB', 'MYR',
  'AUD', 'CAD', 'NZD', 'PHP', 'IDR', 'VND', 'TWD', 'HKD', 'CNY', 'INR',
];
