// src/data/dailySalesMockData.ts
//
// Demo transactions for the Daily Sales module, used only when the database is
// not reachable. Generated deterministically from the date key (seeded LCG, not
// Math.random) so server and client renders always agree and the same date
// always shows the same day.

import { dayRange } from '@/lib/dailySales/businessDate';
import type { SaleTransactionRow, SaleItemRow } from '@/lib/dailySales/calculations';
// His dailySalesService (which defined this) was not carried over in the merge.
interface CashierOption {
  id: string;
  name: string;
}

interface DemoProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  vendorId: number | null;
  vendorName: string | null;
  coopSharePercent: number | null;
}

const PRODUCTS: DemoProduct[] = [
  { id: 1, name: 'Classic Cheeseburger', category: 'Hot Meals', price: 275, vendorId: null, vendorName: null, coopSharePercent: null },
  { id: 2, name: 'Pepperoni Slice', category: 'Hot Meals', price: 150, vendorId: null, vendorName: null, coopSharePercent: null },
  { id: 3, name: 'Iced Latte', category: 'Beverages', price: 225, vendorId: null, vendorName: null, coopSharePercent: null },
  { id: 4, name: 'Bottled Water', category: 'Beverages', price: 75, vendorId: null, vendorName: null, coopSharePercent: null },
  { id: 5, name: 'Pancit Canton', category: 'Hot Meals', price: 60, vendorId: 1, vendorName: "Aling Nena's Kakanin", coopSharePercent: 15 },
  { id: 6, name: 'Bibingka', category: 'Snacks', price: 35, vendorId: 1, vendorName: "Aling Nena's Kakanin", coopSharePercent: 15 },
  { id: 7, name: 'Turon (2 pcs)', category: 'Snacks', price: 25, vendorId: 1, vendorName: "Aling Nena's Kakanin", coopSharePercent: 15 },
  { id: 8, name: 'Pandesal (6 pcs)', category: 'Bakery', price: 30, vendorId: 2, vendorName: 'Subic Bay Bakeshop', coopSharePercent: 12.5 },
  { id: 9, name: 'Ensaymada', category: 'Bakery', price: 45, vendorId: 2, vendorName: 'Subic Bay Bakeshop', coopSharePercent: 12.5 },
];

export const DEMO_CASHIERS: CashierOption[] = [
  { id: 'cashier', name: 'POS Cashier' },
  { id: 'user', name: 'Standard Cashier' },
];

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function seedFromKey(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function getDemoDayTransactions(dateKey: string): SaleTransactionRow[] {
  const rand = lcg(seedFromKey(dateKey));
  const { start } = dayRange(dateKey);
  const count = 38 + Math.floor(rand() * 20);
  // Simple transaction numbering, stable per day.
  const base = 1001 + (seedFromKey(dateKey) % 9000);

  const rows: SaleTransactionRow[] = [];
  for (let n = 0; n < count; n++) {
    // Canteen hours 7:00–17:59 Manila, with lunch (11–13) busiest.
    const r = rand();
    const hour = r < 0.45 ? 11 + Math.floor(rand() * 3) : 7 + Math.floor(rand() * 11);
    const minute = Math.floor(rand() * 60);
    const createdAt = new Date(start.getTime() + (hour * 60 + minute) * 60_000);

    const lineCount = 1 + Math.floor(rand() * 3);
    const items: SaleItemRow[] = [];
    const used = new Set<number>();
    for (let l = 0; l < lineCount; l++) {
      const p = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
      if (used.has(p.id)) continue;
      used.add(p.id);
      const quantity = 1 + Math.floor(rand() * 3);
      items.push({
        productId: p.id,
        productName: p.name,
        category: p.category,
        quantity,
        subtotal: p.price * quantity,
        vendorId: p.vendorId,
        vendorName: p.vendorName,
        coopSharePercent: p.coopSharePercent,
      });
    }

    const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
    const taxAmount = round2(subtotal * 0.05);
    const cashier = DEMO_CASHIERS[rand() < 0.6 ? 0 : 1];

    rows.push({
      transactionNumber: '', // assigned after sorting
      createdAt,
      cashierId: cashier.id,
      cashierName: cashier.name,
      memberId: rand() < 0.3 ? 1 : null,
      paymentMethod: 'CASH',
      status: rand() < 0.04 ? 'VOIDED' : 'COMPLETED',
      subtotal,
      taxAmount,
      totalAmount: round2(subtotal + taxAmount),
      items,
    });
  }

  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  rows.forEach((row, i) => (row.transactionNumber = `#${base + i}`));
  return rows;
}
