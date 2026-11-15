export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  image: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  packaging: string;
  sku: string;
  category: string;
  supplier: string;
  deliveryDays: string;
  price: number;
  stock: number;
  unit: string;
  status: string;
}

export interface WeeklySalesData {
  day: string;
  amount: number;
}

export interface QuickStatsData {
  todaySales: number;
  salesChange: string;
  activeOrders: number;
  lowStockItems: number;
}

export interface PopularItem {
  name: string;
  sold: number;
  emoji: string;
}

export interface RecentTransaction {
  id: string;
  time: string;
  amount: number;
  status: string;
}

export interface POSItem {
  id: number;
  name: string;
  price: number;
  category: string;
  emoji: string;
  inStock: boolean;
}

export interface ProfitAnalyticsData {
  totalRevenue: number;
  revenueChange: string;
  totalProfit: number;
  profitChange: string;
  totalOrders: number;
  ordersChange: string;
}

export interface RevenueData {
  month: string;
  amount: number;
}

export interface TopSellingItem {
  rank: number;
  name: string;
  unitsSold: number;
  revenue: number;
}
