import {
  Product,
  InventoryItem,
  WeeklySalesData,
  QuickStatsData,
  PopularItem,
  RecentTransaction,
  POSItem,
  ProfitAnalyticsData,
  RevenueData,
  TopSellingItem
} from '../types';

// Products data
export const products: Product[] = [
  { id: 1, name: 'Classic Cheeseburger', sku: 'MEAL-001', category: 'Hot Meals', price: 275, stock: 142, image: '' },
  { id: 2, name: 'Pepperoni Slice', sku: 'MEAL-012', category: 'Hot Meals', price: 150, stock: 8, image: '' },
  { id: 3, name: 'Iced Latte', sku: 'BEV-045', category: 'Beverages', price: 225, stock: 56, image: '' },
  { id: 4, name: 'Vanilla Cone', sku: 'DSRT-002', category: 'Desserts', price: 100, stock: 89, image: '' },
];

// Inventory data with suppliers
export const inventory: InventoryItem[] = [
  { id: 1, name: 'Premium Beef Patty', packaging: 'Box of 50', sku: 'PRM-BP-050', category: 'Proteins', supplier: 'Meat Masters Inc.', deliveryDays: 'Mon, Thu', price: 4250, stock: 2, unit: 'Boxes', status: 'Low Stock' },
  { id: 2, name: 'Spring Water 500ml', packaging: 'Case of 24', sku: 'BEV-SW-500', category: 'Beverages', supplier: 'Aqua Pure Dist.', deliveryDays: 'Daily', price: 625, stock: 145, unit: 'Cases', status: 'Optimal' },
  { id: 3, name: 'Artisan Brioche Buns', packaging: 'Pack of 12', sku: 'BKY-BB-012', category: 'Bakery', supplier: 'Local Oven Co.', deliveryDays: 'Tue, Fri', price: 300, stock: 0, unit: 'Packs', status: 'Empty' },
  { id: 4, name: 'Espresso Roast Beans', packaging: '1kg Bag', sku: 'BEV-CB-1KG', category: 'Beverages', supplier: 'Global Roasters', deliveryDays: 'Wed', price: 1200, stock: 32, unit: 'Bags', status: 'Optimal' },
];

// Weekly sales trend data
export const weeklySales: WeeklySalesData[] = [
  { day: 'Mon', amount: 15000 },
  { day: 'Tue', amount: 18000 },
  { day: 'Wed', amount: 16000 },
  { day: 'Thu', amount: 22000 },
  { day: 'Fri', amount: 28000 },
  { day: 'Sat', amount: 12000 },
  { day: 'Sun', amount: 8000 },
];

// Quick stats
export const quickStats: QuickStatsData = {
  todaySales: 62250,
  salesChange: '+12%',
  activeOrders: 8,
  lowStockItems: 3,
};

// Popular items
export const popularItems: PopularItem[] = [
  { name: 'Classic Cheeseburger', sold: 142, emoji: '' },
  { name: 'Bottled Water', sold: 98, emoji: '' },
  { name: 'Crispy Chicken Wrap', sold: 115, emoji: '' },
  { name: 'Iced Latte', sold: 76, emoji: '' },
  { name: 'Caesar Salad', sold: 89, emoji: '' },
  { name: 'Chocolate Chip Cookie', sold: 64, emoji: '' },
];

// Recent transactions
export const recentTransactions: RecentTransaction[] = [
  { id: '#1048', time: '10:42 AM', amount: 1225, status: 'Completed' },
  { id: '#1047', time: '10:35 AM', amount: 400, status: 'Completed' },
  { id: '#1046', time: '10:28 AM', amount: 788, status: 'Preparing' },
  { id: '#1045', time: '10:15 AM', amount: 1605, status: 'Completed' },
];

// POS items
export const posItems: POSItem[] = [
  { id: 1, name: 'Cheese Pizza Slice', price: 175, category: 'Hot Meals', emoji: '', inStock: true },
  { id: 2, name: 'Cheeseburger na may burnik', price: 250, category: 'Hot Meals', emoji: '', inStock: true },
  { id: 3, name: 'Hot Coffee', price: 100, category: 'Beverages', emoji: '', inStock: true },
  { id: 4, name: 'Bottled Water', price: 75, category: 'Beverages', emoji: '', inStock: true },
  { id: 5, name: 'Garden Salad', price: 225, category: 'Snacks', emoji: '', inStock: true },
  { id: 6, name: 'French Fries', price: 125, category: 'Snacks', emoji: '', inStock: false },
  { id: 7, name: 'Vanilla Cone', price: 75, category: 'Desserts', emoji: '', inStock: true },
  { id: 8, name: 'Croissant', price: 125, category: 'Desserts', emoji: '', inStock: true },
];

// Profit Analytics
export const profitAnalytics: ProfitAnalyticsData = {
  totalRevenue: 6225000,
  revenueChange: '+12.5%',
  totalProfit: 2140000,
  profitChange: '+8.2%',
  totalOrders: 1248,
  ordersChange: '-2.4%',
};

// Revenue over time
export const revenueOverTime: RevenueData[] = [
  { month: 'Jan', amount: 800000 },
  { month: 'Feb', amount: 950000 },
  { month: 'Mar', amount: 1400000 },
  { month: 'Apr', amount: 1100000 },
  { month: 'May', amount: 1200000 },
  { month: 'Jun', amount: 1000000 },
];

// Top selling items
export const topSellingItems: TopSellingItem[] = [
  { rank: 1, name: 'Premium Bottled Water', unitsSold: 482, revenue: 72300 },
  { rank: 2, name: 'Chicken Salad Sandwich', unitsSold: 320, revenue: 104000 },
  { rank: 3, name: 'Energy Bar - Chocolate', unitsSold: 295, revenue: 44250 },
];
