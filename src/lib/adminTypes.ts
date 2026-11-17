// src/lib/adminTypes.ts
// Shapes used by the district admin panel. Pure: safe for client components.

export type UnitLevel = 'Elementary' | 'High School' | 'College';
export type StockStatus = 'In Stock' | 'Low Stock' | 'Stock Out';

export interface Cooperative {
  id: number;
  name: string;
  address: string;
  level: UnitLevel;
  /** Net surplus for the current month, from the cooperative's books. */
  monthlyProfit: number;
  stockStatus: StockStatus;
}

export interface CooperativeStats {
  totalMonthlyProfit: number;
  profitChange: number;
  activeCooperatives: number;
  /** Percent of stock lines across the district that are not empty. */
  operationalEfficiency: number;
  /** Average sale amount this month. */
  avgTransaction: number;
  /** Cooperatives with at least one low or empty stock line. */
  stockAlerts: number;
}

export interface MonthlyFlow {
  month: string;
  income: number;
  expenses: number;
}

export interface SummaryStat {
  label: string;
  value: number;
  caption: string;
  change: number;
}

export interface Performer {
  rank: number;
  id: number;
  name: string;
  /** Gross profit earned per item sold this month, in pesos. */
  netMargin: number;
  change: number;
}

export interface LeaderboardItem extends Performer {
  address: string;
  level: UnitLevel;
  monthlyProfit: number;
  stockStatus: StockStatus;
}

export type ProductStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type ProductCategory = string;

export interface ProductLine {
  id: number;
  name: string;
  category: ProductCategory;
  costPrice: number;
  sellingPrice: number;
  status: ProductStatus;
}

export interface DayTurnover {
  day: string;
  /** Sales and cost of stock sold, each as a percent of the busiest day. */
  sales: number;
  inventory: number;
}

export interface CooperativeDetail {
  coop: Cooperative;
  lastUpdated: string;
  monthlySales: number;
  salesChange: number;
  netProfit: number;
  profitChange: number;
  /** Gross margin this month, percent of sales. */
  efficiencyRatio: number;
  lowStockItems: number;
  turnover: DayTurnover[];
  storeLocation: string;
  skuCount: number;
  categoryCount: number;
  products: ProductLine[];
}

export type StockLevelStatus = 'In Stock' | 'Reorder Soon' | 'Low Stock' | 'Out of Stock';

export interface DistrictInventoryItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  cooperative: string;
  onHand: number;
  /** The item's full stock level. */
  capacity: number;
  reorderLevel: number;
  costPrice: number;
  /** Null for ingredients that are not sold on their own. */
  sellingPrice: number | null;
}

export interface DistrictInventoryStats {
  itemsOut: number;
  totalValuation: number;
  needsReorder: number;
  cooperativeCount: number;
}

/** Derived from the numbers in the row, so the badge and the bar cannot disagree. */
export function stockStatus(item: DistrictInventoryItem): StockLevelStatus {
  if (item.onHand <= 0) return 'Out of Stock';
  if (item.onHand <= item.reorderLevel) return 'Low Stock';
  if (item.capacity > 0 && item.onHand / item.capacity < 0.5) return 'Reorder Soon';
  return 'In Stock';
}

export function stockRatio(item: DistrictInventoryItem): number {
  if (item.capacity <= 0) return 0;
  return Math.max(0, Math.min(1, item.onHand / item.capacity));
}
