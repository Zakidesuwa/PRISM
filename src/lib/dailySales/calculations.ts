// src/lib/dailySales/calculations.ts
//
// Pure, isomorphic calculations behind the Daily Sales & Reconciliation module.
// The service layer feeds these with database rows; the demo fallback feeds them
// with generated rows; the cash-count form uses them for its live preview. One
// implementation means the screen, the stored record and the test script can
// never disagree.
//
// All money is handled internally as integer centavos to avoid floating-point
// drift (0.1 + 0.2 !== 0.3). Results are returned in pesos.

import { manilaHour } from './businessDate';

// ─── Input shape ─────────────────────────────────────────────────────────────

export interface SaleItemRow {
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  subtotal: number; // pesos, net of tax
  vendorId: number | null;
  vendorName: string | null;
  /** Coop's share of this line, in percent. null = coop-owned (100%). */
  coopSharePercent: number | null;
}

export interface SaleTransactionRow {
  transactionNumber: string;
  createdAt: Date;
  cashierId: string;
  cashierName: string;
  memberId: number | null;
  paymentMethod: string;
  status: string; // COMPLETED | VOIDED
  subtotal: number; // pesos, net of tax
  taxAmount: number;
  totalAmount: number; // pesos, tax-inclusive — what the customer handed over
  items: SaleItemRow[];
}

// ─── Money helpers ───────────────────────────────────────────────────────────

export const toCents = (pesos: number): number => Math.round(pesos * 100);
export const toPesos = (cents: number): number => cents / 100;

const isCompleted = (t: SaleTransactionRow) => t.status === 'COMPLETED';
const isVoided = (t: SaleTransactionRow) => t.status === 'VOIDED';
const sumCents = (values: number[]) => values.reduce((acc, v) => acc + toCents(v), 0);

/** Orders by sale time, then by transaction number for identical timestamps. */
function chronological(rows: SaleTransactionRow[]) {
  return [...rows].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.transactionNumber.localeCompare(b.transactionNumber, undefined, { numeric: true })
  );
}

// ─── Sales reading (X / Z) figures ───────────────────────────────────────────

export interface ReadingFigures {
  transactionCount: number;
  firstTransactionNo: string | null;
  lastTransactionNo: string | null;
  grossSales: number; // tax-inclusive
  netSales: number; // net of tax
  taxAmount: number;
  voidCount: number;
  voidAmount: number;
}

export function computeReadingFigures(rows: SaleTransactionRow[]): ReadingFigures {
  const completed = chronological(rows.filter(isCompleted));
  const voided = rows.filter(isVoided);

  return {
    transactionCount: completed.length,
    firstTransactionNo: completed[0]?.transactionNumber ?? null,
    lastTransactionNo: completed[completed.length - 1]?.transactionNumber ?? null,
    grossSales: toPesos(sumCents(completed.map((t) => t.totalAmount))),
    netSales: toPesos(sumCents(completed.map((t) => t.subtotal))),
    taxAmount: toPesos(sumCents(completed.map((t) => t.taxAmount))),
    voidCount: voided.length,
    voidAmount: toPesos(sumCents(voided.map((t) => t.totalAmount))),
  };
}

// ─── Daily sales summary ─────────────────────────────────────────────────────

export interface HourlyBucket {
  hour: number; // 0–23, Manila time
  sales: number;
  transactions: number;
}

export interface ProductSalesLine {
  productId: number;
  name: string;
  category: string;
  quantity: number;
  sales: number; // net of tax
}

export interface CategorySalesLine {
  category: string;
  quantity: number;
  sales: number;
}

export interface CashierSalesLine {
  cashierId: string;
  cashierName: string;
  transactions: number;
  sales: number; // tax-inclusive (cash collected)
}

export interface DailySalesSummary extends ReadingFigures {
  averageTicket: number;
  itemsSold: number;
  memberSales: number;
  memberTransactions: number;
  walkInSales: number;
  hourly: HourlyBucket[];
  topProducts: ProductSalesLine[];
  categories: CategorySalesLine[];
  cashiers: CashierSalesLine[];
}

export function computeDailySummary(rows: SaleTransactionRow[], topN = 8): DailySalesSummary {
  const figures = computeReadingFigures(rows);
  const completed = rows.filter(isCompleted);

  // Hourly — contiguous span from first to last active hour, so the chart has no gaps.
  const hourMap = new Map<number, { cents: number; count: number }>();
  for (const t of completed) {
    const h = manilaHour(t.createdAt);
    const b = hourMap.get(h) ?? { cents: 0, count: 0 };
    b.cents += toCents(t.totalAmount);
    b.count += 1;
    hourMap.set(h, b);
  }
  const hours = [...hourMap.keys()];
  const hourly: HourlyBucket[] = [];
  if (hours.length > 0) {
    for (let h = Math.min(...hours); h <= Math.max(...hours); h++) {
      const b = hourMap.get(h);
      hourly.push({ hour: h, sales: toPesos(b?.cents ?? 0), transactions: b?.count ?? 0 });
    }
  }

  // Products & categories
  const productMap = new Map<number, { name: string; category: string; qty: number; cents: number }>();
  const categoryMap = new Map<string, { qty: number; cents: number }>();
  let itemsSold = 0;
  for (const t of completed) {
    for (const i of t.items) {
      itemsSold += i.quantity;
      const p = productMap.get(i.productId) ?? { name: i.productName, category: i.category, qty: 0, cents: 0 };
      p.qty += i.quantity;
      p.cents += toCents(i.subtotal);
      productMap.set(i.productId, p);

      const c = categoryMap.get(i.category) ?? { qty: 0, cents: 0 };
      c.qty += i.quantity;
      c.cents += toCents(i.subtotal);
      categoryMap.set(i.category, c);
    }
  }

  const topProducts = [...productMap.entries()]
    .map(([productId, p]) => ({ productId, name: p.name, category: p.category, quantity: p.qty, sales: toPesos(p.cents) }))
    .sort((a, b) => b.sales - a.sales || b.quantity - a.quantity)
    .slice(0, topN);

  const categories = [...categoryMap.entries()]
    .map(([category, c]) => ({ category, quantity: c.qty, sales: toPesos(c.cents) }))
    .sort((a, b) => b.sales - a.sales);

  // Cashiers
  const cashierMap = new Map<string, { name: string; count: number; cents: number }>();
  for (const t of completed) {
    const c = cashierMap.get(t.cashierId) ?? { name: t.cashierName, count: 0, cents: 0 };
    c.count += 1;
    c.cents += toCents(t.totalAmount);
    cashierMap.set(t.cashierId, c);
  }
  const cashiers = [...cashierMap.entries()]
    .map(([cashierId, c]) => ({ cashierId, cashierName: c.name, transactions: c.count, sales: toPesos(c.cents) }))
    .sort((a, b) => b.sales - a.sales);

  const memberRows = completed.filter((t) => t.memberId !== null);
  const memberCents = sumCents(memberRows.map((t) => t.totalAmount));
  const grossCents = toCents(figures.grossSales);

  return {
    ...figures,
    averageTicket: figures.transactionCount ? toPesos(Math.round(grossCents / figures.transactionCount)) : 0,
    itemsSold,
    memberSales: toPesos(memberCents),
    memberTransactions: memberRows.length,
    walkInSales: toPesos(grossCents - memberCents),
    hourly,
    topProducts,
    categories,
    cashiers,
  };
}

// ─── Vendor split ────────────────────────────────────────────────────────────

export interface VendorSplitLine {
  vendorId: number | null; // null = coop-owned goods
  vendorName: string;
  coopSharePercent: number;
  itemsSold: number;
  netSales: number;
  coopShare: number;
  vendorPayable: number;
}

export interface VendorSplitResult {
  lines: VendorSplitLine[];
  totals: { itemsSold: number; netSales: number; coopShare: number; vendorPayable: number };
}

export const COOP_OWNED_LABEL = 'Coop-owned goods';

/**
 * Splits the day's net (pre-tax) sales between the coop and each vendor.
 *
 * Lines are grouped by vendor *and* by the share percent snapshotted on each
 * sale, so a rate change mid-day settles each portion at the rate in force when
 * it was sold. The coop share is rounded once per group (half-up, to the
 * centavo) and the vendor gets exactly the remainder, so every line satisfies
 * coopShare + vendorPayable === netSales with no lost centavos.
 */
export function computeVendorSplit(rows: SaleTransactionRow[]): VendorSplitResult {
  const groups = new Map<string, { vendorId: number | null; vendorName: string; pct: number; qty: number; cents: number }>();

  for (const t of rows.filter(isCompleted)) {
    for (const i of t.items) {
      const pct = i.vendorId === null ? 100 : i.coopSharePercent ?? 100;
      const key = `${i.vendorId ?? 'coop'}@${pct}`;
      const g = groups.get(key) ?? {
        vendorId: i.vendorId,
        vendorName: i.vendorId === null ? COOP_OWNED_LABEL : i.vendorName ?? `Vendor #${i.vendorId}`,
        pct,
        qty: 0,
        cents: 0,
      };
      g.qty += i.quantity;
      g.cents += toCents(i.subtotal);
      groups.set(key, g);
    }
  }

  const lines: VendorSplitLine[] = [...groups.values()]
    .map((g) => {
      // pct has at most 2 decimals → work in basis points to stay in integers.
      const bps = Math.round(g.pct * 100);
      const coopCents = Math.round((g.cents * bps) / 10000);
      return {
        vendorId: g.vendorId,
        vendorName: g.vendorName,
        coopSharePercent: g.pct,
        itemsSold: g.qty,
        netSales: toPesos(g.cents),
        coopShare: toPesos(coopCents),
        vendorPayable: toPesos(g.cents - coopCents),
      };
    })
    // Vendors first (largest payable first), coop-owned goods last.
    .sort((a, b) => Number(a.vendorId === null) - Number(b.vendorId === null) || b.netSales - a.netSales);

  const totalsCents = lines.reduce(
    (acc, l) => ({
      itemsSold: acc.itemsSold + l.itemsSold,
      net: acc.net + toCents(l.netSales),
      coop: acc.coop + toCents(l.coopShare),
      vendor: acc.vendor + toCents(l.vendorPayable),
    }),
    { itemsSold: 0, net: 0, coop: 0, vendor: 0 }
  );

  return {
    lines,
    totals: {
      itemsSold: totalsCents.itemsSold,
      netSales: toPesos(totalsCents.net),
      coopShare: toPesos(totalsCents.coop),
      vendorPayable: toPesos(totalsCents.vendor),
    },
  };
}

// ─── Cash count & over/short ─────────────────────────────────────────────────

/** Philippine peso denominations, largest first. ₱20 covers both bill and coin. */
export const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25] as const;

export type DenominationCounts = Record<string, number>;

export function denominationLabel(d: number): string {
  return d < 1 ? `${Math.round(d * 100)}¢` : `₱${d.toLocaleString('en-PH')}`;
}

/** Validates piece counts; returns an error message or null. */
export function validateDenominationCounts(counts: DenominationCounts): string | null {
  const allowed = new Set(DENOMINATIONS.map(String));
  for (const [denom, pieces] of Object.entries(counts)) {
    if (!allowed.has(denom)) return `Unknown denomination: ${denom}`;
    if (!Number.isInteger(pieces) || pieces < 0) return `Piece count for ${denom} must be a whole number ≥ 0.`;
    if (pieces > 100000) return `Piece count for ${denom} looks wrong (${pieces}).`;
  }
  return null;
}

/** Total counted cash, in pesos. */
export function countDenominations(counts: DenominationCounts): number {
  let cents = 0;
  for (const d of DENOMINATIONS) {
    cents += toCents(d) * (counts[String(d)] ?? 0);
  }
  return toPesos(cents);
}

/** Cash a cashier should be holding from sales: completed, cash-paid, tax-inclusive. */
export function cashSalesForCashier(rows: SaleTransactionRow[], cashierId: string): number {
  return toPesos(
    sumCents(
      rows
        .filter((t) => isCompleted(t) && t.cashierId === cashierId && t.paymentMethod === 'CASH')
        .map((t) => t.totalAmount)
    )
  );
}

export type CashStatus = 'OVER' | 'SHORT' | 'BALANCED';

export interface CashReconciliationFigures {
  openingFund: number;
  cashSales: number;
  expectedCash: number;
  countedCash: number;
  variance: number; // + over, − short
  status: CashStatus;
}

export function reconcileCash(input: { openingFund: number; cashSales: number; countedCash: number }): CashReconciliationFigures {
  const expectedCents = toCents(input.openingFund) + toCents(input.cashSales);
  const varianceCents = toCents(input.countedCash) - expectedCents;
  return {
    openingFund: toPesos(toCents(input.openingFund)),
    cashSales: toPesos(toCents(input.cashSales)),
    expectedCash: toPesos(expectedCents),
    countedCash: toPesos(toCents(input.countedCash)),
    variance: toPesos(varianceCents),
    status: varianceCents > 0 ? 'OVER' : varianceCents < 0 ? 'SHORT' : 'BALANCED',
  };
}
