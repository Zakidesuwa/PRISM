// src/services/accountingService.ts
//
// Double-entry general ledger. Every module (sales, inventory, members, cash
// counts, vendor payouts, surplus distribution) posts here, and the financial
// statements are computed from the posted lines only.
import { AccountType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ZERO, num, requireText, round2, toAmount, type Dec } from '@/lib/money';
import type { DateRange } from '@/lib/dates';
import type { Ctx, Tx } from './context';
import { AuditService } from './auditService';

export const ACCOUNT = {
  CASH: '1010',
  BANK: '1020',
  EWALLET: '1030',
  RECEIVABLE: '1100',
  INVENTORY: '1200',
  EQUIPMENT: '1500',
  PAYABLE: '2010',
  CONSIGNORS: '2020',
  TAX_PAYABLE: '2030',
  PATRONAGE_PAYABLE: '2100',
  INTEREST_PAYABLE: '2110',
  SHARE_CAPITAL: '3010',
  RESERVE_FUND: '3100',
  CETF: '3110',
  CDF: '3120',
  OPTIONAL_FUND: '3130',
  APPROPRIATED: '3900',
  SALES: '4010',
  COMMISSION: '4020',
  OTHER_INCOME: '4900',
  COGS: '5010',
  SPOILAGE: '6010',
  CASH_SHORTAGE: '6020',
} as const;

interface AccountSeed {
  code: string;
  name: string;
  type: AccountType;
  cashFlowGroup: 'CASH' | 'OPERATING' | 'INVESTING' | 'FINANCING';
}

/** The chart of accounts every cooperative starts with. */
export const DEFAULT_ACCOUNTS: AccountSeed[] = [
  { code: '1010', name: 'Cash on Hand', type: 'ASSET', cashFlowGroup: 'CASH' },
  { code: '1020', name: 'Cash in Bank', type: 'ASSET', cashFlowGroup: 'CASH' },
  { code: '1030', name: 'E-Wallet (GCash)', type: 'ASSET', cashFlowGroup: 'CASH' },
  { code: '1100', name: 'Accounts Receivable - Members', type: 'ASSET', cashFlowGroup: 'OPERATING' },
  { code: '1200', name: 'Merchandise Inventory', type: 'ASSET', cashFlowGroup: 'OPERATING' },
  { code: '1500', name: 'Property and Equipment', type: 'ASSET', cashFlowGroup: 'INVESTING' },
  { code: '2010', name: 'Accounts Payable - Suppliers', type: 'LIABILITY', cashFlowGroup: 'OPERATING' },
  { code: '2020', name: 'Due to Consignors', type: 'LIABILITY', cashFlowGroup: 'OPERATING' },
  { code: '2030', name: 'Sales Tax Payable', type: 'LIABILITY', cashFlowGroup: 'OPERATING' },
  { code: '2100', name: 'Patronage Refund Payable', type: 'LIABILITY', cashFlowGroup: 'FINANCING' },
  { code: '2110', name: 'Interest on Share Capital Payable', type: 'LIABILITY', cashFlowGroup: 'FINANCING' },
  { code: '3010', name: "Members' Share Capital", type: 'EQUITY', cashFlowGroup: 'FINANCING' },
  { code: '3100', name: 'Reserve Fund', type: 'EQUITY', cashFlowGroup: 'FINANCING' },
  { code: '3110', name: 'Education and Training Fund (CETF)', type: 'EQUITY', cashFlowGroup: 'FINANCING' },
  { code: '3120', name: 'Community Development Fund (CDF)', type: 'EQUITY', cashFlowGroup: 'FINANCING' },
  { code: '3130', name: 'Optional Fund', type: 'EQUITY', cashFlowGroup: 'FINANCING' },
  { code: '3900', name: 'Net Surplus Distributed', type: 'EQUITY', cashFlowGroup: 'FINANCING' },
  { code: '4010', name: 'Sales', type: 'REVENUE', cashFlowGroup: 'OPERATING' },
  { code: '4020', name: 'Consignment Commission Income', type: 'REVENUE', cashFlowGroup: 'OPERATING' },
  { code: '4900', name: 'Other Income', type: 'REVENUE', cashFlowGroup: 'OPERATING' },
  { code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE', cashFlowGroup: 'OPERATING' },
  { code: '6010', name: 'Spoilage and Wastage', type: 'EXPENSE', cashFlowGroup: 'OPERATING' },
  { code: '6020', name: 'Cash Shortage', type: 'EXPENSE', cashFlowGroup: 'OPERATING' },
  { code: '6100', name: 'Salaries and Allowances', type: 'EXPENSE', cashFlowGroup: 'OPERATING' },
  { code: '6200', name: 'Utilities', type: 'EXPENSE', cashFlowGroup: 'OPERATING' },
  { code: '6300', name: 'Supplies', type: 'EXPENSE', cashFlowGroup: 'OPERATING' },
  { code: '6900', name: 'Miscellaneous Expense', type: 'EXPENSE', cashFlowGroup: 'OPERATING' },
];

export interface PostLine {
  code: string;
  debit?: Dec;
  credit?: Dec;
}

export interface PostEntryInput {
  description: string;
  sourceType: string;
  sourceId?: string | number | null;
  lines: PostLine[];
}

export interface StatementLine {
  code: string;
  name: string;
  amount: number;
}

export interface IncomeStatement {
  revenue: StatementLine[];
  costOfSales: StatementLine[];
  expenses: StatementLine[];
  totalRevenue: number;
  totalCostOfSales: number;
  grossProfit: number;
  totalExpenses: number;
  netSurplus: number;
}

export interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

export interface CashFlowSection {
  items: StatementLine[];
  total: number;
}

export interface CashFlowStatement {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netChange: number;
  openingCash: number;
  closingCash: number;
}

interface AccountSum {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  cashFlowGroup: string;
  debit: Dec;
  credit: Dec;
}

const isDebitNormal = (type: AccountType) => type === 'ASSET' || type === 'EXPENSE';

/** Balance on the account's normal side. */
function natural(row: AccountSum): Dec {
  return isDebitNormal(row.type) ? row.debit.sub(row.credit) : row.credit.sub(row.debit);
}

function toLines(rows: AccountSum[]): StatementLine[] {
  return rows
    .map((row) => ({ code: row.code, name: row.name, amount: num(natural(row)) }))
    .filter((line) => line.amount !== 0);
}

const total = (lines: StatementLine[]) =>
  Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;

export class AccountingService {
  static async ensureDefaultAccounts(db: Tx | typeof prisma, branchId: number) {
    await db.account.createMany({
      data: DEFAULT_ACCOUNTS.map((account) => ({ ...account, branchId, isSystem: true })),
      skipDuplicates: true,
    });
  }

  /**
   * Posts one balanced journal entry. Zero lines are dropped; an entry with no
   * amounts is skipped. Must run inside the caller's database transaction.
   */
  static async postEntry(db: Tx, ctx: Ctx, input: PostEntryInput) {
    const lines = input.lines
      .map((line) => ({
        code: line.code,
        debit: round2(line.debit ?? ZERO),
        credit: round2(line.credit ?? ZERO),
      }))
      .filter((line) => !line.debit.isZero() || !line.credit.isZero());

    if (lines.length === 0) return null;

    const debits = lines.reduce((sum, line) => sum.add(line.debit), ZERO);
    const credits = lines.reduce((sum, line) => sum.add(line.credit), ZERO);
    if (!debits.equals(credits)) {
      throw new Error(
        `Journal entry "${input.description}" is not balanced (debits ${debits.toFixed(2)}, credits ${credits.toFixed(2)}).`
      );
    }
    if (lines.some((line) => line.debit.isNegative() || line.credit.isNegative())) {
      throw new Error(`Journal entry "${input.description}" has a negative amount.`);
    }

    const codes = [...new Set(lines.map((line) => line.code))];
    const accounts = await db.account.findMany({
      where: { branchId: ctx.branchId, code: { in: codes } },
      select: { id: true, code: true },
    });
    const idByCode = new Map(accounts.map((account) => [account.code, account.id]));
    const missing = codes.filter((code) => !idByCode.has(code));
    if (missing.length > 0) {
      throw new Error(`Account ${missing.join(', ')} is missing from the chart of accounts.`);
    }

    return db.journalEntry.create({
      data: {
        branchId: ctx.branchId,
        date: ctx.at ?? new Date(),
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId != null ? String(input.sourceId) : null,
        createdById: ctx.userId,
        lines: {
          create: lines.map((line) => ({
            accountId: idByCode.get(line.code)!,
            debit: line.debit,
            credit: line.credit,
          })),
        },
      },
    });
  }

  /** Posts mirror-image entries for everything a source document posted. */
  static async reverseEntries(
    db: Tx,
    ctx: Ctx,
    source: { sourceTypes: string[]; sourceId: string; description: string; reversalType: string }
  ) {
    const entries = await db.journalEntry.findMany({
      where: {
        branchId: ctx.branchId,
        sourceType: { in: source.sourceTypes },
        sourceId: source.sourceId,
      },
      include: { lines: true },
    });

    for (const entry of entries) {
      await db.journalEntry.create({
        data: {
          branchId: ctx.branchId,
          date: ctx.at ?? new Date(),
          description: `${source.description} (reverses: ${entry.description})`,
          sourceType: source.reversalType,
          sourceId: source.sourceId,
          createdById: ctx.userId,
          lines: {
            create: entry.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.credit,
              credit: line.debit,
            })),
          },
        },
      });
    }
  }

  /** Debit and credit totals per account. `branchId` null means every cooperative. */
  static async accountSums(
    branchId: number | null,
    range: Partial<DateRange> = {}
  ): Promise<AccountSum[]> {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (range.from) dateFilter.gte = range.from;
    if (range.to) dateFilter.lt = range.to;

    const [accounts, sums] = await Promise.all([
      prisma.account.findMany({
        where: branchId === null ? {} : { branchId },
        orderBy: { code: 'asc' },
      }),
      prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          entry: {
            ...(branchId === null ? {} : { branchId }),
            ...(range.from || range.to ? { date: dateFilter } : {}),
          },
        },
        _sum: { debit: true, credit: true },
      }),
    ]);

    const byId = new Map(sums.map((row) => [row.accountId, row._sum]));

    return accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      cashFlowGroup: account.cashFlowGroup,
      debit: byId.get(account.id)?.debit ?? ZERO,
      credit: byId.get(account.id)?.credit ?? ZERO,
    }));
  }

  /** Merges same-code accounts, so a district-wide statement has one line per account. */
  private static mergeByCode(rows: AccountSum[]): AccountSum[] {
    const merged = new Map<string, AccountSum>();
    for (const row of rows) {
      const existing = merged.get(row.code);
      if (existing) {
        existing.debit = existing.debit.add(row.debit);
        existing.credit = existing.credit.add(row.credit);
      } else {
        merged.set(row.code, { ...row });
      }
    }
    return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  static async incomeStatement(branchId: number | null, range: DateRange): Promise<IncomeStatement> {
    const rows = this.mergeByCode(await this.accountSums(branchId, range));

    const revenue = toLines(rows.filter((row) => row.type === 'REVENUE'));
    const costOfSales = toLines(rows.filter((row) => row.type === 'EXPENSE' && row.code.startsWith('5')));
    const expenses = toLines(rows.filter((row) => row.type === 'EXPENSE' && !row.code.startsWith('5')));

    const totalRevenue = total(revenue);
    const totalCostOfSales = total(costOfSales);
    const totalExpenses = total(expenses);
    const grossProfit = Math.round((totalRevenue - totalCostOfSales) * 100) / 100;

    return {
      revenue,
      costOfSales,
      expenses,
      totalRevenue,
      totalCostOfSales,
      grossProfit,
      totalExpenses,
      netSurplus: Math.round((grossProfit - totalExpenses) * 100) / 100,
    };
  }

  /** Position at the end of `asOf` (exclusive instant). */
  static async balanceSheet(branchId: number | null, asOf: Date): Promise<BalanceSheet> {
    const rows = this.mergeByCode(await this.accountSums(branchId, { to: asOf }));

    const assets = toLines(rows.filter((row) => row.type === 'ASSET'));
    const liabilities = toLines(rows.filter((row) => row.type === 'LIABILITY'));
    const equity = toLines(rows.filter((row) => row.type === 'EQUITY'));

    // Revenue and expense accounts are never closed out; their running
    // difference is the surplus earned to date. Distributions sit in 3900.
    const earned = rows
      .filter((row) => row.type === 'REVENUE' || row.type === 'EXPENSE')
      .reduce((sum, row) => sum.add(row.credit).sub(row.debit), ZERO);
    if (!earned.isZero()) {
      equity.push({ code: '', name: 'Net Surplus Earned to Date', amount: num(earned) });
    }

    const totalAssets = total(assets);
    const totalLiabilities = total(liabilities);
    const totalEquity = total(equity);

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.005,
    };
  }

  /**
   * Direct-method cash flow. Each entry that touches a cash account is
   * explained by its other lines, grouped by that account's cash flow group.
   */
  static async cashFlow(branchId: number | null, range: DateRange): Promise<CashFlowStatement> {
    const entries = await prisma.journalEntry.findMany({
      where: {
        ...(branchId === null ? {} : { branchId }),
        date: { gte: range.from, lt: range.to },
        lines: { some: { account: { cashFlowGroup: 'CASH' } } },
      },
      include: { lines: { include: { account: true } } },
    });

    const buckets = new Map<string, { group: string; code: string; name: string; amount: Dec }>();
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.account.cashFlowGroup === 'CASH') continue;
        const key = line.account.code;
        const bucket = buckets.get(key) ?? {
          group: line.account.cashFlowGroup,
          code: line.account.code,
          name: line.account.name,
          amount: ZERO,
        };
        // A credit to the other account means cash came in.
        bucket.amount = bucket.amount.add(line.credit).sub(line.debit);
        buckets.set(key, bucket);
      }
    }

    const section = (group: string): CashFlowSection => {
      const items = [...buckets.values()]
        .filter((bucket) => bucket.group === group && !bucket.amount.isZero())
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((bucket) => ({ code: bucket.code, name: bucket.name, amount: num(bucket.amount) }));
      return { items, total: total(items) };
    };

    const cashAt = async (to: Date) => {
      const rows = await this.accountSums(branchId, { to });
      return num(
        rows
          .filter((row) => row.cashFlowGroup === 'CASH')
          .reduce((sum, row) => sum.add(row.debit).sub(row.credit), ZERO)
      );
    };

    const [openingCash, closingCash] = await Promise.all([cashAt(range.from), cashAt(range.to)]);
    const operating = section('OPERATING');
    const investing = section('INVESTING');
    const financing = section('FINANCING');

    return {
      operating,
      investing,
      financing,
      netChange: Math.round((operating.total + investing.total + financing.total) * 100) / 100,
      openingCash,
      closingCash,
    };
  }

  /** Chart of accounts with each account's current balance. */
  static async listAccounts(branchId: number) {
    const [rows, flags] = await Promise.all([
      this.accountSums(branchId),
      prisma.account.findMany({ where: { branchId }, select: { id: true, isSystem: true, isActive: true } }),
    ]);
    const flagById = new Map(flags.map((flag) => [flag.id, flag]));

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      cashFlowGroup: row.cashFlowGroup,
      balance: num(natural(row)),
      isSystem: flagById.get(row.id)?.isSystem ?? false,
      isActive: flagById.get(row.id)?.isActive ?? true,
    }));
  }

  static async createAccount(
    ctx: Ctx,
    input: { code: string; name: string; type: string; cashFlowGroup?: string }
  ) {
    const code = requireText(input.code, 'Account code', 10);
    if (!/^\d{4}$/.test(code)) throw new Error('Account code must be four digits.');
    const name = requireText(input.name, 'Account name', 80);

    const types: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
    if (!types.includes(input.type as AccountType)) throw new Error('Choose an account type.');

    const groups = ['CASH', 'OPERATING', 'INVESTING', 'FINANCING'];
    const cashFlowGroup = groups.includes(input.cashFlowGroup ?? '') ? input.cashFlowGroup! : 'OPERATING';
    if (cashFlowGroup === 'CASH' && input.type !== 'ASSET') {
      throw new Error('Only asset accounts can be cash accounts.');
    }

    const account = await prisma.account.create({
      data: { branchId: ctx.branchId, code, name, type: input.type as AccountType, cashFlowGroup },
    });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: 'ACCOUNT_CREATE',
      entityType: 'Account',
      entityId: account.id,
      details: { code, name },
    });
    return { id: account.id, code, name };
  }

  static async listJournal(branchId: number, range: DateRange, take = 300) {
    const entries = await prisma.journalEntry.findMany({
      where: { branchId, date: { gte: range.from, lt: range.to } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take,
      include: { lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { id: 'asc' } } },
    });

    return entries.map((entry) => ({
      id: entry.id,
      date: entry.date.toISOString(),
      description: entry.description,
      sourceType: entry.sourceType,
      lines: entry.lines.map((line) => ({
        code: line.account.code,
        name: line.account.name,
        debit: num(line.debit),
        credit: num(line.credit),
      })),
    }));
  }

  /** A simple two-line entry for anything the modules do not post themselves. */
  static async postManualEntry(
    ctx: Ctx,
    input: { description: string; debitCode: string; creditCode: string; amount: unknown }
  ) {
    const description = requireText(input.description, 'Description', 160);
    const amount = toAmount(input.amount, 'Amount');
    const debitCode = requireText(input.debitCode, 'Debit account', 10);
    const creditCode = requireText(input.creditCode, 'Credit account', 10);
    if (debitCode === creditCode) throw new Error('Debit and credit accounts must be different.');

    return prisma.$transaction(async (tx) => {
      const entry = await this.postEntry(tx, ctx, {
        description,
        sourceType: 'MANUAL',
        lines: [
          { code: debitCode, debit: amount },
          { code: creditCode, credit: amount },
        ],
      });
      await AuditService.log(
        {
          branchId: ctx.branchId,
          userId: ctx.userId,
          action: 'JOURNAL_MANUAL',
          entityType: 'JournalEntry',
          entityId: entry?.id,
          details: { description, debitCode, creditCode, amount: amount.toFixed(2) },
          at: ctx.at,
        },
        tx
      );
      return { id: entry!.id };
    });
  }

  /** Balances of the statutory funds and member payables, from the ledger. */
  static async fundBalances(branchId: number) {
    const rows = await this.accountSums(branchId);
    const balance = (code: string) => {
      const row = rows.find((candidate) => candidate.code === code);
      return row ? num(natural(row)) : 0;
    };
    return {
      reserveFund: balance(ACCOUNT.RESERVE_FUND),
      cetf: balance(ACCOUNT.CETF),
      cdf: balance(ACCOUNT.CDF),
      optionalFund: balance(ACCOUNT.OPTIONAL_FUND),
      patronagePayable: balance(ACCOUNT.PATRONAGE_PAYABLE),
      interestPayable: balance(ACCOUNT.INTEREST_PAYABLE),
    };
  }
}

