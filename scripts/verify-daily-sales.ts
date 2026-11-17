// scripts/verify-daily-sales.ts
// Run: npm run test:daily-sales
//
// Checks the pure calculations behind the Daily Sales & Reconciliation module.
// No database needed.

import assert from 'node:assert/strict';
import {
  dayRange,
  isValidDateKey,
  manilaHour,
  shiftDateKey,
  toDateKey,
} from '../src/lib/dailySales/businessDate';
import {
  SaleTransactionRow,
  cashSalesForCashier,
  computeDailySummary,
  computeReadingFigures,
  computeVendorSplit,
  countDenominations,
  reconcileCash,
  validateDenominationCounts,
} from '../src/lib/dailySales/calculations';
import { getDemoDayTransactions } from '../src/data/dailySalesMockData';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    console.error(`  ✘ ${name}`);
    throw e;
  }
}

const item = (o: Partial<SaleTransactionRow['items'][0]> & { subtotal: number }) => ({
  productId: 1,
  productName: 'Item',
  category: 'Hot Meals',
  quantity: 1,
  vendorId: null,
  vendorName: null,
  coopSharePercent: null,
  ...o,
});

const tx = (o: Partial<SaleTransactionRow> & { subtotal: number; items: SaleTransactionRow['items'] }): SaleTransactionRow => {
  const tax = Math.round(o.subtotal * 5) / 100;
  return {
    transactionNumber: '#1',
    createdAt: new Date('2026-11-17T03:00:00Z'), // 11:00 Manila
    cashierId: 'cashier',
    cashierName: 'POS Cashier',
    memberId: null,
    paymentMethod: 'CASH',
    status: 'COMPLETED',
    taxAmount: tax,
    totalAmount: Math.round((o.subtotal + tax) * 100) / 100,
    ...o,
  };
};

console.log('\nBusiness date (Asia/Manila)');
test('23:30 UTC belongs to the next Manila day', () => {
  assert.equal(toDateKey(new Date('2026-11-16T23:30:00Z')), '2026-11-17');
  assert.equal(manilaHour(new Date('2026-11-16T23:30:00Z')), 7);
});
test('day range is [00:00, 24:00) Manila', () => {
  const { start, end } = dayRange('2026-11-17');
  assert.equal(start.toISOString(), '2026-11-16T16:00:00.000Z');
  assert.equal(end.toISOString(), '2026-11-17T16:00:00.000Z');
});
test('date key validation rejects impossible dates', () => {
  assert.ok(isValidDateKey('2028-02-29'));
  assert.ok(!isValidDateKey('2026-02-29'));
  assert.ok(!isValidDateKey('2026-11-17T00:00'));
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
});

console.log('\nReading figures');
test('voids are excluded from sales but reported', () => {
  const rows = [
    tx({ transactionNumber: '#1002', subtotal: 100, items: [item({ subtotal: 100 })] }),
    tx({ transactionNumber: '#1001', subtotal: 200, items: [item({ subtotal: 200 })], createdAt: new Date('2026-11-17T01:00:00Z') }),
    tx({ transactionNumber: '#1003', subtotal: 50, items: [item({ subtotal: 50 })], status: 'VOIDED' }),
  ];
  const f = computeReadingFigures(rows);
  assert.equal(f.transactionCount, 2);
  assert.equal(f.netSales, 300);
  assert.equal(f.taxAmount, 15);
  assert.equal(f.grossSales, 315);
  assert.equal(f.voidCount, 1);
  assert.equal(f.voidAmount, 52.5);
  assert.equal(f.firstTransactionNo, '#1001');
  assert.equal(f.lastTransactionNo, '#1002');
});
test('float-prone amounts sum exactly', () => {
  const rows = Array.from({ length: 10 }, () => tx({ subtotal: 0.1, taxAmount: 0, totalAmount: 0.1, items: [item({ subtotal: 0.1 })] }));
  assert.equal(computeReadingFigures(rows).grossSales, 1);
});

console.log('\nVendor split');
test('coop share + vendor payable === net sales on every line, centavo-exact', () => {
  const rows = [
    tx({
      subtotal: 333.33,
      items: [
        item({ subtotal: 111.11, vendorId: 1, vendorName: 'A', coopSharePercent: 12.5 }),
        item({ subtotal: 222.22, vendorId: 1, vendorName: 'A', coopSharePercent: 12.5 }),
      ],
    }),
  ];
  const { lines } = computeVendorSplit(rows);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].netSales, 333.33);
  assert.equal(lines[0].coopShare, 41.67); // 41.66625 → 41.67
  assert.equal(lines[0].vendorPayable, 291.66);
});
test('rate change mid-day settles each portion at its own rate', () => {
  const rows = [
    tx({ subtotal: 100, items: [item({ subtotal: 100, vendorId: 1, vendorName: 'A', coopSharePercent: 10 })] }),
    tx({ subtotal: 100, items: [item({ subtotal: 100, vendorId: 1, vendorName: 'A', coopSharePercent: 20 })] }),
  ];
  const { lines, totals } = computeVendorSplit(rows);
  assert.equal(lines.length, 2);
  assert.equal(totals.coopShare, 30);
  assert.equal(totals.vendorPayable, 170);
});
test('coop-owned goods are 100% coop and listed last', () => {
  const rows = [
    tx({
      subtotal: 300,
      items: [item({ subtotal: 100 }), item({ productId: 2, subtotal: 200, vendorId: 7, vendorName: 'B', coopSharePercent: 15 })],
    }),
  ];
  const { lines, totals } = computeVendorSplit(rows);
  assert.equal(lines[0].vendorId, 7);
  assert.equal(lines[1].vendorId, null);
  assert.equal(lines[1].coopShare, 100);
  assert.equal(lines[1].vendorPayable, 0);
  assert.equal(totals.coopShare, 130);
  assert.equal(totals.vendorPayable, 170);
});
test('voided sales are not split', () => {
  const rows = [tx({ status: 'VOIDED', subtotal: 100, items: [item({ subtotal: 100, vendorId: 1, vendorName: 'A', coopSharePercent: 10 })] })];
  assert.equal(computeVendorSplit(rows).lines.length, 0);
});

console.log('\nCash count & over/short');
test('denomination count includes 25-centavo coins', () => {
  assert.equal(countDenominations({ '1000': 2, '500': 1, '20': 3, '0.25': 3 }), 2560.75);
});
test('rejects bad denomination input', () => {
  assert.ok(validateDenominationCounts({ '1000': -1 }));
  assert.ok(validateDenominationCounts({ '1000': 1.5 }));
  assert.ok(validateDenominationCounts({ '3': 1 }));
  assert.equal(validateDenominationCounts({ '1000': 1, '0.25': 4 }), null);
});
test('expected cash = opening fund + cash sales; variance sign', () => {
  assert.deepEqual(reconcileCash({ openingFund: 1000, cashSales: 1575.25, countedCash: 2575.25 }).status, 'BALANCED');
  const over = reconcileCash({ openingFund: 1000, cashSales: 1575.25, countedCash: 2580 });
  assert.equal(over.expectedCash, 2575.25);
  assert.equal(over.variance, 4.75);
  assert.equal(over.status, 'OVER');
  const short = reconcileCash({ openingFund: 1000, cashSales: 1575.25, countedCash: 2500 });
  assert.equal(short.variance, -75.25);
  assert.equal(short.status, 'SHORT');
});
test('cash sales count only completed CASH sales of that cashier', () => {
  const rows = [
    tx({ subtotal: 100, items: [item({ subtotal: 100 })] }),
    tx({ subtotal: 100, items: [item({ subtotal: 100 })], status: 'VOIDED' }),
    tx({ subtotal: 100, items: [item({ subtotal: 100 })], cashierId: 'other' }),
    tx({ subtotal: 100, items: [item({ subtotal: 100 })], paymentMethod: 'GCASH' }),
  ];
  assert.equal(cashSalesForCashier(rows, 'cashier'), 105);
});

console.log('\nDemo data & summary consistency');
test('demo data is deterministic per date', () => {
  const a = getDemoDayTransactions('2026-11-17');
  const b = getDemoDayTransactions('2026-11-17');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, getDemoDayTransactions('2026-11-16'));
});
test('demo transactions all fall on their Manila business date', () => {
  for (const t of getDemoDayTransactions('2026-11-17')) assert.equal(toDateKey(t.createdAt), '2026-11-17');
});
test('summary, split and cashier totals reconcile with each other', () => {
  const rows = getDemoDayTransactions('2026-11-17');
  const s = computeDailySummary(rows);
  const split = computeVendorSplit(rows);
  const cents = (n: number) => Math.round(n * 100);
  assert.equal(cents(split.totals.netSales), cents(s.netSales));
  assert.equal(cents(split.totals.coopShare + split.totals.vendorPayable), cents(s.netSales));
  assert.equal(cents(s.categories.reduce((a, c) => a + c.sales, 0)), cents(s.netSales));
  assert.equal(cents(s.cashiers.reduce((a, c) => a + c.sales, 0)), cents(s.grossSales));
  assert.equal(cents(s.hourly.reduce((a, h) => a + h.sales, 0)), cents(s.grossSales));
  assert.equal(cents(s.memberSales + s.walkInSales), cents(s.grossSales));
  const byCashier = s.cashiers.reduce((a, c) => a + cents(cashSalesForCashier(rows, c.cashierId)), 0);
  assert.equal(byCashier, cents(s.grossSales));
});

console.log(`\n✅ ${passed} checks passed\n`);
