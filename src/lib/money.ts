// src/lib/money.ts
// Server-side money helpers. Amounts are Prisma.Decimal until they cross to
// the client, where they become plain numbers for display only.
import { Prisma } from '@prisma/client';

export type Dec = Prisma.Decimal;
export const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const ZERO = new Prisma.Decimal(0);

export const round2 = (value: Dec) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const num = (value: Dec | null | undefined) => (value ? value.toNumber() : 0);

function clean(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.replace(/[₱,\s]/g, '') : '';
}

/** Validates user input as a money amount (two decimals at most). */
export function toAmount(value: unknown, label: string, options?: { allowZero?: boolean }): Dec {
  const text = clean(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error(`${label} must be a valid amount.`);
  const amount = new Prisma.Decimal(text);
  if (!options?.allowZero && amount.lte(0)) throw new Error(`${label} must be greater than zero.`);
  return amount;
}

/** Validates user input as a quantity (three decimals at most). */
export function toQuantity(value: unknown, label: string, options?: { allowZero?: boolean }): Dec {
  const text = clean(value);
  if (!/^\d+(\.\d{1,3})?$/.test(text)) throw new Error(`${label} must be a valid quantity.`);
  const quantity = new Prisma.Decimal(text);
  if (!options?.allowZero && quantity.lte(0)) throw new Error(`${label} must be greater than zero.`);
  return quantity;
}

export function requireText(value: unknown, label: string, max = 120): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} is too long.`);
  return text;
}

export function optionalText(value: unknown, max = 200): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
}
