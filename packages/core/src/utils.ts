// Simple ID generator (no external dependency needed)
export function nanoid(size = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

// Deep clone helper
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Sum costs for a day
export function dayTotal(items: { cost?: number }[]): number {
  return items.reduce((sum, item) => sum + (item.cost ?? 0), 0);
}

// Sum costs for a trip
export function tripTotal(days: { items: { cost?: number }[] }[]): number {
  return days.reduce((sum, day) => sum + dayTotal(day.items), 0);
}

// Format currency
export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    SGD: 'S$',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    KRW: '₩',
    THB: '฿',
    MYR: 'RM',
    AUD: 'A$',
    CAD: 'C$',
    NZD: 'NZ$',
    PHP: '₱',
    IDR: 'Rp',
    VND: '₫',
    TWD: 'NT$',
    HKD: 'HK$',
    CNY: '¥',
    INR: '₹',
  };
  const sym = symbols[currency] ?? currency + ' ';
  return `${sym}${amount.toFixed(2)}`;
}

// Common currencies list
export const CURRENCIES = [
  'SGD', 'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'THB', 'MYR',
  'AUD', 'CAD', 'NZD', 'PHP', 'IDR', 'VND', 'TWD', 'HKD', 'CNY', 'INR',
];
