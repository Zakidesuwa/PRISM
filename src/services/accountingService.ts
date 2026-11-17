// src/services/accountingService.ts
//
// Double-entry general ledger. Every module (sales, inventory, members, cash
// counts, vendor payouts, surplus distribution) posts here, and the financial
// statements are computed from the posted lines only.
import { AccountSubtype, AccountType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ZERO, num, requireText, round2, toAmount, type Dec } from '@/lib/money';
import { manilaDateOf, startOfDay, type DateRange } from '@/lib/dates';
import {
  SUBTYPE_LABELS,
  cashFlowCategory,
  typeOfSubtype,
  validateAccountInput,
  type CashFlowCategory,
} from '@/lib/accounting/chartOfAccounts';
import { validateJournalLines, type AccountRef } from '@/lib/accounting/ledger';
import {
  computeBalanceSheet,
  computeCashFlow,
  computeIncomeStatement,
  computeTrialBalance,
  type BalanceSheet,
  type CashFlowStatement,
  type IncomeStatement,
  type LedgerAccount,
  type Posting,
  type TrialBalance,
} from '@/lib/accounting/statements';
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
  subtype: AccountSubtype;
  description?: string;
  /** Only when it differs from the default for the subtype. */
  cashFlow?: CashFlowCategory;
}

/**
 * The chart of accounts every cooperative starts with. Grouped by statement
 * section (Dench's AccountSubtype), so the statements can show current vs
 * non-current and operating vs other items.
 */
export const DEFAULT_ACCOUNTS: AccountSeed[] = [
  { code: '1010', name: 'Cash on Hand', subtype: 'CASH', description: 'POS drawer cash and undeposited collections.' },
  { code: '1020', name: 'Cash in Bank', subtype: 'CASH' },
  { code: '1030', name: 'E-Wallet (GCash)', subtype: 'CASH' },
  { code: '1100', name: 'Accounts Receivable - Members', subtype: 'CURRENT_ASSET', description: 'Charge sales not yet paid by members.' },
  { code: '1200', name: 'Merchandise Inventory', subtype: 'CURRENT_ASSET', description: 'Stock at weighted-average cost; relieved by sales and spoilage.' },
  { code: '1300', name: 'Prepaid Expenses', subtype: 'CURRENT_ASSET' },
  { code: '1500', name: 'Property and Equipment', subtype: 'NON_CURRENT_ASSET' },
  { code: '1510', name: 'Accumulated Depreciation', subtype: 'NON_CURRENT_ASSET', description: 'Contra-asset: carries a credit balance.' },
  { code: '2010', name: 'Accounts Payable - Suppliers', subtype: 'CURRENT_LIABILITY', description: 'Deliveries received on account.' },
  { code: '2020', name: 'Due to Consignors', subtype: 'CURRENT_LIABILITY', description: "Vendors' share of consigned-goods sales, payable on payout." },
  { code: '2030', name: 'Sales Tax Payable', subtype: 'CURRENT_LIABILITY', description: 'Tax collected at the POS, payable on remittance.' },
  { code: '2040', name: 'Accrued Expenses', subtype: 'CURRENT_LIABILITY' },
  // Paying these out is a distribution to members: a financing activity.
  { code: '2100', name: 'Patronage Refund Payable', subtype: 'CURRENT_LIABILITY', cashFlow: 'FINANCING' },
  { code: '2110', name: 'Interest on Share Capital Payable', subtype: 'CURRENT_LIABILITY', cashFlow: 'FINANCING' },
  { code: '2500', name: 'Loans Payable', subtype: 'NON_CURRENT_LIABILITY' },
  { code: '3010', name: "Members' Share Capital", subtype: 'EQUITY', description: 'Paid-up capital contributed by members.' },
  { code: '3100', name: 'Reserve Fund', subtype: 'EQUITY' },
  { code: '3110', name: 'Education and Training Fund (CETF)', subtype: 'EQUITY' },
  { code: '3120', name: 'Community Development Fund (CDF)', subtype: 'EQUITY' },
  { code: '3130', name: 'Optional Fund', subtype: 'EQUITY' },
  { code: '3900', name: 'Net Surplus Distributed', subtype: 'EQUITY', description: 'Offsets the surplus allocated by a finalized distribution.' },
  { code: '4010', name: 'Sales', subtype: 'OPERATING_REVENUE', description: 'Net-of-tax sales of cooperative-owned goods.' },
  { code: '4020', name: 'Consignment Commission Income', subtype: 'OPERATING_REVENUE', description: "The cooperative's share of consigned-goods sales." },
  { code: '4900', name: 'Other Income', subtype: 'OTHER_INCOME', description: 'Includes cash overages from drawer counts.' },
  { code: '4910', name: 'Interest Income', subtype: 'OTHER_INCOME' },
  { code: '5010', name: 'Cost of Goods Sold', subtype: 'COST_OF_SALES' },
  { code: '6010', name: 'Spoilage and Wastage', subtype: 'OPERATING_EXPENSE' },
  { code: '6020', name: 'Cash Shortage', subtype: 'OTHER_EXPENSE', description: 'Drawer cash counted below the expected amount.' },
  { code: '6100', name: 'Salaries and Allowances', subtype: 'OPERATING_EXPENSE' },
  { code: '6200', name: 'Utilities', subtype: 'OPERATING_EXPENSE' },
  { code: '6300', name: 'Supplies', subtype: 'OPERATING_EXPENSE' },
  { code: '6400', name: 'Rent', subtype: 'OPERATING_EXPENSE' },
  { code: '6500', name: 'Repairs and Maintenance', subtype: 'OPERATING_EXPENSE' },
  { code: '6600', name: 'Depreciation', subtype: 'OPERATING_EXPENSE' },
  { code: '6900', name: 'Miscellaneous Expense', subtype: 'OPERATING_EXPENSE' },
];

/** The stored cash flow group: CASH for cash accounts, else the override or the subtype's default. */
export function cashFlowGroupFor(subtype: AccountSubtype, override?: CashFlowCategory | null): string {
  return subtype === 'CASH' ? 'CASH' : override ?? cashFlowCategory(subtype) ?? 'OPERATING';
}

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

export type { BalanceSheet, CashFlowStatement, IncomeStatement, TrialBalance };

/** One posted entry as the Journal tab shows it. */
export interface JournalRow {
  id: number;
  date: string;
  description: string;
  sourceType: string;
  canReverse: boolean;
  reversedById: number | null;
  reversesId: number | null;
  lines: { code: string; name: string; debit: number; credit: number }[];
}

export interface ManualEntryInput {
  description: string;
  /** Manila business date, YYYY-MM-DD. Defaults to today. */
  date?: string;
  lines: { code: string; debit: unknown; credit: unknown }[];
}

interface AccountSum {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  cashFlowGroup: string;
  debit: Dec;
  credit: Dec;
}

const isDebitNormal = (type: AccountType) => type === 'ASSET' || type === 'EXPENSE';

/** Balance on the account's normal side. */
function natural(row: AccountSum): Dec {
  return isDebitNormal(row.type) ? row.debit.sub(row.credit) : row.credit.sub(row.debit);
}

/** [from, to) instants -> inclusive Manila business dates, as Dench's statements expect. */
function toKeys(range: DateRange): { from: string; to: string } {
  return { from: manilaDateOf(range.from), to: manilaDateOf(new Date(range.to.getTime() - 1)) };
}

export class AccountingService {
  static async ensureDefaultAccounts(db: Tx | typeof prisma, branchId: number) {
    await db.account.createMany({
      data: DEFAULT_ACCOUNTS.map((account) => ({
        branchId,
        code: account.code,
        name: account.name,
        type: typeOfSubtype(account.subtype),
        subtype: account.subtype,
        description: account.description ?? null,
        cashFlowGroup: cashFlowGroupFor(account.subtype, account.cashFlow),
        isSystem: true,
      })),
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
      subtype: account.subtype,
      cashFlowGroup: account.cashFlowGroup,
      debit: byId.get(account.id)?.debit ?? ZERO,
      credit: byId.get(account.id)?.credit ?? ZERO,
    }));
  }

  /**
   * Accounts and journal postings in the shape Dench's statement engine reads
   * (src/lib/accounting/statements.ts). `branchId` null loads every
   * cooperative, with same-code accounts merged so each account appears once.
   * Only postings before `to` are loaded; `from` narrows it further when the
   * caller only needs one period (the income statement).
   */
  static async loadLedger(
    branchId: number | null,
    window: { from?: Date; to: Date }
  ): Promise<{ accounts: LedgerAccount[]; postings: Posting[] }> {
    const [accounts, lines] = await Promise.all([
      prisma.account.findMany({ where: branchId === null ? {} : { branchId }, orderBy: [{ code: 'asc' }, { id: 'asc' }] }),
      prisma.journalLine.findMany({
        where: {
          entry: {
            ...(branchId === null ? {} : { branchId }),
            date: { ...(window.from ? { gte: window.from } : {}), lt: window.to },
          },
        },
        select: { accountId: true, debit: true, credit: true, entry: { select: { id: true, date: true } } },
      }),
    ]);

    // One canonical account per code (the first cooperative's), so a
    // district-wide statement has one line per account.
    const canonical = new Map<string, (typeof accounts)[number]>();
    const canonicalIdOf = new Map<number, number>();
    for (const account of accounts) {
      if (!canonical.has(account.code)) canonical.set(account.code, account);
      canonicalIdOf.set(account.id, canonical.get(account.code)!.id);
    }

    return {
      accounts: [...canonical.values()].map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        isActive: account.isActive,
        systemKey: account.isSystem ? account.code : null,
        cashFlow:
          account.cashFlowGroup === 'CASH' ? null : (account.cashFlowGroup as CashFlowCategory),
      })),
      postings: lines.map((line) => ({
        entryId: String(line.entry.id),
        date: manilaDateOf(line.entry.date),
        accountId: canonicalIdOf.get(line.accountId)!,
        debit: num(line.debit),
        credit: num(line.credit),
      })),
    };
  }

  static async incomeStatement(branchId: number | null, range: DateRange): Promise<IncomeStatement> {
    const { accounts, postings } = await this.loadLedger(branchId, range);
    const keys = toKeys(range);
    return computeIncomeStatement(accounts, postings, keys.from, keys.to);
  }

  /** Position at the end of the business day before `asOf` (an exclusive instant). */
  static async balanceSheet(branchId: number | null, asOf: Date): Promise<BalanceSheet> {
    const { accounts, postings } = await this.loadLedger(branchId, { to: asOf });
    return computeBalanceSheet(accounts, postings, manilaDateOf(new Date(asOf.getTime() - 1)));
  }

  /** Direct-method cash flow (see computeCashFlow). */
  static async cashFlow(branchId: number | null, range: DateRange): Promise<CashFlowStatement> {
    const { accounts, postings } = await this.loadLedger(branchId, { to: range.to });
    const keys = toKeys(range);
    return computeCashFlow(accounts, postings, keys.from, keys.to);
  }

  static async trialBalance(branchId: number | null, asOf: Date): Promise<TrialBalance> {
    const { accounts, postings } = await this.loadLedger(branchId, { to: asOf });
    return computeTrialBalance(accounts, postings, manilaDateOf(new Date(asOf.getTime() - 1)));
  }

  /** Chart of accounts with each account's current balance. */
  static async listAccounts(branchId: number) {
    const [rows, details] = await Promise.all([
      this.accountSums(branchId),
      prisma.account.findMany({
        where: { branchId },
        select: { id: true, isSystem: true, isActive: true, description: true },
      }),
    ]);
    const detailById = new Map(details.map((detail) => [detail.id, detail]));

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      subtype: row.subtype,
      subtypeLabel: SUBTYPE_LABELS[row.subtype],
      cashFlowGroup: row.cashFlowGroup,
      description: detailById.get(row.id)?.description ?? null,
      balance: num(natural(row)),
      isSystem: detailById.get(row.id)?.isSystem ?? false,
      isActive: detailById.get(row.id)?.isActive ?? true,
    }));
  }

  /**
   * Adds an account. The group decides the type and where it shows on the
   * statements; the code must fit the group's range (Dench's rules).
   */
  static async createAccount(
    ctx: Ctx,
    input: { code: string; name: string; subtype: string; description?: string; cashFlow?: string }
  ) {
    const subtype = input.subtype as AccountSubtype;
    if (!(subtype in SUBTYPE_LABELS)) throw new Error('Choose an account group.');

    const existing = await prisma.account.findMany({ where: { branchId: ctx.branchId }, select: { code: true } });
    const error = validateAccountInput(
      { code: input.code, name: input.name, subtype, description: input.description },
      existing.map((account) => account.code)
    );
    if (error) throw new Error(error);

    const override = ['OPERATING', 'INVESTING', 'FINANCING'].includes(input.cashFlow ?? '')
      ? (input.cashFlow as CashFlowCategory)
      : null;
    const code = input.code.trim();
    const name = input.name.trim();

    const account = await prisma.account.create({
      data: {
        branchId: ctx.branchId,
        code,
        name,
        type: typeOfSubtype(subtype),
        subtype,
        description: input.description?.trim() || null,
        cashFlowGroup: cashFlowGroupFor(subtype, override),
      },
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

  /** Hides an account from new entries. System accounts, and accounts with a balance, stay active. */
  static async setAccountActive(ctx: Ctx, accountId: number, isActive: boolean) {
    const account = await prisma.account.findFirst({ where: { id: accountId, branchId: ctx.branchId } });
    if (!account) throw new Error('Account not found.');
    if (!isActive) {
      if (account.isSystem) throw new Error('The system posts to this account automatically, so it stays active.');
      const balance = (await this.listAccounts(ctx.branchId)).find((row) => row.id === accountId)?.balance ?? 0;
      if (balance !== 0) throw new Error('Only accounts with a zero balance can be deactivated.');
    }
    await prisma.account.update({ where: { id: accountId }, data: { isActive } });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: isActive ? 'ACCOUNT_ACTIVATE' : 'ACCOUNT_DEACTIVATE',
      entityType: 'Account',
      entityId: accountId,
    });
    return { code: account.code, isActive };
  }

  static async listJournal(branchId: number, range: DateRange, take = 300): Promise<JournalRow[]> {
    const entries = await prisma.journalEntry.findMany({
      where: { branchId, date: { gte: range.from, lt: range.to } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take,
      include: {
        reversedBy: { select: { id: true } },
        lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { id: 'asc' } },
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      date: entry.date.toISOString(),
      description: entry.description,
      sourceType: entry.sourceType,
      // Only hand-entered entries are reversed here; system postings are
      // reversed by their own module (voids, reopened cash counts...).
      canReverse: entry.sourceType === 'MANUAL' && !entry.reversedBy,
      reversedById: entry.reversedBy?.id ?? null,
      reversesId: entry.reversesId,
      lines: entry.lines.map((line) => ({
        code: line.account.code,
        name: line.account.name,
        debit: num(line.debit),
        credit: num(line.credit),
      })),
    }));
  }

  /**
   * A journal entry with any number of lines, for anything the modules do not
   * post themselves (expenses, supplier payments, bank deposits, equipment).
   * Validated with Dench's double-entry rules: at least two accounts, each
   * line a debit or a credit, debits equal credits, active accounts only.
   */
  static async postManualEntry(ctx: Ctx, input: ManualEntryInput) {
    const description = requireText(input.description, 'Description', 160);

    let date: Date | undefined;
    if (input.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Choose a valid date.');
      if (input.date > manilaDateOf(new Date())) throw new Error('A journal entry cannot be dated in the future.');
      // Noon keeps the entry inside its business day.
      date = new Date(startOfDay(input.date).getTime() + 12 * 3600000);
    }

    const accounts = await prisma.account.findMany({ where: { branchId: ctx.branchId } });
    const byCode = new Map(accounts.map((account) => [account.code, account]));
    const refs = new Map<number, AccountRef>(
      accounts.map((account) => [
        account.id,
        { id: account.id, code: account.code, name: account.name, type: account.type, isActive: account.isActive },
      ])
    );

    const parseAmount = (value: unknown, label: string) =>
      value === '' || value === null || value === undefined ? 0 : num(toAmount(value, label, { allowZero: true }));

    const lines = (input.lines ?? []).map((line, index) => {
      const account = byCode.get(String(line.code ?? '').trim());
      return {
        accountId: account?.id ?? -1,
        debit: parseAmount(line.debit, `Line ${index + 1} debit`),
        credit: parseAmount(line.credit, `Line ${index + 1} credit`),
      };
    });
    const error = validateJournalLines(lines, refs);
    if (error) throw new Error(error);

    const codeById = new Map(accounts.map((account) => [account.id, account.code]));
    return prisma.$transaction(async (tx) => {
      const entry = await this.postEntry(tx, { ...ctx, at: date ?? ctx.at }, {
        description,
        sourceType: 'MANUAL',
        lines: lines.map((line) => ({
          code: codeById.get(line.accountId)!,
          debit: new Prisma.Decimal(line.debit),
          credit: new Prisma.Decimal(line.credit),
        })),
      });
      await AuditService.log(
        {
          branchId: ctx.branchId,
          userId: ctx.userId,
          action: 'JOURNAL_MANUAL',
          entityType: 'JournalEntry',
          entityId: entry?.id,
          details: { description, lines: lines.length },
          at: ctx.at,
        },
        tx
      );
      return { id: entry!.id };
    });
  }

  /**
   * Corrects a manual entry the accountant's way (Dench's rule): entries are
   * never edited or deleted; a mirror-image entry is posted instead.
   */
  static async reverseManualEntry(ctx: Ctx, entryId: number, reason: string) {
    const why = requireText(reason, 'Reason', 160);
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id: entryId, branchId: ctx.branchId },
        include: { lines: true, reversedBy: { select: { id: true } } },
      });
      if (!entry) throw new Error('Journal entry not found.');
      if (entry.sourceType !== 'MANUAL') {
        throw new Error('Only manual entries are reversed here. System postings are reversed by voiding or reopening their source.');
      }
      if (entry.reversedBy) throw new Error('This entry has already been reversed.');

      const reversal = await tx.journalEntry.create({
        data: {
          branchId: ctx.branchId,
          date: ctx.at ?? new Date(),
          description: `Reversal of JE-${entry.id}: ${why}`,
          sourceType: 'REVERSAL',
          sourceId: String(entry.id),
          reversesId: entry.id,
          createdById: ctx.userId,
          lines: {
            create: entry.lines.map((line) => ({ accountId: line.accountId, debit: line.credit, credit: line.debit })),
          },
        },
      });
      await AuditService.log(
        {
          branchId: ctx.branchId,
          userId: ctx.userId,
          action: 'JOURNAL_REVERSE',
          entityType: 'JournalEntry',
          entityId: entry.id,
          details: { reversal: reversal.id, reason: why },
        },
        tx
      );
      return { id: reversal.id, reverses: entry.id };
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

