// src/lib/accounting/statements.ts
//
// The three financial statements, computed from journal postings. Pure and
// isomorphic: the report page feeds them database rows, the test script feeds
// them hand-built ledgers. Because all three come from the same postings they
// always tie out: the income statement's net income flows into balance sheet
// equity, and the cash flow statement ends on the balance sheet's cash.
//
// Dates are Manila business-date keys ("YYYY-MM-DD"), which compare correctly
// as strings. Periods are inclusive on both ends.

import {
  AccountSubtype,
  AccountType,
  CashFlowCategory,
  SUBTYPE_LABELS,
  cashFlowCategory,
  isDebitNormal,
} from './chartOfAccounts';
import { toCents, toPesos } from './ledger';

export interface LedgerAccount {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  isActive: boolean;
  systemKey: string | null;
}

/** One journal line, flattened with its entry's date. */
export interface Posting {
  entryId: string;
  date: string; // YYYY-MM-DD
  accountId: number;
  debit: number; // pesos
  credit: number; // pesos
}

export interface StatementLine {
  accountId: number | null; // null for computed lines (e.g. net surplus)
  code: string | null;
  name: string;
  amount: number; // pesos, in the account's normal direction
}

export interface StatementSection {
  key: string;
  label: string;
  lines: StatementLine[];
  total: number;
}

// ─── Balances ────────────────────────────────────────────────────────────────

interface Range {
  from?: string; // inclusive; omitted = since the beginning
  to?: string; // inclusive; omitted = no end
}

const inRange = (date: string, { from, to }: Range) => (!from || date >= from) && (!to || date <= to);

/** Raw debit-minus-credit per account, in centavos. */
function netDebitCents(postings: Posting[], range: Range): Map<number, number> {
  const net = new Map<number, number>();
  for (const p of postings) {
    if (!inRange(p.date, range)) continue;
    net.set(p.accountId, (net.get(p.accountId) ?? 0) + toCents(p.debit) - toCents(p.credit));
  }
  return net;
}

/** Balance in the account's normal direction (positive = normal balance). */
function normalCents(account: LedgerAccount, netDebit: number): number {
  return isDebitNormal(account.type) ? netDebit : -netDebit;
}

/** Balance of every account in its normal direction, in pesos. */
export function accountBalances(accounts: LedgerAccount[], postings: Posting[], range: Range = {}): Map<number, number> {
  const net = netDebitCents(postings, range);
  return new Map(accounts.map((a) => [a.id, toPesos(normalCents(a, net.get(a.id) ?? 0))]));
}

const byCode = (a: LedgerAccount, b: LedgerAccount) => a.code.localeCompare(b.code);

function section(
  subtype: AccountSubtype,
  accounts: LedgerAccount[],
  net: Map<number, number>,
  label: string = SUBTYPE_LABELS[subtype]
): StatementSection {
  let totalCents = 0;
  const lines: StatementLine[] = [];
  for (const a of accounts.filter((x) => x.subtype === subtype).sort(byCode)) {
    const cents = normalCents(a, net.get(a.id) ?? 0);
    if (cents === 0) continue; // accounts with no balance stay off the statement
    totalCents += cents;
    lines.push({ accountId: a.id, code: a.code, name: a.name, amount: toPesos(cents) });
  }
  return { key: subtype, label, lines, total: toPesos(totalCents) };
}

/** Revenue minus expenses over a range, in centavos. */
function netIncomeCents(accounts: LedgerAccount[], net: Map<number, number>): number {
  let cents = 0;
  for (const a of accounts) {
    const n = normalCents(a, net.get(a.id) ?? 0);
    if (a.type === 'REVENUE') cents += n;
    else if (a.type === 'EXPENSE') cents -= n;
  }
  return cents;
}

// ─── Trial balance ───────────────────────────────────────────────────────────

export interface TrialBalanceRow {
  accountId: number;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  asOf: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export function computeTrialBalance(accounts: LedgerAccount[], postings: Posting[], asOf: string): TrialBalance {
  const net = netDebitCents(postings, { to: asOf });
  let dr = 0;
  let cr = 0;
  const rows: TrialBalanceRow[] = [];
  for (const a of [...accounts].sort(byCode)) {
    const n = net.get(a.id) ?? 0;
    if (n === 0) continue;
    if (n > 0) dr += n;
    else cr -= n;
    rows.push({
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      debit: n > 0 ? toPesos(n) : 0,
      credit: n < 0 ? toPesos(-n) : 0,
    });
  }
  return { asOf, rows, totalDebit: toPesos(dr), totalCredit: toPesos(cr), balanced: dr === cr };
}

// ─── Income statement ────────────────────────────────────────────────────────

export interface IncomeStatement {
  from: string;
  to: string;
  revenue: StatementSection;
  costOfSales: StatementSection;
  grossProfit: number;
  operatingExpenses: StatementSection;
  operatingIncome: number;
  otherIncome: StatementSection;
  otherExpenses: StatementSection;
  netIncome: number;
  /** Gross profit as a percentage of revenue; null when there is no revenue. */
  grossMarginPct: number | null;
  netMarginPct: number | null;
}

export function computeIncomeStatement(
  accounts: LedgerAccount[],
  postings: Posting[],
  from: string,
  to: string
): IncomeStatement {
  const net = netDebitCents(postings, { from, to });
  const revenue = section('OPERATING_REVENUE', accounts, net, 'Revenue');
  const costOfSales = section('COST_OF_SALES', accounts, net);
  const operatingExpenses = section('OPERATING_EXPENSE', accounts, net);
  const otherIncome = section('OTHER_INCOME', accounts, net);
  const otherExpenses = section('OTHER_EXPENSE', accounts, net);

  const grossCents = toCents(revenue.total) - toCents(costOfSales.total);
  const operatingCents = grossCents - toCents(operatingExpenses.total);
  const netCents = operatingCents + toCents(otherIncome.total) - toCents(otherExpenses.total);
  const revCents = toCents(revenue.total);

  return {
    from,
    to,
    revenue,
    costOfSales,
    grossProfit: toPesos(grossCents),
    operatingExpenses,
    operatingIncome: toPesos(operatingCents),
    otherIncome,
    otherExpenses,
    netIncome: toPesos(netCents),
    grossMarginPct: revCents ? (grossCents / revCents) * 100 : null,
    netMarginPct: revCents ? (netCents / revCents) * 100 : null,
  };
}

// ─── Balance sheet ───────────────────────────────────────────────────────────

export interface BalanceSheet {
  asOf: string;
  assets: StatementSection[];
  totalAssets: number;
  liabilities: StatementSection[];
  totalLiabilities: number;
  equity: StatementSection;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  /** Assets − (liabilities + equity). Zero for a healthy ledger. */
  difference: number;
  balanced: boolean;
}

/** January 1 of the date's year. */
export function yearStart(date: string): string {
  return `${date.slice(0, 4)}-01-01`;
}

/**
 * Financial position at the end of `asOf`. The ledger has no closing entries,
 * so earnings not yet closed to Retained Earnings are shown as two computed
 * equity lines: prior years and the current year to date.
 */
export function computeBalanceSheet(accounts: LedgerAccount[], postings: Posting[], asOf: string): BalanceSheet {
  const net = netDebitCents(postings, { to: asOf });

  const assets = (['CASH', 'CURRENT_ASSET', 'NON_CURRENT_ASSET'] as const).map((s) => section(s, accounts, net));
  const liabilities = (['CURRENT_LIABILITY', 'NON_CURRENT_LIABILITY'] as const).map((s) => section(s, accounts, net));
  const equity = section('EQUITY', accounts, net);

  const ys = yearStart(asOf);
  const priorYearDay = `${Number(ys.slice(0, 4)) - 1}-12-31`;
  const priorCents = netIncomeCents(accounts, netDebitCents(postings, { to: priorYearDay }));
  const currentCents = netIncomeCents(accounts, netDebitCents(postings, { from: ys, to: asOf }));

  if (priorCents !== 0) {
    equity.lines.push({ accountId: null, code: null, name: 'Net surplus – prior years (not yet closed)', amount: toPesos(priorCents) });
  }
  equity.lines.push({ accountId: null, code: null, name: `Net surplus – ${asOf.slice(0, 4)} year to date`, amount: toPesos(currentCents) });
  equity.total = toPesos(toCents(equity.total) + priorCents + currentCents);

  const sum = (sections: StatementSection[]) => sections.reduce((acc, s) => acc + toCents(s.total), 0);
  const assetCents = sum(assets);
  const liabilityCents = sum(liabilities);
  const equityCents = toCents(equity.total);
  const diffCents = assetCents - liabilityCents - equityCents;

  return {
    asOf,
    assets,
    totalAssets: toPesos(assetCents),
    liabilities,
    totalLiabilities: toPesos(liabilityCents),
    equity,
    totalEquity: toPesos(equityCents),
    totalLiabilitiesAndEquity: toPesos(liabilityCents + equityCents),
    difference: toPesos(diffCents),
    balanced: diffCents === 0,
  };
}

// ─── Cash flow statement ─────────────────────────────────────────────────────

export interface CashFlowSection {
  category: CashFlowCategory;
  label: string;
  lines: StatementLine[]; // amount: + inflow, − outflow
  total: number;
}

export interface CashFlowStatement {
  from: string;
  to: string;
  beginningCash: number;
  sections: CashFlowSection[];
  netChange: number;
  endingCash: number;
  /** Cash per the ledger at `to`. Equals endingCash for a healthy ledger. */
  endingCashPerLedger: number;
  reconciled: boolean;
}

const CASH_FLOW_LABELS: Record<CashFlowCategory, string> = {
  OPERATING: 'Cash Flows from Operating Activities',
  INVESTING: 'Cash Flows from Investing Activities',
  FINANCING: 'Cash Flows from Financing Activities',
};

/**
 * Direct method, read straight off the journal. For every entry that moves
 * cash, each non-cash line is the reason cash moved: a credit to Canteen Sales
 * brought cash in, a debit to Salaries sent it out. Because each entry
 * balances, the non-cash lines of an entry sum exactly to its cash movement,
 * so no allocation or rounding is needed. Transfers between cash accounts net
 * to zero and do not appear.
 */
export function computeCashFlow(
  accounts: LedgerAccount[],
  postings: Posting[],
  from: string,
  to: string
): CashFlowStatement {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const isCash = (accountId: number) => accountById.get(accountId)?.subtype === 'CASH';

  const cashCents = (range: Range) =>
    postings
      .filter((p) => isCash(p.accountId) && inRange(p.date, range))
      .reduce((acc, p) => acc + toCents(p.debit) - toCents(p.credit), 0);

  const dayBefore = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const beginningCents = cashCents({ to: dayBefore(from) });
  const endingPerLedgerCents = cashCents({ to });

  const inPeriod = postings.filter((p) => inRange(p.date, { from, to }));
  const cashEntries = new Set(inPeriod.filter((p) => isCash(p.accountId)).map((p) => p.entryId));

  // Non-cash lines of each cash-moving entry, as inflow (+) / outflow (−).
  const byEntry = new Map<string, { accountId: number; cents: number }[]>();
  for (const p of inPeriod) {
    if (!cashEntries.has(p.entryId) || isCash(p.accountId)) continue;
    const list = byEntry.get(p.entryId) ?? [];
    list.push({ accountId: p.accountId, cents: toCents(p.credit) - toCents(p.debit) });
    byEntry.set(p.entryId, list);
  }

  // Attribute to accounts. Offsetting non-cash pairs inside one entry (a POS
  // sale's Dr Cost of Goods Sold / Cr Inventory) moved no cash, so they are
  // cancelled first; they sum to zero, so totals are unaffected.
  const flow = new Map<number, number>();
  for (const lines of byEntry.values()) {
    const remaining = lines.filter((l) => l.cents !== 0);
    for (let i = 0; i < remaining.length; i++) {
      const j = remaining.findIndex((o, k) => k > i && o.cents === -remaining[i].cents);
      if (j > i) {
        remaining.splice(j, 1);
        remaining.splice(i, 1);
        i--;
      }
    }
    for (const l of remaining) flow.set(l.accountId, (flow.get(l.accountId) ?? 0) + l.cents);
  }

  const sections: CashFlowSection[] = (['OPERATING', 'INVESTING', 'FINANCING'] as const).map((category) => {
    let totalCents = 0;
    const lines: StatementLine[] = [];
    for (const a of accounts.filter((x) => cashFlowCategory(x.subtype) === category).sort(byCode)) {
      const cents = flow.get(a.id) ?? 0;
      if (cents === 0) continue;
      totalCents += cents;
      lines.push({ accountId: a.id, code: a.code, name: a.name, amount: toPesos(cents) });
    }
    return { category, label: CASH_FLOW_LABELS[category], lines, total: toPesos(totalCents) };
  });

  const netCents = sections.reduce((acc, s) => acc + toCents(s.total), 0);
  const endingCents = beginningCents + netCents;

  return {
    from,
    to,
    beginningCash: toPesos(beginningCents),
    sections,
    netChange: toPesos(netCents),
    endingCash: toPesos(endingCents),
    endingCashPerLedger: toPesos(endingPerLedgerCents),
    reconciled: endingCents === endingPerLedgerCents,
  };
}
