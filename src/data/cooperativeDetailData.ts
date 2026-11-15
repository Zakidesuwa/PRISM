// Per-school performance detail for the admin prototype.
// Everything is derived from the directory record so the detail page and the
// directory always agree. Replace with real queries in Phase 2.

import { cooperatives, type Cooperative } from './cooperativeMockData';

export type ProductStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type ProductCategory = 'Beverage' | 'Food' | 'Stationery';

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
  /** Percent of the day's capacity, 0–100. Stacked in the chart. */
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
  efficiencyRatio: number;
  lowStockItems: number;
  turnover: DayTurnover[];
  storeLocation: string;
  skuCount: number;
  categoryCount: number;
  products: ProductLine[];
}

/** Deterministic per-school variation — see the note in cooperativeMockData. */
function createRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** The five products shown in the design, with cost filled in so that
 *  cost + net profit = selling price on every row. */
const CATALOG: Omit<ProductLine, 'id' | 'status'>[] = [
  { name: 'Mineral Water 500ml', category: 'Beverage', costPrice: 5.0, sellingPrice: 7.3 },
  { name: 'Fruit Bar - Mix Berry', category: 'Food', costPrice: 6.0, sellingPrice: 12.5 },
  { name: 'Fresh Apple (Piece)', category: 'Food', costPrice: 9.0, sellingPrice: 15.99 },
  { name: 'Pencil', category: 'Stationery', costPrice: 4.4, sellingPrice: 5.4 },
  { name: 'Yellow Pad', category: 'Stationery', costPrice: 6.05, sellingPrice: 6.75 },
  { name: 'Ballpen (Black)', category: 'Stationery', costPrice: 6.5, sellingPrice: 10.0 },
  { name: 'Spiral Notebook', category: 'Stationery', costPrice: 24.0, sellingPrice: 38.5 },
  { name: 'Instant Noodles Cup', category: 'Food', costPrice: 14.25, sellingPrice: 22.0 },
  { name: 'Cheese Sandwich', category: 'Food', costPrice: 18.0, sellingPrice: 30.0 },
  { name: 'Iced Tea 350ml', category: 'Beverage', costPrice: 11.0, sellingPrice: 18.0 },
  { name: 'Bottled Juice', category: 'Beverage', costPrice: 15.5, sellingPrice: 25.0 },
  { name: 'Chocolate Bar', category: 'Food', costPrice: 12.75, sellingPrice: 20.0 },
  { name: 'Banana Cue', category: 'Food', costPrice: 8.0, sellingPrice: 15.0 },
  { name: 'Bread Roll', category: 'Food', costPrice: 5.75, sellingPrice: 10.0 },
  { name: 'Hot Coffee 8oz', category: 'Beverage', costPrice: 9.25, sellingPrice: 18.0 },
  { name: 'Eraser', category: 'Stationery', costPrice: 3.2, sellingPrice: 5.0 },
  { name: 'Ruler 12"', category: 'Stationery', costPrice: 7.4, sellingPrice: 12.0 },
  { name: 'Bond Paper (10s)', category: 'Stationery', costPrice: 9.6, sellingPrice: 15.0 },
];

/** Statuses for the first five rows are fixed to match the design. */
const FEATURED_STATUS: ProductStatus[] = [
  'In Stock',
  'Low Stock',
  'In Stock',
  'Out of Stock',
  'In Stock',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WINGS = ['West Wing', 'East Wing', 'Main Building', 'Annex Building', 'North Wing'];
const FLOORS = ['ground floor', 'second floor', 'mezzanine'];

export function getCooperativeDetail(coop: Cooperative): CooperativeDetail {
  const random = createRandom(coop.id * 7919 + 13);

  // The directory's monthly profit is the source of truth; sales are derived
  // from it using a plausible net margin so the two pages never disagree.
  const margin = 0.28 + random() * 0.09;
  const netProfit = coop.monthlyProfit;
  const monthlySales = Math.round((netProfit / margin) * 100) / 100;

  const turnover: DayTurnover[] = DAYS.map((day, index) => {
    // A gentle upward trend across the week, as in the design. Ranges are
    // capped so the stacked total always stays under the 100% axis.
    const ramp = 24 + index * 4;
    const sales = Math.round(ramp + random() * 10);
    const inventory = Math.round(18 + random() * 14);
    return { day, sales, inventory };
  });

  const products: ProductLine[] = CATALOG.map((item, index) => ({
    ...item,
    id: index + 1,
    status:
      index < FEATURED_STATUS.length
        ? FEATURED_STATUS[index]
        : index % 7 === 3
          ? 'Low Stock'
          : index % 11 === 5
            ? 'Out of Stock'
            : 'In Stock',
  }));

  return {
    coop,
    lastUpdated: 'January 24, 2026',
    monthlySales,
    salesChange: Math.round((8 + random() * 9) * 10) / 10,
    netProfit,
    profitChange: Math.round((4 + random() * 8) * 10) / 10,
    efficiencyRatio: Math.round((88 + random() * 10) * 10) / 10,
    lowStockItems: 8 + Math.floor(random() * 12),
    turnover,
    storeLocation: `${WINGS[coop.id % WINGS.length]}, ${FLOORS[coop.id % FLOORS.length]}`,
    skuCount: 250 + Math.floor(random() * 40) * 10,
    categoryCount: 5,
    products,
  };
}

export function findCooperative(id: number): Cooperative | undefined {
  return cooperatives.find((coop) => coop.id === id);
}
