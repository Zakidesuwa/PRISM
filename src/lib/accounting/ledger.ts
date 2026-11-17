// src/lib/accounting/ledger.ts
//
// Double-entry rules: what makes a journal entry valid, and the entries the
// system posts on its own (POS sales, voids, cash over/short). Pure and
// isomorphic. Money is handled as integer centavos internally, like the
// Daily Sales module, so debits and credits always tie to the centavo.

import type { AccountType, SystemAccountKey } from './chartOfAccounts';

export const toCents = (pesos: number): number => Math.round(pesos * 100);
export const toPesos = (cents: number): number => cents / 100;

/** Largest single amount accepted on a journal line (₱10 billion). */
const MAX_LINE_CENTS = 1_000_000_000_000;

// ─── Journal entry validation ────────────────────────────────────────────────

export interface JournalLineInput {
  accountId: number;
  debit: number; // pesos
  credit: number; // pesos
  memo?: string | null;
}

export interface AccountRef {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  isActive: boolean;
}

/** Has at most two decimal places (no fractions of a centavo). */
function isWholeCentavos(pesos: number): boolean {
  return Math.abs(pesos * 100 - Math.round(pesos * 100)) < 1e-6;
}

/** Returns an error message, or null when the lines form a valid entry. */
export function validateJournalLines(lines: JournalLineInput[], accounts: Map<number, AccountRef>): string | null {
  if (!Array.isArray(lines) || lines.length < 2) return 'A journal entry needs at least two lines.';

  let debitCents = 0;
  let creditCents = 0;
  for (const [i, line] of lines.entries()) {
    const n = i + 1;
    const account = accounts.get(line.accountId);
    if (!account) return `Line ${n}: choose an account.`;
    if (!account.isActive) return `Line ${n}: account ${account.code} ${account.name} is inactive.`;

    const { debit, credit } = line;
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
      return `Line ${n}: amounts must be zero or positive numbers.`;
    }
    if (!isWholeCentavos(debit) || !isWholeCentavos(credit)) {
      return `Line ${n}: amounts can have at most two decimal places.`;
    }
    if ((debit > 0) === (credit > 0)) {
      return `Line ${n}: enter either a debit or a credit, not both or neither.`;
    }
    const cents = toCents(debit || credit);
    if (cents > MAX_LINE_CENTS) return `Line ${n}: amount is too large.`;
    debitCents += toCents(debit);
    creditCents += toCents(credit);
  }

  if (debitCents !== creditCents) {
    return `Debits (${(debitCents / 100).toFixed(2)}) and credits (${(creditCents / 100).toFixed(2)}) must be equal.`;
  }
  if (new Set(lines.map((l) => l.accountId)).size < 2) {
    return 'A journal entry must involve at least two different accounts.';
  }
  return null;
}

// ─── System-generated entries ────────────────────────────────────────────────

/** A line addressed by system account key instead of account id. */
export interface SystemLine {
  key: SystemAccountKey;
  debit: number; // pesos
  credit: number; // pesos
  memo?: string;
}

export interface SaleItemForPosting {
  subtotal: number; // pesos, net of tax
  vendorId: number | null;
  /** Coop's share in percent for consigned goods; null = coop-owned item. */
  coopSharePercent: number | null;
}

export interface SaleForPosting {
  totalAmount: number; // tax-inclusive cash received
  taxAmount: number;
  items: SaleItemForPosting[];
  /** Cost of the raw materials the sale consumed, per product recipes. */
  costOfGoodsSold: number;
}

/** Coop's share of a consigned line, rounded to the centavo (same rule as the vendor split). */
export function coopShareCents(subtotalCents: number, coopSharePercent: number): number {
  const bps = Math.round(coopSharePercent * 100);
  return Math.round((subtotalCents * bps) / 10000);
}

function line(key: SystemAccountKey, side: 'debit' | 'credit', cents: number, memo?: string): SystemLine {
  return {
    key,
    debit: side === 'debit' ? toPesos(cents) : 0,
    credit: side === 'credit' ? toPesos(cents) : 0,
    ...(memo ? { memo } : {}),
  };
}

/**
 * Journal lines for one completed POS sale:
 *   Dr Cash on Hand                 total collected
 *     Cr Canteen Sales              coop-owned goods, net of tax
 *     Cr Concession Commission      coop's share of consigned goods
 *     Cr Due to Concessionaires     vendors' share of consigned goods
 *     Cr Output Tax Payable         tax collected
 *   Dr Cost of Goods Sold / Cr Inventory   at recipe cost
 */
export function buildSaleEntryLines(sale: SaleForPosting): SystemLine[] {
  let salesCents = 0;
  let commissionCents = 0;
  let vendorCents = 0;

  for (const item of sale.items) {
    const cents = toCents(item.subtotal);
    if (item.vendorId === null || item.coopSharePercent === null) {
      salesCents += cents;
    } else {
      const coop = coopShareCents(cents, item.coopSharePercent);
      commissionCents += coop;
      vendorCents += cents - coop;
    }
  }

  const taxCents = toCents(sale.taxAmount);
  const totalCents = toCents(sale.totalAmount);
  if (salesCents + commissionCents + vendorCents + taxCents !== totalCents) {
    throw new Error(
      `Sale does not balance: items ${(salesCents + commissionCents + vendorCents) / 100} + tax ${taxCents / 100} ≠ total ${totalCents / 100}.`
    );
  }

  const cogsCents = toCents(sale.costOfGoodsSold);
  const lines: SystemLine[] = [
    line('CASH_ON_HAND', 'debit', totalCents),
    line('SALES', 'credit', salesCents),
    line('COMMISSION_INCOME', 'credit', commissionCents),
    line('VENDOR_PAYABLE', 'credit', vendorCents),
    line('SALES_TAX_PAYABLE', 'credit', taxCents),
    line('COST_OF_GOODS_SOLD', 'debit', cogsCents),
    line('INVENTORY', 'credit', cogsCents),
  ];
  return lines.filter((l) => l.debit > 0 || l.credit > 0);
}

/** Cash over: Dr Cash / Cr Cash Overage. Short: Dr Cash Shortage / Cr Cash. Balanced: nothing. */
export function buildCashCountEntryLines(variance: number): SystemLine[] {
  const cents = toCents(variance);
  if (cents > 0) return [line('CASH_ON_HAND', 'debit', cents), line('CASH_OVERAGE', 'credit', cents)];
  if (cents < 0) return [line('CASH_SHORTAGE', 'debit', -cents), line('CASH_ON_HAND', 'credit', -cents)];
  return [];
}

/** Mirror image of an entry: every debit becomes a credit and vice versa. */
export function reverseLines<T extends { debit: number; credit: number }>(lines: T[]): T[] {
  return lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
}

// ─── Inventory costing ───────────────────────────────────────────────────────

/**
 * Inventory items are priced per purchase package ("Box of 50" at ₱4,250) but
 * stocked and consumed per unit (1 patty). Cost per unit = price / package size.
 * "Box of 50" → 50, "Pack of 12" → 12, "1kg Bag" → 1. Unknown formats → 1.
 */
export function packageSize(packaging: string | null | undefined): number {
  const text = packaging ?? '';
  const of = /\bof\s+(\d+(?:\.\d+)?)/i.exec(text);
  if (of) return Number(of[1]) || 1;
  const leading = /^\s*(\d+(?:\.\d+)?)\s*(?:kg|l|pcs?|bottles?)\b/i.exec(text);
  if (leading) return Number(leading[1]) || 1;
  return 1;
}

export function unitCost(price: number, packaging: string | null | undefined): number {
  return price / packageSize(packaging);
}

export interface RecipeLineForCosting {
  quantityRequired: number; // units of the inventory item per product sold
  price: number; // inventory item price per package
  packaging: string | null;
}

/** Cost of goods sold for a sale, rounded to the centavo. */
export function costOfGoodsSold(items: { quantity: number; recipe: RecipeLineForCosting[] }[]): number {
  let pesos = 0;
  for (const item of items) {
    for (const r of item.recipe) pesos += item.quantity * r.quantityRequired * unitCost(r.price, r.packaging);
  }
  return toPesos(Math.round(pesos * 100));
}
