// src/services/surplusService.ts
//
// Net surplus distribution, wired to the books: the surplus comes from the
// income statement, patronage from the year's member purchases, and a
// finalized distribution is posted to the ledger.
import prisma from '@/lib/prisma';
import { D, ZERO, num } from '@/lib/money';
import { manilaToday, yearRange } from '@/lib/dates';
import {
  DEFAULT_RATES,
  computeDistribution,
  parseMoneyToCentavos,
  type DistributionMember,
  type DistributionRates,
} from '@/lib/surplus/distribution';
import type { Ctx } from './context';
import { ACCOUNT, AccountingService } from './accountingService';
import { AuditService } from './auditService';

export interface DistributionSummary {
  id: number;
  fiscalYear: number;
  netSurplus: number;
  reserveFund: number;
  cetf: number;
  cdf: number;
  optionalFund: number;
  patronageRefundPool: number;
  interestPool: number;
  memberCount: number;
  createdAt: string;
}

const fromCentavos = (centavos: number) => D(centavos).div(100);

export class SurplusService {
  /** Members with the two bases for a fiscal year: purchases made and share capital held. */
  static async getMembers(branchId: number, fiscalYear: number): Promise<DistributionMember[]> {
    const range = yearRange(fiscalYear);
    const [members, purchases, branch] = await Promise.all([
      prisma.coopMember.findMany({ where: { branchId }, orderBy: { fullName: 'asc' } }),
      prisma.transaction.groupBy({
        by: ['memberId'],
        where: {
          branchId,
          status: 'COMPLETED',
          memberId: { not: null },
          createdAt: { gte: range.from, lt: range.to },
        },
        _sum: { totalAmount: true },
      }),
      prisma.schoolBranch.findUniqueOrThrow({ where: { id: branchId }, select: { name: true } }),
    ]);

    const purchased = new Map(purchases.map((row) => [row.memberId, row._sum.totalAmount ?? ZERO]));

    return members.map((member) => ({
      id: member.id,
      memberCode: member.memberCode,
      fullName: member.fullName,
      branchName: branch.name,
      status: member.status,
      patronageCentavos: parseMoneyToCentavos((purchased.get(member.id) ?? ZERO).toFixed(2)) ?? 0,
      shareCapitalCentavos: parseMoneyToCentavos(member.shareCapital.toFixed(2)) ?? 0,
    }));
  }

  /** Net surplus for the year, straight from the income statement. */
  static async getNetSurplus(branchId: number, fiscalYear: number): Promise<number> {
    const statement = await AccountingService.incomeStatement(branchId, yearRange(fiscalYear));
    return statement.netIncome;
  }

  static async getYears(branchId: number): Promise<number[]> {
    const first = await prisma.journalEntry.findFirst({
      where: { branchId },
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    const currentYear = Number(manilaToday().slice(0, 4));
    const firstYear = first ? Number(first.date.toISOString().slice(0, 4)) : currentYear;
    const years: number[] = [];
    for (let year = currentYear; year >= Math.min(firstYear, currentYear); year -= 1) years.push(year);
    return years;
  }

  static async listDistributions(branchId: number): Promise<DistributionSummary[]> {
    const rows = await prisma.surplusDistribution.findMany({
      where: { branchId },
      orderBy: { fiscalYear: 'desc' },
      include: { _count: { select: { allocations: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      fiscalYear: row.fiscalYear,
      netSurplus: num(row.netSurplus),
      reserveFund: num(row.reserveFund),
      cetf: num(row.cetf),
      cdf: num(row.cdf),
      optionalFund: num(row.optionalFund),
      patronageRefundPool: num(row.patronageRefundPool),
      interestPool: num(row.interestPool),
      memberCount: row._count.allocations,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Finalizes a year's distribution. The net surplus is always re-read from the
   * books, never taken from the browser, and the allocation is posted:
   * statutory funds to equity, member shares to payables.
   */
  static async finalize(ctx: Ctx, fiscalYear: number, rates: DistributionRates = DEFAULT_RATES) {
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      throw new Error('Choose a valid fiscal year.');
    }

    const netSurplus = await this.getNetSurplus(ctx.branchId, fiscalYear);
    if (netSurplus <= 0) {
      throw new Error(`There is no net surplus to distribute for ${fiscalYear}.`);
    }

    const members = await this.getMembers(ctx.branchId, fiscalYear);
    const result = computeDistribution({
      netSurplus: Math.round(netSurplus * 100),
      rates,
      members,
    });

    const refundsPaid = result.patronageRefundPool - result.undistributedPatronage;
    const interestPaid = result.shareCapitalInterestPool - result.undistributedInterest;

    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.surplusDistribution.findUnique({
          where: { branchId_fiscalYear: { branchId: ctx.branchId, fiscalYear } },
        });
        if (existing) throw new Error(`The ${fiscalYear} distribution has already been finalized.`);

        const distribution = await tx.surplusDistribution.create({
          data: {
            branchId: ctx.branchId,
            fiscalYear,
            netSurplus: fromCentavos(result.netSurplus),
            reserveFundBps: rates.reserveFundBps,
            cetfBps: rates.cetfBps,
            cdfBps: rates.cdfBps,
            optionalFundBps: rates.optionalFundBps,
            patronagePoolBps: rates.patronagePoolBps,
            reserveFund: fromCentavos(result.reserveFund),
            cetf: fromCentavos(result.cetf),
            cdf: fromCentavos(result.cdf),
            optionalFund: fromCentavos(result.optionalFund),
            patronageRefundPool: fromCentavos(refundsPaid),
            interestPool: fromCentavos(interestPaid),
            createdById: ctx.userId!,
            allocations: {
              create: result.members
                .map((allocation, index) => ({ allocation, member: members[index] }))
                .filter(({ allocation }) => allocation.total > 0)
                .map(({ allocation, member }) => ({
                  memberId: member.id,
                  patronageBasis: fromCentavos(member.patronageCentavos),
                  shareCapitalBasis: fromCentavos(member.shareCapitalCentavos),
                  patronageRefund: fromCentavos(allocation.patronageRefund),
                  capitalInterest: fromCentavos(allocation.shareCapitalInterest),
                })),
            },
          },
        });

        const appropriated =
          result.reserveFund + result.cetf + result.cdf + result.optionalFund + refundsPaid + interestPaid;

        await AccountingService.postEntry(tx, ctx, {
          description: `Net surplus distribution ${fiscalYear}`,
          sourceType: 'DISTRIBUTION',
          sourceId: distribution.id,
          lines: [
            { code: ACCOUNT.APPROPRIATED, debit: fromCentavos(appropriated) },
            { code: ACCOUNT.RESERVE_FUND, credit: fromCentavos(result.reserveFund) },
            { code: ACCOUNT.CETF, credit: fromCentavos(result.cetf) },
            { code: ACCOUNT.CDF, credit: fromCentavos(result.cdf) },
            { code: ACCOUNT.OPTIONAL_FUND, credit: fromCentavos(result.optionalFund) },
            { code: ACCOUNT.PATRONAGE_PAYABLE, credit: fromCentavos(refundsPaid) },
            { code: ACCOUNT.INTEREST_PAYABLE, credit: fromCentavos(interestPaid) },
          ],
        });

        await AuditService.log(
          {
            branchId: ctx.branchId,
            userId: ctx.userId,
            action: 'SURPLUS_FINALIZE',
            entityType: 'SurplusDistribution',
            entityId: distribution.id,
            details: { fiscalYear, netSurplus: netSurplus.toFixed(2) },
          },
          tx
        );

        return { id: distribution.id, fiscalYear };
      },
      { timeout: 20000 }
    );
  }

  /** Undoes a finalized distribution: its ledger entry is reversed and the record removed. */
  static async reverse(ctx: Ctx, distributionId: number) {
    return prisma.$transaction(async (tx) => {
      const distribution = await tx.surplusDistribution.findFirst({
        where: { id: distributionId, branchId: ctx.branchId },
      });
      if (!distribution) throw new Error('Distribution not found.');

      await AccountingService.reverseEntries(tx, ctx, {
        sourceTypes: ['DISTRIBUTION'],
        sourceId: String(distribution.id),
        description: `Reversed distribution ${distribution.fiscalYear}`,
        reversalType: 'DISTRIBUTION_REVERSAL',
      });
      await tx.surplusDistribution.delete({ where: { id: distribution.id } });
      await AuditService.log(
        {
          branchId: ctx.branchId,
          userId: ctx.userId,
          action: 'SURPLUS_REVERSE',
          entityType: 'SurplusDistribution',
          entityId: distribution.id,
          details: { fiscalYear: distribution.fiscalYear },
        },
        tx
      );
      return { fiscalYear: distribution.fiscalYear };
    });
  }
}
