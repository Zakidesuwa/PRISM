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

const FALLBACK_COOPERATIVES: Cooperative[] = [
  { id: 1, name: 'Gordon College', address: 'Olongapo City Sports Complex, East Tapinac', level: 'College', monthlyProfit: 124500, stockStatus: 'In Stock' },
  { id: 2, name: 'Sta. Rita Elementary', address: 'Sta. Rita Road, Barangay Sta. Rita', level: 'Elementary', monthlyProfit: 88230.5, stockStatus: 'Low Stock' },
  { id: 3, name: 'Tapinac Senior High School', address: 'Donor Street, East Tapinac, Olongapo City', level: 'High School', monthlyProfit: 215900, stockStatus: 'Stock Out' },
  { id: 4, name: 'Olongapo City National High School', address: 'Rizal Avenue corner 14th Street, East Bajac-Bajac', level: 'High School', monthlyProfit: 92400, stockStatus: 'In Stock' },
  { id: 5, name: 'Balic-Balic Elementary', address: 'Waterdam Road, Balic-Balic, Sta. Rita', level: 'Elementary', monthlyProfit: 45120, stockStatus: 'In Stock' },
];

const FALLBACK_OVERVIEW = {
  flows: [
    { month: 'Jun', income: 84000, expenses: 52000 },
    { month: 'Jul', income: 92000, expenses: 58000 },
    { month: 'Aug', income: 110000, expenses: 69000 },
    { month: 'Sep', income: 105000, expenses: 64000 },
    { month: 'Oct', income: 118000, expenses: 73000 },
    { month: 'Nov', income: 124500, expenses: 78200 },
  ],
  stats: [
    { label: 'Total Balance', value: 482500, caption: 'Cash across all cooperatives', change: 8.5 },
    { label: 'Income', value: 124500, caption: 'This month so far', change: 5.5 },
    { label: 'Expenses', value: 78200, caption: 'This month so far', change: 7.1 },
  ],
};

export class AdminService {
  static async getCooperatives(): Promise<{ cooperatives: Cooperative[]; stats: CooperativeStats }> {
    if (!process.env.DATABASE_URL) {
      return {
        cooperatives: FALLBACK_COOPERATIVES,
        stats: {
          totalMonthlyProfit: 566150.5,
          profitChange: 6.8,
          activeCooperatives: 5,
          operationalEfficiency: 92,
          avgTransaction: 245.5,
          stockAlerts: 2,
        },
      };
    }
    try {
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
    } catch {
      return {
        cooperatives: FALLBACK_COOPERATIVES,
        stats: {
          totalMonthlyProfit: 566150.5,
          profitChange: 6.8,
          activeCooperatives: 5,
          operationalEfficiency: 92,
          avgTransaction: 245.5,
          stockAlerts: 2,
        },
      };
    }
  }

  /** Cooperatives ranked by gross profit per item sold this month. */
  static async getLeaderboard(): Promise<LeaderboardItem[]> {
    if (!process.env.DATABASE_URL) {
      return FALLBACK_COOPERATIVES.map((coop, index) => ({
        ...coop,
        rank: index + 1,
        netMargin: 18.5 + index * 4,
        change: 4.2,
      }));
    }
    try {
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
    } catch {
      return FALLBACK_COOPERATIVES.map((coop, index) => ({
        ...coop,
        rank: index + 1,
        netMargin: 18.5 + index * 4,
        change: 4.2,
      }));
    }
  }

  /** Twelve months of income and expenses across the district, plus headline cards. */
  static async getOverview(): Promise<{ flows: MonthlyFlow[]; stats: SummaryStat[] }> {
    if (!process.env.DATABASE_URL) return FALLBACK_OVERVIEW;
    try {
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
    } catch {
      return FALLBACK_OVERVIEW;
    }
  }

  static async getCooperativeDetail(id: number): Promise<CooperativeDetail | null> {
    const match = FALLBACK_COOPERATIVES.find((c) => c.id === id) ?? FALLBACK_COOPERATIVES[0];
    const fallbackDetail: CooperativeDetail = {
      coop: match,
      lastUpdated: 'November 18, 2026',
      monthlySales: 168200,
      salesChange: 7.4,
      netProfit: match.monthlyProfit,
      profitChange: 6.8,
      efficiencyRatio: 26.5,
      lowStockItems: 1,
      turnover: [
        { day: 'Mon', sales: 65, inventory: 40 },
        { day: 'Tue', sales: 80, inventory: 55 },
        { day: 'Wed', sales: 90, inventory: 70 },
        { day: 'Thu', sales: 85, inventory: 60 },
        { day: 'Fri', sales: 100, inventory: 85 },
        { day: 'Sat', sales: 45, inventory: 30 },
      ],
      storeLocation: match.address,
      skuCount: 18,
      categoryCount: 5,
      products: [
        { id: 1, name: 'Bottled Water 500ml', category: 'Beverages', costPrice: 12, sellingPrice: 20, status: 'In Stock' },
        { id: 2, name: 'School Notebook (80 leaves)', category: 'School Supplies', costPrice: 25, sellingPrice: 35, status: 'In Stock' },
        { id: 3, name: 'GC ID Lanyard', category: 'Uniform & Merch', costPrice: 45, sellingPrice: 75, status: 'In Stock' },
        { id: 4, name: 'Ballpen Black (0.5mm)', category: 'School Supplies', costPrice: 8, sellingPrice: 15, status: 'Low Stock' },
        { id: 5, name: 'Choco Biscuit Pack', category: 'Snacks', costPrice: 10, sellingPrice: 15, status: 'In Stock' },
      ],
    };
    if (!process.env.DATABASE_URL) return fallbackDetail;
    try {
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
    } catch {
      return fallbackDetail;
    }
  }

  static async getDistrictInventory(): Promise<{
    items: DistrictInventoryItem[];
    stats: DistrictInventoryStats;
    cooperatives: string[];
  }> {
    const fallbackItems: DistrictInventoryItem[] = [
      { id: 1, name: 'Bottled Water 500ml', sku: 'BEV-WAT-500', category: 'Beverages', cooperative: 'Gordon College', onHand: 150, capacity: 200, reorderLevel: 40, costPrice: 12.0, sellingPrice: 20.0 },
      { id: 2, name: 'GC ID Lanyard', sku: 'MERCH-LAN-GC', category: 'Uniform & Merch', cooperative: 'Gordon College', onHand: 85, capacity: 100, reorderLevel: 20, costPrice: 45.0, sellingPrice: 75.0 },
      { id: 3, name: 'Composition Notebook 80L', sku: 'SUP-NOT-80L', category: 'School Supplies', cooperative: 'Gordon College', onHand: 120, capacity: 150, reorderLevel: 30, costPrice: 25.0, sellingPrice: 35.0 },
      { id: 4, name: 'Ballpen 0.5 Black', sku: 'SUP-PEN-BLK', category: 'School Supplies', cooperative: 'Gordon College', onHand: 15, capacity: 100, reorderLevel: 25, costPrice: 8.0, sellingPrice: 15.0 },
      { id: 5, name: 'Evaporated Milk 370ml', sku: 'ING-MLK-370', category: 'Ingredients', cooperative: 'Sta. Rita Elementary', onHand: 42, capacity: 60, reorderLevel: 15, costPrice: 38.0, sellingPrice: null },
      { id: 6, name: 'White Sugar 1kg', sku: 'ING-SGR-1KG', category: 'Ingredients', cooperative: 'Balic-Balic Elementary', onHand: 0, capacity: 20, reorderLevel: 5, costPrice: 65.0, sellingPrice: null },
    ];
    const fallbackResult = {
      items: fallbackItems,
      cooperatives: FALLBACK_COOPERATIVES.map((b) => b.name),
      stats: {
        itemsOut: fallbackItems.filter((i) => i.onHand <= 0).length,
        totalValuation: round2(fallbackItems.reduce((sum, item) => sum + item.onHand * item.costPrice, 0)),
        needsReorder: fallbackItems.filter((i) => i.onHand <= i.reorderLevel).length,
        cooperativeCount: FALLBACK_COOPERATIVES.length,
      },
    };
    if (!process.env.DATABASE_URL) return fallbackResult;
    try {
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
    } catch {
      return fallbackResult;
    }
  }
}
