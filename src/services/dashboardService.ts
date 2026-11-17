// src/services/dashboardService.ts
//
// Read-only figures for the store dashboard and the profit analytics page.
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { num } from '@/lib/money';
import {
  addDays,
  dayRange,
  manilaToday,
  monthLabel,
  monthRange,
  rangeOf,
  shiftMonth,
  startOfDay,
  weekdayLabel,
  type DateRange,
} from '@/lib/dates';
import { AccountingService } from './accountingService';
import { InventoryService } from './inventoryService';

export interface SalesBucket {
  bucket: string;
  sales: number;
  total: number;
  cogs: number;
  count: number;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export class DashboardService {
  /** Completed sales grouped by Manila day or month. Null branch = all cooperatives. */
  static async salesBuckets(
    branchId: number | null,
    range: DateRange,
    bucket: 'day' | 'month'
  ): Promise<SalesBucket[]> {
    const format = bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
    const branchFilter = branchId === null ? Prisma.empty : Prisma.sql`AND "branchId" = ${branchId}`;

    const rows = await prisma.$queryRaw<
      { bucket: string; sales: Prisma.Decimal; total: Prisma.Decimal; cogs: Prisma.Decimal; count: number }[]
    >`
      SELECT to_char("createdAt" + interval '8 hours', ${format}) AS bucket,
             COALESCE(SUM("subtotal"), 0) AS sales,
             COALESCE(SUM("totalAmount"), 0) AS total,
             COALESCE(SUM("costOfGoods"), 0) AS cogs,
             COUNT(*)::int AS count
      FROM "Transaction"
      WHERE "status" = 'COMPLETED'
        AND "createdAt" >= ${range.from}
        AND "createdAt" < ${range.to}
        ${branchFilter}
      GROUP BY 1
      ORDER BY 1
    `;

    return rows.map((row) => ({
      bucket: row.bucket,
      sales: num(row.sales),
      total: num(row.total),
      cogs: num(row.cogs),
      count: row.count,
    }));
  }

  static async topItems(branchId: number | null, range: DateRange, take: number) {
    const rows = await prisma.transactionItem.groupBy({
      by: ['productName'],
      where: {
        transaction: {
          ...(branchId === null ? {} : { branchId }),
          status: 'COMPLETED',
          createdAt: { gte: range.from, lt: range.to },
        },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take,
    });
    return rows.map((row, index) => ({
      rank: index + 1,
      name: row.productName,
      unitsSold: row._sum.quantity ?? 0,
      revenue: num(row._sum.subtotal),
    }));
  }

  static async getDashboard(branchId: number) {
    const today = manilaToday();
    const weekStart = addDays(today, -6);

    const [buckets, popular, recent, lowStockItems] = await Promise.all([
      this.salesBuckets(branchId, rangeOf(addDays(today, -7), today), 'day'),
      this.topItems(branchId, rangeOf(addDays(today, -29), today), 6),
      prisma.transaction.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, transactionNumber: true, createdAt: true, totalAmount: true, status: true, paymentMethod: true },
      }),
      InventoryService.lowStockCount(branchId),
    ]);

    const byDay = new Map(buckets.map((bucket) => [bucket.bucket, bucket]));
    const weeklySales = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return { day: weekdayLabel(date), date, amount: byDay.get(date)?.total ?? 0 };
    });

    const todaySales = byDay.get(today)?.total ?? 0;
    const yesterdaySales = byDay.get(addDays(today, -1))?.total ?? 0;

    return {
      weeklySales,
      todaySales,
      salesChange: percentChange(todaySales, yesterdaySales),
      todayTransactions: byDay.get(today)?.count ?? 0,
      lowStockItems,
      popularItems: popular.map((item) => ({ name: item.name, sold: item.unitsSold })),
      recentTransactions: recent.map((sale) => ({
        id: sale.id,
        number: sale.transactionNumber,
        createdAt: sale.createdAt.toISOString(),
        amount: num(sale.totalAmount),
        status: sale.status,
        paymentMethod: sale.paymentMethod,
      })),
    };
  }

  static async getAnalytics(branchId: number) {
    const today = manilaToday();
    const thisMonth = monthRange(today);
    const lastMonth = monthRange(shiftMonth(today, -1));

    const monthStarts = Array.from({ length: 6 }, (_, index) => shiftMonth(today, index - 5));
    const weekStarts = Array.from({ length: 8 }, (_, index) => addDays(today, -7 * (7 - index) - 6));

    const [current, previous, orders, monthly, weekly, topSelling] = await Promise.all([
      AccountingService.incomeStatement(branchId, thisMonth),
      AccountingService.incomeStatement(branchId, lastMonth),
      this.salesBuckets(branchId, { from: lastMonth.from, to: thisMonth.to }, 'month'),
      Promise.all(
        monthStarts.map(async (start) => ({
          label: monthLabel(start),
          amount: (await AccountingService.incomeStatement(branchId, monthRange(start))).revenue.total,
        }))
      ),
      Promise.all(
        weekStarts.map(async (start) => ({
          label: `${monthLabel(start)} ${Number(start.slice(8, 10))}`,
          amount: (
            await AccountingService.incomeStatement(branchId, {
              from: startOfDay(start),
              to: dayRange(addDays(start, 6)).to,
            })
          ).revenue.total,
        }))
      ),
      this.topItems(branchId, thisMonth, 5),
    ]);

    const ordersThisMonth = orders.find((row) => row.bucket === today.slice(0, 7))?.count ?? 0;
    const ordersLastMonth = orders.find((row) => row.bucket === shiftMonth(today, -1).slice(0, 7))?.count ?? 0;

    return {
      totalRevenue: current.revenue.total,
      revenueChange: percentChange(current.revenue.total, previous.revenue.total),
      totalProfit: current.netIncome,
      profitChange: percentChange(current.netIncome, previous.netIncome),
      totalOrders: ordersThisMonth,
      ordersChange: percentChange(ordersThisMonth, ordersLastMonth),
      monthly,
      weekly,
      topSelling,
    };
  }
}

export { percentChange };
