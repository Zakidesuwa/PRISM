// src/utils/formatters.ts

/**
 * Standardized Philippine Peso (₱) currency formatter.
 * Handles numbers, strings, and Prisma Decimal objects.
 */
export function formatCurrency(amount: number | string | { toString: () => string } | null | undefined): string {
  if (amount === null || amount === undefined) return '₱0.00';
  
  const num = typeof amount === 'number' ? amount : parseFloat(amount.toString());
  if (isNaN(num)) return '₱0.00';

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Standardized Date Formatter localized to Asia/Manila.
 */
export function formatManilaDate(date: Date | string | number): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Standardized Date + Time Formatter localized to Asia/Manila.
 */
export function formatManilaDateTime(date: Date | string | number): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Standardized Time Formatter localized to Asia/Manila.
 */
export function formatManilaTime(date: Date | string | number): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}
