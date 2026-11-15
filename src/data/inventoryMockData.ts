// Synthetic district-wide inventory for the admin prototype.
// Replace with real queries in Phase 2 — see IMPLEMENTATION_PLAN.md.

export type InventoryCategory = 'Food' | 'Beverage' | 'Stationery';
export type StockLevelStatus = 'In Stock' | 'Reorder Soon' | 'Low Stock' | 'Out of Stock';

export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  category: InventoryCategory;
  cooperative: string;
  onHand: number;
  capacity: number;
  costPrice: number;
  sellingPrice: number;
}

/** Deterministic generator — see the note in cooperativeMockData. */
function createRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/**
 * Status is derived from how full the shelf is, so the badge, the bar and the
 * "items out" alert can never disagree with the numbers in the row.
 */
export function stockStatus(item: InventoryItem): StockLevelStatus {
  if (item.onHand === 0) return 'Out of Stock';

  const ratio = item.onHand / item.capacity;
  if (ratio < 0.25) return 'Low Stock';
  if (ratio < 0.75) return 'Reorder Soon';
  return 'In Stock';
}

export function stockRatio(item: InventoryItem): number {
  if (item.capacity === 0) return 0;
  return Math.min(1, item.onHand / item.capacity);
}

/** The twelve cooperatives in the inventory pilot, plus district-wide stock. */
export const DISTRICT_WIDE = 'All Schools';

export const inventoryCooperatives = [
  'Gordon College',
  'Sta. Rita Elementary',
  'Tapinac Senior High School',
  'Olongapo City National High School',
  'Balic-Balic Elementary',
  'Kalaklan Elementary School',
  'Mabayuan National High School',
  'New Cabalan Central School',
  'Barretto Senior High School',
  'East Bajac-Bajac Elementary School',
  'Gordon Heights Integrated School',
  'Pag-asa Science High School',
];

interface CatalogEntry {
  name: string;
  sku: string;
  category: InventoryCategory;
  costPrice: number;
  sellingPrice: number;
}

const CATALOG: CatalogEntry[] = [
  { name: 'Pancit Canton', sku: 'EDU-LP-042', category: 'Food', costPrice: 12.5, sellingPrice: 18.0 },
  { name: 'C2 Apple', sku: 'EDU-BK-118', category: 'Beverage', costPrice: 15.75, sellingPrice: 22.0 },
  { name: 'Cracklings', sku: 'EDU-FR-902', category: 'Food', costPrice: 9.4, sellingPrice: 15.0 },
  { name: 'Bond Paper', sku: 'EDU-WT-223', category: 'Stationery', costPrice: 9.6, sellingPrice: 15.0 },
  { name: 'Mineral Water 500ml', sku: 'EDU-MW-500', category: 'Beverage', costPrice: 5.0, sellingPrice: 7.3 },
  { name: 'Instant Noodles Cup', sku: 'EDU-IN-311', category: 'Food', costPrice: 14.25, sellingPrice: 22.0 },
  { name: 'Cheese Sandwich', sku: 'EDU-CS-208', category: 'Food', costPrice: 18.0, sellingPrice: 30.0 },
  { name: 'Iced Tea 350ml', sku: 'EDU-IT-350', category: 'Beverage', costPrice: 11.0, sellingPrice: 18.0 },
  { name: 'Chocolate Bar', sku: 'EDU-CB-771', category: 'Food', costPrice: 12.75, sellingPrice: 20.0 },
  { name: 'Ballpen (Black)', sku: 'EDU-BP-014', category: 'Stationery', costPrice: 6.5, sellingPrice: 10.0 },
  { name: 'Spiral Notebook', sku: 'EDU-SN-660', category: 'Stationery', costPrice: 24.0, sellingPrice: 38.5 },
  { name: 'Bottled Juice', sku: 'EDU-BJ-127', category: 'Beverage', costPrice: 15.5, sellingPrice: 25.0 },
  { name: 'Banana Cue', sku: 'EDU-BC-505', category: 'Food', costPrice: 8.0, sellingPrice: 15.0 },
  { name: 'Bread Roll', sku: 'EDU-BR-088', category: 'Food', costPrice: 5.75, sellingPrice: 10.0 },
  { name: 'Hot Coffee 8oz', sku: 'EDU-HC-800', category: 'Beverage', costPrice: 9.25, sellingPrice: 18.0 },
  { name: 'Pencil', sku: 'EDU-PN-101', category: 'Stationery', costPrice: 4.4, sellingPrice: 5.4 },
  { name: 'Yellow Pad', sku: 'EDU-YP-233', category: 'Stationery', costPrice: 6.05, sellingPrice: 6.75 },
  { name: 'Eraser', sku: 'EDU-ER-045', category: 'Stationery', costPrice: 3.2, sellingPrice: 5.0 },
  { name: 'Fruit Bar - Mix Berry', sku: 'EDU-FB-410', category: 'Food', costPrice: 6.0, sellingPrice: 12.5 },
  { name: 'Fresh Apple (Piece)', sku: 'EDU-FA-019', category: 'Food', costPrice: 9.0, sellingPrice: 15.99 },
  { name: 'Ruler 12"', sku: 'EDU-RL-712', category: 'Stationery', costPrice: 7.4, sellingPrice: 12.0 },
  { name: 'Soda Can 330ml', sku: 'EDU-SC-330', category: 'Beverage', costPrice: 17.0, sellingPrice: 26.0 },
];

/** The four rows shown in the design, kept verbatim at the top of the table. */
const FEATURED: InventoryItem[] = [
  { id: 1, name: 'Pancit Canton', sku: 'EDU-LP-042', category: 'Food', cooperative: 'Gordon College', onHand: 85, capacity: 100, costPrice: 12.5, sellingPrice: 18.0 },
  { id: 2, name: 'C2 Apple', sku: 'EDU-BK-118', category: 'Beverage', cooperative: 'Sta. Rita Elementary', onHand: 12, capacity: 150, costPrice: 15.75, sellingPrice: 22.0 },
  { id: 3, name: 'Cracklings', sku: 'EDU-FR-902', category: 'Food', cooperative: 'Tapinac Senior High School', onHand: 0, capacity: 40, costPrice: 9.4, sellingPrice: 15.0 },
  { id: 4, name: 'Bond Paper', sku: 'EDU-WT-223', category: 'Stationery', cooperative: DISTRICT_WIDE, onHand: 42, capacity: 60, costPrice: 9.6, sellingPrice: 15.0 },
];

const TOTAL_ITEMS = 248;

function generateRest(): InventoryItem[] {
  const random = createRandom(20260724);
  const rows: InventoryItem[] = [];

  for (let i = 0; i < TOTAL_ITEMS - FEATURED.length; i += 1) {
    const product = CATALOG[i % CATALOG.length];

    // Some supplies are held centrally rather than by a single school.
    const coop =
      i % 17 === 9
        ? DISTRICT_WIDE
        : inventoryCooperatives[(i * 5 + 3) % inventoryCooperatives.length];

    const capacity = [40, 60, 80, 100, 120, 150][(i * 3 + 1) % 6];

    // Most shelves are healthy; a deterministic slice is emptied or run down
    // so the alert counters have something real to report.
    let onHand: number;
    if (i % 81 === 7) {
      onHand = 0;
    } else if (i % 13 === 4) {
      onHand = Math.floor(capacity * (0.05 + random() * 0.18));
    } else if (i % 7 === 2) {
      onHand = Math.floor(capacity * (0.3 + random() * 0.4));
    } else {
      onHand = Math.floor(capacity * (0.76 + random() * 0.24));
    }

    rows.push({
      id: FEATURED.length + i + 1,
      name: product.name,
      sku: `${product.sku.slice(0, 7)}${String(100 + i).slice(-3)}`,
      category: product.category,
      cooperative: coop,
      onHand,
      capacity,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
    });
  }

  return rows;
}

export const inventoryItems: InventoryItem[] = [...FEATURED, ...generateRest()];

/** Headline figures, derived from the table so they can never disagree. */
export const inventoryStats = {
  itemsOut: inventoryItems.filter((item) => stockStatus(item) === 'Out of Stock').length,
  totalValuation: inventoryItems.reduce((sum, item) => sum + item.onHand * item.costPrice, 0),
  /** Restock requests in flight — not derivable from stock levels. */
  pendingRequests: 18,
  cooperativeCount: inventoryCooperatives.length,
};
