// scripts/verify-financial-reports.ts
// Run: npm run test:financial-reports
//
// Part 1 checks the pure accounting logic against a hand-built ledger whose
// answers are worked out by hand. No database needed.
// Part 2 checks the real ledger in the database: every sale is posted, every
// entry balances, and the three statements tie out. Skipped if the database
// is unreachable.

import assert from 'node:assert/strict';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  SystemAccountKey,
  validateAccountInput,
} from '../src/lib/accounting/chartOfAccounts';
import {
  AccountRef,
  buildCashCountEntryLines,
  buildSaleEntryLines,
  costOfGoodsSold,
  packageSize,
  reverseLines,
  toCents,
  validateJournalLines,
} from '../src/lib/accounting/ledger';
import {
  LedgerAccount,
  Posting,
  accountBalances,
  computeBalanceSheet,
  computeCashFlow,
  computeIncomeStatement,
  computeTrialBalance,
} from '../src/lib/accounting/statements';
import { presetPeriod, formatPeriod } from '../src/lib/accounting/periods';
import { computeVendorSplit, SaleTransactionRow } from '../src/lib/dailySales/calculations';

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    console.error(`  ✘ ${name}`);
    throw e;
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ACCOUNTS: LedgerAccount[] = DEFAULT_CHART_OF_ACCOUNTS.map((a, i) => ({
  id: i + 1,
  code: a.code,
  name: a.name,
  type: a.type,
  subtype: a.subtype,
  isActive: true,
  systemKey: a.systemKey ?? null,
}));
const byCode = new Map(ACCOUNTS.map((a) => [a.code, a]));
const refs = new Map<number, AccountRef>(ACCOUNTS.map((a) => [a.id, a]));

let entrySeq = 0;
/** Builds the postings of one balanced entry; lines are [code, debit, credit]. */
function entry(date: string, lines: [string, number, number][]): Posting[] {
  const entryId = `e${++entrySeq}`;
  return lines.map(([code, debit, credit]) => ({ entryId, date, accountId: byCode.get(code)!.id, debit, credit }));
}

// A small year of activity. Every figure below is checked by hand in the tests.
//   2025-12-31  prior-year sale: cash 1,000 / sales 1,000            (prior-year surplus 1,000)
//   2026-01-01  opening: cash 10,000, equipment 50,000 / capital 60,000
//   2026-03-05  sale 2,100 cash / sales 2,000 / tax 100; COGS 800
//   2026-03-10  salaries 900 cash
//   2026-03-15  buy equipment 5,000 cash                 (investing)
//   2026-03-20  members pay capital 3,000 cash           (financing)
//   2026-03-31  depreciation 400                         (non-cash)
//   2026-03-31  inventory bought on account 1,500        (non-cash)
//   2026-03-31  transfer 4,000 cash on hand → bank       (cash ↔ cash)
//   2026-04-02  rent 700 cash                            (outside March)
const LEDGER: Posting[] = [
  ...entry('2025-12-31', [['1010', 1000, 0], ['4010', 0, 1000]]),
  ...entry('2026-01-01', [['1010', 10000, 0], ['1500', 50000, 0], ['3010', 0, 60000]]),
  ...entry('2026-03-05', [['1010', 2100, 0], ['4010', 0, 2000], ['2030', 0, 100], ['5010', 800, 0], ['1200', 0, 800]]),
  ...entry('2026-03-10', [['6010', 900, 0], ['1010', 0, 900]]),
  ...entry('2026-03-15', [['1500', 5000, 0], ['1010', 0, 5000]]),
  ...entry('2026-03-20', [['1010', 3000, 0], ['3010', 0, 3000]]),
  ...entry('2026-03-31', [['6060', 400, 0], ['1510', 0, 400]]),
  ...entry('2026-03-31', [['1200', 1500, 0], ['2010', 0, 1500]]),
  ...entry('2026-03-31', [['1020', 4000, 0], ['1010', 0, 4000]]),
  ...entry('2026-04-02', [['6030', 700, 0], ['1010', 0, 700]]),
];

const line = (s: { lines: { name: string; amount: number }[] }, code: string) =>
  s.lines.find((l) => l.name === byCode.get(code)!.name)?.amount;

async function main() {
  // ─── Part 1: pure logic ──────────────────────────────────────────────────

  console.log('Chart of accounts');

  await test('default chart: codes unique and each fits its group', () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.code);
    assert.equal(new Set(codes).size, codes.length);
    for (const a of DEFAULT_CHART_OF_ACCOUNTS) assert.equal(validateAccountInput(a), null, `${a.code} ${a.name}`);
  });

  await test('default chart: every system account key exists exactly once', () => {
    const keys: SystemAccountKey[] = [
      'CASH_ON_HAND', 'INVENTORY', 'VENDOR_PAYABLE', 'SALES_TAX_PAYABLE', 'SHARE_CAPITAL', 'RETAINED_EARNINGS',
      'SALES', 'COMMISSION_INCOME', 'CASH_OVERAGE', 'COST_OF_GOODS_SOLD', 'CASH_SHORTAGE',
    ];
    for (const k of keys) assert.equal(DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.systemKey === k).length, 1, k);
  });

  await test('account validation rejects bad codes, wrong ranges and duplicates', () => {
    assert.match(validateAccountInput({ code: '61', name: 'X', subtype: 'OPERATING_EXPENSE' })!, /4 digits/);
    assert.match(validateAccountInput({ code: '1050', name: 'X', subtype: 'OPERATING_EXPENSE' })!, /does not fit/);
    assert.match(validateAccountInput({ code: '6010', name: 'X', subtype: 'OPERATING_EXPENSE' }, ['6010'])!, /already in use/);
    assert.match(validateAccountInput({ code: '6070', name: '  ', subtype: 'OPERATING_EXPENSE' })!, /name is required/);
    assert.equal(validateAccountInput({ code: '6070', name: 'Training', subtype: 'OPERATING_EXPENSE' }, ['6010']), null);
  });

  console.log('Journal entries');

  const cash = byCode.get('1010')!.id;
  const salaries = byCode.get('6010')!.id;
  await test('accepts a balanced two-line entry', () => {
    assert.equal(validateJournalLines([{ accountId: salaries, debit: 500, credit: 0 }, { accountId: cash, debit: 0, credit: 500 }], refs), null);
  });

  await test('rejects unbalanced, one-sided, negative, sub-centavo and single-account entries', () => {
    const v = (lines: { accountId: number; debit: number; credit: number }[]) => validateJournalLines(lines, refs);
    assert.match(v([{ accountId: salaries, debit: 500, credit: 0 }, { accountId: cash, debit: 0, credit: 499.99 }])!, /must be equal/);
    assert.match(v([{ accountId: salaries, debit: 500, credit: 0 }])!, /at least two lines/);
    assert.match(v([{ accountId: salaries, debit: 5, credit: 5 }, { accountId: cash, debit: 0, credit: 0 }])!, /not both or neither/);
    assert.match(v([{ accountId: salaries, debit: -5, credit: 0 }, { accountId: cash, debit: 0, credit: -5 }])!, /zero or positive/);
    assert.match(v([{ accountId: salaries, debit: 1.005, credit: 0 }, { accountId: cash, debit: 0, credit: 1.005 }])!, /two decimal/);
    assert.match(v([{ accountId: cash, debit: 5, credit: 0 }, { accountId: cash, debit: 0, credit: 5 }])!, /two different accounts/);
    assert.match(v([{ accountId: 9999, debit: 5, credit: 0 }, { accountId: cash, debit: 0, credit: 5 }])!, /choose an account/);
  });

  await test('rejects posting to an inactive account', () => {
    const inactive = new Map(refs);
    inactive.set(salaries, { ...refs.get(salaries)!, isActive: false });
    assert.match(
      validateJournalLines([{ accountId: salaries, debit: 5, credit: 0 }, { accountId: cash, debit: 0, credit: 5 }], inactive)!,
      /inactive/
    );
  });

  await test('reversing an entry swaps every debit and credit', () => {
    const r = reverseLines([{ debit: 10, credit: 0 }, { debit: 0, credit: 10 }]);
    assert.deepEqual(r, [{ debit: 0, credit: 10 }, { debit: 10, credit: 0 }]);
  });

  console.log('Automatic postings');

  await test('coop-owned sale: cash, sales, tax and cost of goods sold', () => {
    const lines = buildSaleEntryLines({
      totalAmount: 288.75,
      taxAmount: 13.75,
      costOfGoodsSold: 135,
      items: [{ subtotal: 275, vendorId: null, coopSharePercent: null }],
    });
    const get = (k: SystemAccountKey) => lines.find((l) => l.key === k);
    assert.equal(get('CASH_ON_HAND')!.debit, 288.75);
    assert.equal(get('SALES')!.credit, 275);
    assert.equal(get('SALES_TAX_PAYABLE')!.credit, 13.75);
    assert.equal(get('COST_OF_GOODS_SOLD')!.debit, 135);
    assert.equal(get('INVENTORY')!.credit, 135);
    assert.equal(get('COMMISSION_INCOME'), undefined, 'zero lines are omitted');
    const dr = lines.reduce((a, l) => a + toCents(l.debit), 0);
    const cr = lines.reduce((a, l) => a + toCents(l.credit), 0);
    assert.equal(dr, cr);
  });

  await test('consigned goods: coop keeps its commission, vendor share becomes a payable', () => {
    // ₱45 × 3 = ₱135 at 12.5% → coop ₱16.88 (16.875 rounds half up), vendor ₱118.12
    const lines = buildSaleEntryLines({
      totalAmount: 141.75,
      taxAmount: 6.75,
      costOfGoodsSold: 0,
      items: [{ subtotal: 135, vendorId: 2, coopSharePercent: 12.5 }],
    });
    const get = (k: SystemAccountKey) => lines.find((l) => l.key === k);
    assert.equal(get('COMMISSION_INCOME')!.credit, 16.88);
    assert.equal(get('VENDOR_PAYABLE')!.credit, 118.12);
    assert.equal(get('SALES'), undefined);
  });

  await test('ledger commission agrees with the Daily Sales vendor split', () => {
    const items = [
      { subtotal: 135, vendorId: 2, coopSharePercent: 12.5 },
      { subtotal: 60, vendorId: 1, coopSharePercent: 15 },
      { subtotal: 275, vendorId: null, coopSharePercent: null },
    ];
    const lines = buildSaleEntryLines({ totalAmount: 493.5, taxAmount: 23.5, costOfGoodsSold: 0, items });
    const row: SaleTransactionRow = {
      transactionNumber: '#1', createdAt: new Date(), cashierId: 'c', cashierName: 'C', memberId: null,
      paymentMethod: 'CASH', status: 'COMPLETED', subtotal: 470, taxAmount: 23.5, totalAmount: 493.5,
      items: items.map((i, n) => ({ ...i, productId: n, productName: 'P', category: 'X', quantity: 1, vendorName: 'V' })),
    };
    const split = computeVendorSplit([row]);
    assert.equal(toCents(lines.find((l) => l.key === 'COMMISSION_INCOME')!.credit), toCents(split.totals.coopShare) - 27500);
    assert.equal(lines.find((l) => l.key === 'VENDOR_PAYABLE')!.credit, split.totals.vendorPayable);
  });

  await test('a sale whose items and tax do not add up to the total is refused', () => {
    assert.throws(
      () => buildSaleEntryLines({ totalAmount: 100, taxAmount: 5, costOfGoodsSold: 0, items: [{ subtotal: 90, vendorId: null, coopSharePercent: null }] }),
      /does not balance/
    );
  });

  await test('cash over/short postings', () => {
    assert.deepEqual(buildCashCountEntryLines(25.5).map((l) => [l.key, l.debit, l.credit]), [
      ['CASH_ON_HAND', 25.5, 0],
      ['CASH_OVERAGE', 0, 25.5],
    ]);
    assert.deepEqual(buildCashCountEntryLines(-10).map((l) => [l.key, l.debit, l.credit]), [
      ['CASH_SHORTAGE', 10, 0],
      ['CASH_ON_HAND', 0, 10],
    ]);
    assert.deepEqual(buildCashCountEntryLines(0), []);
  });

  await test('inventory is costed per unit from the purchase package', () => {
    assert.equal(packageSize('Box of 50'), 50);
    assert.equal(packageSize('Pack of 12'), 12);
    assert.equal(packageSize('Case of 24'), 24);
    assert.equal(packageSize('1kg Bag'), 1);
    assert.equal(packageSize('Sack'), 1);
    // Classic Cheeseburger ×2: (1 patty @ 4250/50 + 2 buns @ 300/12) × 2 = (85 + 50) × 2
    assert.equal(
      costOfGoodsSold([{ quantity: 2, recipe: [
        { quantityRequired: 1, price: 4250, packaging: 'Box of 50' },
        { quantityRequired: 2, price: 300, packaging: 'Pack of 12' },
      ] }]),
      270
    );
  });

  console.log('Financial statements (hand-checked ledger)');

  await test('trial balance: debits equal credits', () => {
    const tb = computeTrialBalance(ACCOUNTS, LEDGER, '2026-03-31');
    assert.ok(tb.balanced);
    assert.equal(tb.totalDebit, tb.totalCredit);
  });

  await test('income statement for March 2026', () => {
    const s = computeIncomeStatement(ACCOUNTS, LEDGER, '2026-03-01', '2026-03-31');
    assert.equal(s.revenue.total, 2000);
    assert.equal(s.costOfSales.total, 800);
    assert.equal(s.grossProfit, 1200);
    assert.equal(s.operatingExpenses.total, 1300); // salaries 900 + depreciation 400
    assert.equal(s.operatingIncome, -100);
    assert.equal(s.netIncome, -100);
    assert.equal(s.grossMarginPct, 60);
    assert.equal(line(s.operatingExpenses, '6030'), undefined, 'April rent is outside the period');
  });

  await test('balance sheet at 2026-03-31 balances and carries earnings into equity', () => {
    const b = computeBalanceSheet(ACCOUNTS, LEDGER, '2026-03-31');
    assert.ok(b.balanced, `difference ${b.difference}`);
    // Cash on hand: 1,000 + 10,000 + 2,100 − 900 − 5,000 + 3,000 − 4,000 = 6,200; bank 4,000
    assert.equal(b.assets[0].total, 10200);
    assert.equal(b.assets[1].total, 700); // inventory −800 + 1,500
    assert.equal(b.assets[2].total, 54600); // equipment 55,000 − accumulated depreciation 400
    assert.equal(b.totalAssets, 65500);
    assert.equal(b.totalLiabilities, 1600); // tax 100 + payable 1,500
    assert.equal(line(b.equity, '3010'), 63000);
    const names = b.equity.lines.map((l) => l.name);
    assert.ok(names.some((n) => n.includes('prior years')), 'prior-year surplus shown');
    assert.equal(b.equity.lines.find((l) => l.name.includes('prior years'))!.amount, 1000);
    assert.equal(b.equity.lines.find((l) => l.name.includes('year to date'))!.amount, -100);
    assert.equal(b.totalEquity, 63900);
  });

  await test('cash flow for March 2026 classifies activities and reconciles to the balance sheet', () => {
    const c = computeCashFlow(ACCOUNTS, LEDGER, '2026-03-01', '2026-03-31');
    const [op, inv, fin] = c.sections;
    assert.equal(c.beginningCash, 11000);
    assert.equal(op.total, 1200); // +2,000 sales + 100 tax − 900 salaries (COGS & depreciation are non-cash)
    assert.equal(inv.total, -5000);
    assert.equal(fin.total, 3000);
    assert.equal(c.netChange, -800);
    assert.equal(c.endingCash, 10200);
    assert.ok(c.reconciled);
    assert.equal(c.endingCash, computeBalanceSheet(ACCOUNTS, LEDGER, '2026-03-31').assets[0].total);
    assert.equal(line(op, '6060'), undefined, 'depreciation is not a cash flow');
    assert.equal(line(op, '5010'), undefined, 'cost of goods sold is not a cash flow');
    assert.equal(line(op, '1200'), undefined, 'inventory relieved at sale is not a cash flow');
    assert.equal(line(op, '4010'), 2000);
    assert.equal(line(op, '1010'), undefined, 'cash-to-bank transfer is not a cash flow');
  });

  await test('statements tie together for every month of the year', () => {
    for (let m = 1; m <= 12; m++) {
      const from = `2026-${String(m).padStart(2, '0')}-01`;
      const to = new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10);
      const b = computeBalanceSheet(ACCOUNTS, LEDGER, to);
      const c = computeCashFlow(ACCOUNTS, LEDGER, from, to);
      assert.ok(b.balanced, `balance sheet ${to}`);
      assert.ok(c.reconciled, `cash flow ${from}`);
      assert.equal(c.endingCash, b.assets[0].total, `cash ${to}`);
    }
  });

  await test('an unbalanced ledger is flagged, not hidden', () => {
    const broken = [...LEDGER, { entryId: 'bad', date: '2026-03-31', accountId: byCode.get('1010')!.id, debit: 50, credit: 0 }];
    assert.equal(computeTrialBalance(ACCOUNTS, broken, '2026-03-31').balanced, false);
    const b = computeBalanceSheet(ACCOUNTS, broken, '2026-03-31');
    assert.equal(b.balanced, false);
    assert.equal(b.difference, 50);
  });

  await test('account balances follow each account’s normal side', () => {
    const bal = accountBalances(ACCOUNTS, LEDGER, { to: '2026-03-31' });
    assert.equal(bal.get(byCode.get('3010')!.id), 63000); // credit-normal, shown positive
    assert.equal(bal.get(byCode.get('1510')!.id), -400); // contra-asset, shown negative
  });

  console.log('Periods');

  await test('period presets', () => {
    assert.deepEqual(presetPeriod('this-month', '2026-11-17'), { from: '2026-11-01', to: '2026-11-17' });
    assert.deepEqual(presetPeriod('last-month', '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' });
    assert.deepEqual(presetPeriod('last-month', '2026-03-31'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(presetPeriod('this-quarter', '2026-11-17'), { from: '2026-10-01', to: '2026-11-17' });
    assert.deepEqual(presetPeriod('year-to-date', '2026-11-17'), { from: '2026-01-01', to: '2026-11-17' });
    assert.equal(formatPeriod({ from: '2026-11-01', to: '2026-11-17' }), 'Nov 1 – 17, 2026');
  });

  // ─── Part 2: the real ledger ─────────────────────────────────────────────
  // Dench's database checks, ported to the merged multi-cooperative ledger.
  // Read-only: they inspect every cooperative's books and change nothing.

  console.log('Database ledger');
  const { default: prisma } = await import('../src/lib/prisma');
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log('  – skipped: database not reachable (start it with `docker compose up -d`)');
    console.log(`\n✅ ${passed} checks passed (database checks skipped)`);
    await prisma.$disconnect();
    return;
  }

  try {
    const { AccountingService, ACCOUNT } = await import('../src/services/accountingService');
    const { manilaToday, manilaDateOf, startOfDay, addDays, rangeOf } = await import('../src/lib/dates');
    const today = manilaToday();
    const endOfToday = startOfDay(addDays(today, 1));
    const branches = await prisma.schoolBranch.findMany({ select: { id: true, name: true } });

    await test('every completed POS sale has exactly one sale entry', async () => {
      const sales = await prisma.transaction.findMany({ where: { status: 'COMPLETED' }, select: { id: true } });
      const entries = await prisma.journalEntry.groupBy({ by: ['sourceId'], where: { sourceType: 'SALE' }, _count: true });
      const counts = new Map(entries.map((e) => [e.sourceId, e._count]));
      const bad = sales.filter((s) => counts.get(s.id) !== 1);
      assert.equal(bad.length, 0, `${bad.length} sales without exactly one entry`);
    });

    await test('voided sales are not left in revenue', async () => {
      const voided = await prisma.transaction.findMany({ where: { status: 'VOIDED' }, select: { id: true } });
      for (const sale of voided) {
        const lines = await prisma.journalLine.findMany({
          where: { entry: { sourceId: sale.id }, account: { code: ACCOUNT.SALES } },
          select: { debit: true, credit: true },
        });
        const net = lines.reduce((acc, l) => acc + toCents(Number(l.credit)) - toCents(Number(l.debit)), 0);
        assert.equal(net, 0, `void ${sale.id} still has sales of ${net / 100}`);
      }
    });

    await test('every journal entry balances', async () => {
      const sums = await prisma.journalLine.groupBy({ by: ['entryId'], _sum: { debit: true, credit: true } });
      const bad = sums.filter((s) => toCents(Number(s._sum.debit)) !== toCents(Number(s._sum.credit)));
      assert.equal(bad.length, 0, `${bad.length} unbalanced entries`);
    });

    for (const branch of branches) {
      const label = branch.name;
      const ledger = await AccountingService.loadLedger(branch.id, { to: endOfToday });
      const { accounts, postings } = ledger;

      await test(`${label}: cash posted by today's cash sales equals those sales`, async () => {
        const range = rangeOf(today, today);
        const sales = await prisma.transaction.findMany({
          where: { branchId: branch.id, status: 'COMPLETED', paymentMethod: 'CASH', createdAt: { gte: range.from, lt: range.to } },
          select: { id: true, totalAmount: true },
        });
        const salesCents = sales.reduce((a, t) => a + toCents(Number(t.totalAmount)), 0);
        const cashLines = await prisma.journalLine.findMany({
          where: { entry: { sourceType: 'SALE', sourceId: { in: sales.map((s) => s.id) } }, account: { code: ACCOUNT.CASH } },
          select: { debit: true },
        });
        assert.equal(cashLines.reduce((a, l) => a + toCents(Number(l.debit)), 0), salesCents);
      });

      await test(`${label}: trial balance and balance sheet balance as of today`, () => {
        assert.ok(computeTrialBalance(accounts, postings, today).balanced);
        const b = computeBalanceSheet(accounts, postings, today);
        assert.ok(b.balanced, `difference ${b.difference}`);
      });

      await test(`${label}: cash flow reconciles to balance sheet cash for each preset period`, () => {
        for (const id of ['this-month', 'last-month', 'this-quarter', 'year-to-date'] as const) {
          const p = presetPeriod(id, today);
          const c = computeCashFlow(accounts, postings, p.from, p.to);
          assert.ok(c.reconciled, id);
          const cashSection = computeBalanceSheet(accounts, postings, p.to).assets.find((s) => s.key === 'CASH');
          assert.equal(c.endingCash, cashSection?.total ?? 0, id);
        }
      });

      await test(`${label}: net surplus on the income statement flows into balance sheet equity`, () => {
        const ys = `${today.slice(0, 4)}-01-01`;
        const s = computeIncomeStatement(accounts, postings, ys, today);
        const b = computeBalanceSheet(accounts, postings, today);
        assert.equal(b.equity.lines.find((l) => l.name.includes('year to date'))!.amount, s.netIncome);
      });

      await test(`${label}: postings are dated on their Manila business day`, async () => {
        const latest = await prisma.journalEntry.findFirst({ where: { branchId: branch.id }, orderBy: { date: 'desc' } });
        if (latest) assert.ok(postings.some((p) => p.date === manilaDateOf(latest.date)));
      });
    }

    await test('an unbalanced manual entry is refused by the service', async () => {
      const branch = branches[0];
      await assert.rejects(
        AccountingService.postManualEntry(
          { branchId: branch.id, userId: null },
          {
            description: 'test',
            lines: [
              { code: ACCOUNT.CASH, debit: '10', credit: '' },
              { code: ACCOUNT.SALES, debit: '', credit: '9' },
            ],
          }
        ),
        /must be equal/
      );
    });

    console.log(`\n✅ ${passed} checks passed`);
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
