// src/services/adminService.ts
//
// District-wide, read-only views for the administrator. Everything here is
// computed from the cooperatives' own records.
import prisma from '@/lib/prisma';
import { ZERO, num } from '@/lib/money';
import {
  addDays,
  longDate,
  manilaDateOf,
  manilaToday,
  monthLabel,
  monthRange,
  rangeOf,
  shiftMonth,
  weekdayLabel,
  type DateRange,
} from '@/lib/dates';
import type {
  Cooperative,
  CooperativeDetail,
  CooperativeStats,
  DistrictInventoryItem,
  DistrictInventoryStats,
  LeaderboardItem,
  MonthlyFlow,
  ProductLine,
  StockStatus,
  SummaryStat,
  UnitLevel,
} from '@/lib/adminTypes';
import { AccountingService } from './accountingService';
import { DashboardService, percentChange } from './dashboardService';
import { ProductService } from './productService';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Net surplus per cooperative for a period, from the ledger. */
async function surplusByBranch(range: DateRange): Promise<Map<number, number>> {
  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({
      where: { type: { in: ['REVENUE', 'EXPENSE'] } },
      select: { id: true, branchId: true },
    }),
    prisma.journalLine.groupBy({
      by: ['accountId'],
      where: { entry: { date: { gte: range.from, lt: range.to } } },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const branchOf = new Map(accounts.map((account) => [account.id, account.branchId]));
  const result = new Map<number, number>();
  for (const row of sums) {
    const branchId = branchOf.get(row.accountId);
    if (branchId === undefined) continue;
    const net = (row._sum.credit ?? ZERO).sub(row._sum.debit ?? ZERO).toNumber();
    result.set(branchId, round2((result.get(branchId) ?? 0) + net));
  }
  return result;
}

async function stockStatusByBranch(): Promise<Map<number, { status: StockStatus; low: number; out: number; lines: number }>> {
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    select: { branchId: true, stock: true, reorderLevel: true },
  });

  const result = new Map<number, { status: StockStatus; low: number; out: number; lines: number }>();
  for (const item of items) {
    const entry = result.get(item.branchId) ?? { status: 'In Stock' as StockStatus, low: 0, out: 0, lines: 0 };
    entry.lines += 1;
    if (item.stock.lte(0)) entry.out += 1;
    else if (item.stock.lte(item.reorderLevel)) entry.low += 1;
    entry.status = entry.out > 0 ? 'Stock Out' : entry.low > 0 ? 'Low Stock' : 'In Stock';
    result.set(item.branchId, entry);
  }
  return result;
}

/** Gross profit and items sold per cooperative for a period. */
async function marginByBranch(range: DateRange) {
  const [sales, items] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['branchId'],
      where: { status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
      _sum: { subtotal: true, costOfGoods: true, totalAmount: true },
      _count: true,
    }),
    prisma.transactionItem.groupBy({
      by: ['transactionId'],
      where: { transaction: { status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } } },
      _sum: { quantity: true, vendorShare: true },
    }),
  ]);

  const owners = await prisma.transaction.findMany({
    where: { id: { in: items.map((row) => row.transactionId) } },
    select: { id: true, branchId: true },
  });
  const branchOf = new Map(owners.map((sale) => [sale.id, sale.branchId]));

  const quantity = new Map<number, number>();
  const vendorShare = new Map<number, number>();
  for (const row of items) {
    const branchId = branchOf.get(row.transactionId)!;
    quantity.set(branchId, (quantity.get(branchId) ?? 0) + (row._sum.quantity ?? 0));
    vendorShare.set(branchId, (vendorShare.get(branchId) ?? 0) + num(row._sum.vendorShare));
  }

  return new Map(
    sales.map((row) => {
      const grossProfit = num(row._sum.subtotal) - num(row._sum.costOfGoods) - (vendorShare.get(row.branchId) ?? 0);
      const units = quantity.get(row.branchId) ?? 0;
      return [
        row.branchId,
        {
          sales: num(row._sum.subtotal),
          collected: num(row._sum.totalAmount),
          count: row._count,
          grossProfit: round2(grossProfit),
          perItem: units > 0 ? round2(grossProfit / units) : 0,
        },
      ];
    })
  );
}

export class AdminService {
  static async getCooperatives(): Promise<{ cooperatives: Cooperative[]; stats: CooperativeStats }> {
    const today = manilaToday();
    const thisMonth = monthRange(today);
    const lastMonth = monthRange(shiftMonth(today, -1));

    const [branches, current, previous, stock, margins] = await Promise.all([
      prisma.schoolBranch.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
      surplusByBranch(thisMonth),
      surplusByBranch(lastMonth),
      stockStatusByBranch(),
      marginByBranch(thisMonth),
    ]);

    const cooperatives: Cooperative[] = branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      level: branch.level as UnitLevel,
      monthlyProfit: current.get(branch.id) ?? 0,
      stockStatus: stock.get(branch.id)?.status ?? 'In Stock',
    }));

    const sum = (map: Map<number, number>) => [...map.values()].reduce((total, value) => total + value, 0);
    const lines = [...stock.values()].reduce((total, entry) => total + entry.lines, 0);
    const out = [...stock.values()].reduce((total, entry) => total + entry.out, 0);
    const collected = [...margins.values()].reduce((total, entry) => total + entry.collected, 0);
    const count = [...margins.values()].reduce((total, entry) => total + entry.count, 0);

    return {
      cooperatives,
      stats: {
        totalMonthlyProfit: round2(sum(current)),
        profitChange: percentChange(sum(current), sum(previous)),
        activeCooperatives: branches.length,
        operationalEfficiency: lines > 0 ? Math.round(((lines - out) / lines) * 100) : 100,
        avgTransaction: count > 0 ? round2(collected / count) : 0,
        stockAlerts: cooperatives.filter((coop) => coop.stockStatus !== 'In Stock').length,
      },
    };
  }

  /** Cooperatives ranked by gross profit per item sold this month. */
  static async getLeaderboard(): Promise<LeaderboardItem[]> {
    const today = manilaToday();
    const [{ cooperatives }, current, previous] = await Promise.all([
      this.getCooperatives(),
      marginByBranch(monthRange(today)),
      marginByBranch(monthRange(shiftMonth(today, -1))),
    ]);

    return cooperatives
      .map((coop) => ({
        ...coop,
        rank: 0,
        netMargin: current.get(coop.id)?.perItem ?? 0,
        change: percentChange(current.get(coop.id)?.perItem ?? 0, previous.get(coop.id)?.perItem ?? 0),
      }))
      .sort((a, b) => b.netMargin - a.netMargin)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  /** Twelve months of income and expenses across the district, plus headline cards. */
  static async getOverview(): Promise<{ flows: MonthlyFlow[]; stats: SummaryStat[] }> {
    const today = manilaToday();
    const months = Array.from({ length: 12 }, (_, index) => shiftMonth(today, index - 11));

    const [statements, cash] = await Promise.all([
      Promise.all(months.map((start) => AccountingService.incomeStatement(null, monthRange(start)))),
      AccountingService.accountSums(null),
    ]);

    const flows = statements.map((statement, index) => ({
      month: monthLabel(months[index]),
      income: round2(statement.revenue.total + statement.otherIncome.total),
      expenses: round2(statement.costOfSales.total + statement.operatingExpenses.total + statement.otherExpenses.total),
    }));

    const cashBalance = num(
      cash.filter((row) => row.cashFlowGroup === 'CASH').reduce((sum, row) => sum.add(row.debit).sub(row.credit), ZERO)
    );
    const latest = flows[flows.length - 1];
    const before = flows[flows.length - 2];
    const netThisMonth = latest.income - latest.expenses;

    return {
      flows,
      stats: [
        {
          label: 'Total Balance',
          value: cashBalance,
          caption: 'Cash across all cooperatives',
          change: percentChange(cashBalance, cashBalance - netThisMonth),
        },
        { label: 'Income', value: latest.income, caption: 'This month so far', change: percentChange(latest.income, before.income) },
        { label: 'Expenses', value: latest.expenses, caption: 'This month so far', change: percentChange(latest.expenses, before.expenses) },
      ],
    };
  }

  static async getCooperativeDetail(id: number): Promise<CooperativeDetail | null> {
    const branch = await prisma.schoolBranch.findUnique({ where: { id } });
    if (!branch) return null;

    const today = manilaToday();
    const thisMonth = monthRange(today);
    const lastMonth = monthRange(shiftMonth(today, -1));

    const [current, previous, stock, products, buckets, lastSale] = await Promise.all([
      AccountingService.incomeStatement(id, thisMonth),
      AccountingService.incomeStatement(id, lastMonth),
      stockStatusByBranch(),
      ProductService.list(id, { activeOnly: true }),
      DashboardService.salesBuckets(id, rangeOf(addDays(today, -8), today), 'day'),
      prisma.transaction.findFirst({ where: { branchId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    // The last six trading days (the stores are closed on Sundays).
    const days: string[] = [];
    for (let offset = 0; days.length < 6 && offset < 9; offset += 1) {
      const date = addDays(today, -offset);
      if (weekdayLabel(date) !== 'Sun') days.unshift(date);
    }
    const byDay = new Map(buckets.map((bucket) => [bucket.bucket, bucket]));
    const peak = Math.max(1, ...days.map((date) => (byDay.get(date)?.sales ?? 0) + (byDay.get(date)?.cogs ?? 0)));

    const productLines: ProductLine[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      costPrice: product.vendorId ? round2(product.price * 0.85) : product.unitCost,
      sellingPrice: product.price,
      status: product.available === 0 ? 'Out of Stock' : product.available !== null && product.available < 10 ? 'Low Stock' : 'In Stock',
    }));

    const info = stock.get(id);

    return {
      coop: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        level: branch.level as UnitLevel,
        monthlyProfit: current.netIncome,
        stockStatus: info?.status ?? 'In Stock',
      },
      lastUpdated: longDate(lastSale ? manilaDateOf(lastSale.createdAt) : today),
      monthlySales: current.revenue.total,
      salesChange: percentChange(current.revenue.total, previous.revenue.total),
      netProfit: current.netIncome,
      profitChange: percentChange(current.netIncome, previous.netIncome),
      efficiencyRatio: current.grossMarginPct === null ? 0 : round2(current.grossMarginPct),
      lowStockItems: (info?.low ?? 0) + (info?.out ?? 0),
      turnover: days.map((date) => ({
        day: weekdayLabel(date),
        sales: Math.round(((byDay.get(date)?.sales ?? 0) / peak) * 100),
        inventory: Math.round(((byDay.get(date)?.cogs ?? 0) / peak) * 100),
      })),
      storeLocation: branch.storeLocation ?? branch.address,
      skuCount: products.length,
      categoryCount: new Set(products.map((product) => product.category)).size,
      products: productLines,
    };
  }

  static async getDistrictInventory(): Promise<{
    items: DistrictInventoryItem[];
    stats: DistrictInventoryStats;
    cooperatives: string[];
  }> {
    const [rows, branches] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { isActive: true, branch: { isActive: true } },
        orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
        include: {
          branch: { select: { name: true } },
          // A resale product: this item is its only ingredient, one per unit.
          productIngredients: {
            where: { product: { isActive: true } },
            include: { product: { include: { _count: { select: { ingredients: true } } } } },
          },
        },
      }),
      prisma.schoolBranch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { name: true } }),
    ]);

    const items: DistrictInventoryItem[] = rows.map((row) => {
      const resale = row.productIngredients.find(
        (part) => part.quantityRequired.equals(1) && part.product._count.ingredients === 1
      );
      return {
        id: row.id,
        name: row.name,
        sku: row.sku,
        category: row.category,
        cooperative: row.branch.name,
        onHand: num(row.stock),
        capacity: num(row.parLevel),
        reorderLevel: num(row.reorderLevel),
        costPrice: num(row.unitCost.toDecimalPlaces(2)),
        sellingPrice: resale ? num(resale.product.price) : null,
      };
    });

    return {
      items,
      cooperatives: branches.map((branch) => branch.name),
      stats: {
        itemsOut: items.filter((item) => item.onHand <= 0).length,
        totalValuation: round2(items.reduce((sum, item) => sum + item.onHand * item.costPrice, 0)),
        needsReorder: items.filter((item) => item.onHand <= item.reorderLevel).length,
        cooperativeCount: branches.length,
      },
    };
  }
}
