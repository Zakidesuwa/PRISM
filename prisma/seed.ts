// prisma/seed.ts
// Run with: npm run db:seed            (cooperatives, users, catalog + demo history)
//           npm run db:seed -- --minimal   (no demo history)
//
// WARNING: this wipes every table first.
//
// Demo history is not inserted as raw rows. Each day's deliveries, sales,
// payments and cash counts run through the same services the app uses, so the
// stock, the member ledger and the books all agree with each other.
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';
import { DEFAULT_SETTINGS } from '../src/lib/settings';
import { addDays, manilaToday, startOfDay, weekdayLabel } from '../src/lib/dates';
import { AccountingService } from '../src/services/accountingService';
import { BranchService } from '../src/services/branchService';
import { InventoryService } from '../src/services/inventoryService';
import { MemberService } from '../src/services/memberService';
import { ProductService } from '../src/services/productService';
import { SalesService } from '../src/services/salesService';
import { TransactionService, type PaymentMethod } from '../src/services/transactionService';
import { GORDON_COLLEGE_STUDENTS } from '../src/lib/hardcodedMembers';
import type { Ctx } from '../src/services/context';

const MINIMAL = process.argv.includes('--minimal');

/** Park-Miller generator: the same demo data on every run. */
function createRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

interface CatalogEntry {
  sku: string;
  name: string;
  category: string;
  packaging: string;
  supplier: string;
  deliveryDays: string;
  unit: string;
  cost: number;
  par: number;
  reorder: number;
  /** Selling price when the item is sold as-is. Omit for ingredients. */
  price?: number;
  consigned?: boolean;
  /** Relative popularity at the till. */
  weight?: number;
}

const CATALOG: CatalogEntry[] = [
  { sku: 'BEV-MW-500', name: 'Mineral Water 500ml', category: 'Beverages', packaging: 'Case of 24', supplier: 'Aqua Pure Distributors', deliveryDays: 'Mon, Thu', unit: 'pcs', cost: 9, par: 120, reorder: 30, price: 15, weight: 10 },
  { sku: 'BEV-IT-350', name: 'Iced Tea 350ml', category: 'Beverages', packaging: 'Case of 24', supplier: 'Aqua Pure Distributors', deliveryDays: 'Mon, Thu', unit: 'pcs', cost: 14, par: 72, reorder: 18, price: 22, weight: 6 },
  { sku: 'BEV-BJ-250', name: 'Bottled Juice 250ml', category: 'Beverages', packaging: 'Case of 24', supplier: 'Aqua Pure Distributors', deliveryDays: 'Mon, Thu', unit: 'pcs', cost: 16, par: 72, reorder: 18, price: 25, weight: 5 },
  { sku: 'BEV-SC-330', name: 'Soda Can 330ml', category: 'Beverages', packaging: 'Case of 24', supplier: 'Subic Bay Beverages', deliveryDays: 'Tue', unit: 'pcs', cost: 22, par: 48, reorder: 12, price: 32, weight: 4 },
  { sku: 'SNK-CB-040', name: 'Chocolate Bar', category: 'Snacks', packaging: 'Box of 24', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'pcs', cost: 13, par: 48, reorder: 12, price: 20, weight: 5 },
  { sku: 'SNK-CR-060', name: 'Cracklings', category: 'Snacks', packaging: 'Pack of 20', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'pcs', cost: 9, par: 60, reorder: 15, price: 15, weight: 6 },
  { sku: 'SNK-FB-030', name: 'Fruit Bar - Mixed Berry', category: 'Snacks', packaging: 'Box of 24', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'pcs', cost: 7, par: 48, reorder: 12, price: 12, weight: 3 },
  { sku: 'SNK-BR-001', name: 'Bread Roll', category: 'Snacks', packaging: 'Tray of 30', supplier: 'Local Oven Bakery', deliveryDays: 'Daily', unit: 'pcs', cost: 6, par: 60, reorder: 15, price: 10, weight: 7 },
  { sku: 'MEAL-NC-070', name: 'Instant Noodles Cup', category: 'Meals', packaging: 'Case of 24', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'pcs', cost: 16, par: 48, reorder: 12, price: 25, weight: 5 },
  { sku: 'MEAL-PC-080', name: 'Pancit Canton', category: 'Meals', packaging: 'Pack of 10', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'pcs', cost: 13, par: 60, reorder: 15, price: 25, weight: 6 },
  { sku: 'SUP-BP-BLK', name: 'Ballpen (Black)', category: 'School Supplies', packaging: 'Box of 50', supplier: 'Gordon Avenue School Supply', deliveryDays: 'Fri', unit: 'pcs', cost: 6.5, par: 100, reorder: 20, price: 10, weight: 4 },
  { sku: 'SUP-PN-002', name: 'Pencil No. 2', category: 'School Supplies', packaging: 'Box of 72', supplier: 'Gordon Avenue School Supply', deliveryDays: 'Fri', unit: 'pcs', cost: 4.4, par: 144, reorder: 30, price: 7, weight: 3 },
  { sku: 'SUP-YP-080', name: 'Yellow Pad', category: 'School Supplies', packaging: 'Ream of 10', supplier: 'Gordon Avenue School Supply', deliveryDays: 'Fri', unit: 'pcs', cost: 28, par: 40, reorder: 8, price: 40, weight: 2 },
  { sku: 'SUP-SN-100', name: 'Spiral Notebook', category: 'School Supplies', packaging: 'Pack of 12', supplier: 'Gordon Avenue School Supply', deliveryDays: 'Fri', unit: 'pcs', cost: 24, par: 48, reorder: 10, price: 38, weight: 2 },
  { sku: 'SUP-BD-010', name: 'Bond Paper (10 sheets)', category: 'School Supplies', packaging: 'Ream of 50 sets', supplier: 'Gordon Avenue School Supply', deliveryDays: 'Fri', unit: 'sets', cost: 9, par: 100, reorder: 20, price: 15, weight: 3 },
  { sku: 'SUP-ER-001', name: 'Eraser', category: 'School Supplies', packaging: 'Box of 40', supplier: 'Gordon Avenue School Supply', deliveryDays: 'Fri', unit: 'pcs', cost: 3, par: 80, reorder: 16, price: 5, weight: 2 },
  // Ingredients for prepared items.
  { sku: 'ING-BS-001', name: 'Sandwich Bread (slice)', category: 'Ingredients', packaging: 'Loaf of 20 slices', supplier: 'Local Oven Bakery', deliveryDays: 'Daily', unit: 'slices', cost: 2.5, par: 160, reorder: 40 },
  { sku: 'ING-CH-001', name: 'Cheese (slice)', category: 'Ingredients', packaging: 'Pack of 24 slices', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'slices', cost: 6, par: 96, reorder: 24 },
  { sku: 'ING-CF-001', name: 'Coffee Sachet', category: 'Ingredients', packaging: 'Pack of 30', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'pcs', cost: 6, par: 90, reorder: 20 },
  { sku: 'ING-PC-008', name: 'Paper Cup 8oz', category: 'Ingredients', packaging: 'Sleeve of 50', supplier: 'Olongapo Grocers Supply', deliveryDays: 'Wed', unit: 'pcs', cost: 2, par: 150, reorder: 30 },
  // Consigned by a vendor: the cooperative holds them but does not own them.
  { sku: 'CON-BC-001', name: 'Banana Cue', category: 'Snacks', packaging: 'Delivered daily', supplier: "Aling Nena's Kakanin", deliveryDays: 'Daily', unit: 'pcs', cost: 0, par: 30, reorder: 5, price: 15, consigned: true, weight: 6 },
  { sku: 'CON-TR-001', name: 'Turon', category: 'Snacks', packaging: 'Delivered daily', supplier: "Aling Nena's Kakanin", deliveryDays: 'Daily', unit: 'pcs', cost: 0, par: 30, reorder: 5, price: 12, consigned: true, weight: 5 },
];

const RECIPES = [
  { sku: 'MEAL-CS-001', name: 'Cheese Sandwich', category: 'Meals', price: 30, weight: 7, parts: [['ING-BS-001', 2], ['ING-CH-001', 1]] as [string, number][] },
  { sku: 'BEV-HC-008', name: 'Hot Coffee 8oz', category: 'Beverages', price: 18, weight: 6, parts: [['ING-CF-001', 1], ['ING-PC-008', 1]] as [string, number][] },
];

const BRANCHES = [
  { name: 'Gordon College', address: 'Olongapo City Sports Complex, East Tapinac', level: 'College', storeLocation: 'Main Building, ground floor', days: 45, salesPerDay: 18, key: 'gc' },
  { name: 'Sta. Rita Elementary', address: 'Sta. Rita Road, Barangay Sta. Rita', level: 'Elementary', storeLocation: 'East Wing, ground floor', days: 21, salesPerDay: 8, key: 'sre' },
  { name: 'Tapinac Senior High School', address: 'Donor Street, East Tapinac, Olongapo City', level: 'High School', storeLocation: 'Annex Building, ground floor', days: 21, salesPerDay: 12, key: 'ths' },
  { name: 'Olongapo City National High School', address: 'Rizal Avenue corner 14th Street, East Bajac-Bajac', level: 'High School', storeLocation: 'West Wing, ground floor', days: 21, salesPerDay: 10, key: 'ocn' },
  { name: 'Balic-Balic Elementary', address: 'Waterdam Road, Balic-Balic, Sta. Rita', level: 'Elementary', storeLocation: 'Main Building, ground floor', days: 21, salesPerDay: 6, key: 'bbe' },
];

const MEMBER_NAMES = [
  'Maria Santos', 'Juan Dela Cruz', 'Robert Tan', 'Grace Villanueva', 'Elena Gomez', 'Carlos Reyes',
  'Ana Lopez', 'Rico Santiago', 'Liza Mercado', 'Paolo Garcia', 'Teresa Aquino', 'Ben Navarro',
  'Cristina Ramos', 'Noel Bautista', 'Jocelyn Cruz', 'Mark Pascual', 'Ruth Fernandez', 'Arnel Dizon',
];

async function wipe() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "AuditLog", "SystemSetting", "SurplusAllocation", "SurplusDistribution",
      "VendorPayout", "CashCount", "JournalLine", "JournalEntry", "Account", "TransactionItem",
      "Transaction", "StockMovement", "ProductIngredient", "Product", "InventoryItem", "Vendor",
      "MemberLedgerEntry", "CoopMember", "User", "SchoolBranch"
    RESTART IDENTITY CASCADE
  `);
}

async function seedBranch(config: (typeof BRANCHES)[number], index: number, memberNames: string[]) {
  const random = createRandom(7919 * (index + 1));
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];

  const branch = await BranchService.create(
    { name: config.name, address: config.address, level: config.level, storeLocation: config.storeLocation },
    null
  );

  const suffix = index === 0 ? '' : String(index + 1);
  const password = (word: string) => hashPassword(word);
  const [manager, cashier, storekeeper] = await Promise.all([
    prisma.user.create({ data: { username: `manager${suffix}`, name: `${config.name} Manager`, role: 'MANAGER', branchId: branch.id, passwordHash: password('manager123') } }),
    prisma.user.create({ data: { username: `cashier${suffix}`, name: `${config.name} Cashier`, role: 'CASHIER', branchId: branch.id, passwordHash: password('cashier123') } }),
    prisma.user.create({ data: { username: `storekeeper${suffix}`, name: `${config.name} Store Keeper`, role: 'STOREKEEPER', branchId: branch.id, passwordHash: password('store123') } }),
  ]);

  const today = manilaToday();
  const firstDay = addDays(today, -config.days);
  const at = (date: string, hour: number, minute = 0) =>
    new Date(startOfDay(date).getTime() + (hour * 60 + minute) * 60000);
  const ctxFor = (userId: string, when?: Date): Ctx => ({ branchId: branch.id, userId, at: MINIMAL ? undefined : when });

  // ----- Catalog -----
  const setupCtx = ctxFor(manager.id, at(firstDay, 6));
  const vendor = await SalesService.saveVendor(setupCtx, {
    name: "Aling Nena's Kakanin",
    contactPerson: 'Nena Flores',
    phone: '0918-555-0134',
    commissionPercent: 15,
  });

  const itemIds = new Map<string, number>();
  for (const entry of CATALOG) {
    const item = await InventoryService.create(setupCtx, {
      name: entry.name,
      packaging: entry.packaging,
      sku: entry.sku,
      category: entry.category,
      supplier: entry.supplier,
      deliveryDays: entry.deliveryDays,
      unit: entry.unit,
      reorderLevel: entry.reorder,
      parLevel: entry.par,
    });
    itemIds.set(entry.sku, item.id);
  }

  const sellable: { productId: number; weight: number }[] = [];
  for (const entry of CATALOG.filter((candidate) => candidate.price)) {
    const product = await ProductService.create(setupCtx, {
      name: entry.name,
      sku: entry.sku,
      category: entry.category,
      price: entry.price,
      vendorId: entry.consigned ? vendor.id : null,
      ingredients: [{ inventoryItemId: itemIds.get(entry.sku)!, quantity: 1 }],
    });
    sellable.push({ productId: product.id, weight: entry.weight ?? 1 });
  }
  for (const recipe of RECIPES) {
    const product = await ProductService.create(setupCtx, {
      name: recipe.name,
      sku: recipe.sku,
      category: recipe.category,
      price: recipe.price,
      ingredients: recipe.parts.map(([sku, quantity]) => ({ inventoryItemId: itemIds.get(sku)!, quantity })),
    });
    sellable.push({ productId: product.id, weight: recipe.weight });
  }

  // ----- Members (their share capital funds the first stock purchase) -----
  const members = [];
  if (config.key === 'gc') {
    for (const student of GORDON_COLLEGE_STUDENTS) {
      members.push(
        await MemberService.create(setupCtx, {
          memberCode: student.memberCode,
          fullName: student.fullName,
          email: student.email,
          phone: student.phone ?? '0917-555-1234',
          shareCapital: student.shareCapital,
          creditLimit: student.creditLimit,
        })
      );
    }
  } else {
    for (const [position, fullName] of memberNames.entries()) {
      members.push(
        await MemberService.create(setupCtx, {
          memberCode: `MEM-${config.key.toUpperCase()}-${String(position + 1).padStart(3, '0')}`,
          fullName,
          email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@deped.gov.ph`,
          phone: `09${17 + position}-555-${String(1000 + index * 37 + position * 11).slice(-4)}`,
          shareCapital: 8000 + Math.floor(random() * 5) * 2500,
          creditLimit: 1500,
        })
      );
    }
  }

  const restock = async (sku: string, when: Date, fraction = 1) => {
    const entry = CATALOG.find((candidate) => candidate.sku === sku)!;
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds.get(sku)! } });
    const quantity = Math.floor((entry.par - item.stock.toNumber()) * fraction);
    if (quantity <= 0) return;
    await InventoryService.receiveDelivery(ctxFor(storekeeper.id, when), {
      itemId: item.id,
      quantity,
      unitCost: entry.cost,
      paymentType: random() < 0.3 ? 'ACCOUNT' : 'CASH',
      reference: `DR-${Math.floor(1000 + random() * 9000)}`,
    });
  };

  // Opening stock.
  for (const entry of CATALOG) await restock(entry.sku, at(firstDay, 6, 30));

  if (MINIMAL) return branch;

  // ----- Day by day -----
  const totalWeight = sellable.reduce((sum, product) => sum + product.weight, 0);
  const pickProduct = () => {
    let roll = random() * totalWeight;
    for (const product of sellable) {
      roll -= product.weight;
      if (roll <= 0) return product.productId;
    }
    return sellable[0].productId;
  };

  for (let offset = config.days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const weekday = weekdayLabel(date);
    if (weekday === 'Sun') continue;
    const isToday = offset === 0;

    // Morning: consigned goods arrive daily; other stock is topped up twice a week.
    for (const entry of CATALOG.filter((candidate) => candidate.consigned)) {
      await restock(entry.sku, at(date, 6, 40));
    }
    if (weekday === 'Mon' || weekday === 'Thu') {
      for (const entry of CATALOG.filter((candidate) => !candidate.consigned)) {
        const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds.get(entry.sku)! } });
        // The last week's top-ups are skipped for a few items so the stock alerts have something to show.
        const skip = offset < 6 && (entry.sku.charCodeAt(4) + index) % 4 === 0;
        if (!skip && item.stock.toNumber() <= entry.reorder * 2) await restock(entry.sku, at(date, 6, 50));
      }
    }

    // Sales through the day.
    const salesToday = Math.round(config.salesPerDay * (0.75 + random() * 0.5) * (weekday === 'Sat' ? 0.5 : 1));
    for (let sale = 0; sale < salesToday; sale += 1) {
      const lines = new Map<number, number>();
      const lineCount = 1 + Math.floor(random() * 3);
      for (let line = 0; line < lineCount; line += 1) {
        const productId = pickProduct();
        lines.set(productId, (lines.get(productId) ?? 0) + 1 + Math.floor(random() * 2));
      }

      const roll = random();
      const member = roll < 0.45 ? pick(members) : null;
      const paymentMethod: PaymentMethod = member && roll < 0.14 ? 'CHARGE' : random() < 0.12 ? 'GCASH' : 'CASH';
      const when = at(date, 7 + Math.floor((sale / salesToday) * 9), Math.floor(random() * 60));
      if (isToday && when > new Date()) break;

      try {
        await TransactionService.processCheckout(ctxFor(cashier.id, when), {
          items: [...lines].map(([productId, quantity]) => ({ productId, quantity })),
          memberId: member?.id ?? null,
          paymentMethod,
          amountTendered: 5000,
          paymentReference: paymentMethod === 'GCASH' ? `GC${Math.floor(100000 + random() * 900000)}` : undefined,
        });
      } catch {
        // Sold out, or the member is at their credit limit: the customer walks away.
      }
    }

    // Members settle part of what they owe now and then.
    if (random() < 0.35) {
      const debtor = await prisma.coopMember.findFirst({
        where: { branchId: branch.id, chargeBalance: { gt: 0 } },
        orderBy: { chargeBalance: 'desc' },
      });
      if (debtor) {
        const amount = Math.max(1, Math.floor(debtor.chargeBalance.toNumber() * (0.5 + random() * 0.5)));
        await MemberService.recordPayment(ctxFor(cashier.id, at(date, 15, 30)), debtor.id, amount);
      }
    }

    // Unsold consigned snacks are written off at closing; occasional damage elsewhere.
    if (!isToday) {
      for (const entry of CATALOG.filter((candidate) => candidate.consigned)) {
        const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds.get(entry.sku)! } });
        if (item.stock.gt(0)) {
          await InventoryService.logSpoilage(ctxFor(storekeeper.id, at(date, 16, 30)), {
            itemId: item.id,
            quantity: item.stock.toNumber(),
            reason: 'Unsold at closing, returned to vendor',
          });
        }
      }
      if (random() < 0.12) {
        const entry = pick(CATALOG.filter((candidate) => !candidate.consigned));
        const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds.get(entry.sku)! } });
        if (item.stock.gte(2)) {
          await InventoryService.logSpoilage(ctxFor(storekeeper.id, at(date, 16, 35)), {
            itemId: item.id,
            quantity: 1 + Math.floor(random() * 2),
            reason: pick(['Damaged packaging', 'Expired', 'Spilled']),
          });
        }
      }

      // The cashier counts the drawer. Most days it is exact.
      const [drawer] = await SalesService.getDrawers(branch.id, date, cashier.id);
      const expected = 1000 + drawer.cashSales + drawer.collections;
      const slip = random();
      const variance = slip < 0.7 ? 0 : slip < 0.85 ? -Math.ceil(random() * 20) : Math.ceil(random() * 15);
      await SalesService.submitCashCount(ctxFor(cashier.id, at(date, 16, 45)), {
        date,
        cashierId: cashier.id,
        openingFloat: 1000,
        countedCash: Math.round((expected + variance) * 100) / 100,
        notes: variance === 0 ? undefined : variance < 0 ? 'Short on change given' : 'Customer left change',
      });
    }

    // Fridays: pay the vendor. Month-end style expenses every two weeks.
    if (weekday === 'Fri' && !isToday) {
      const [split] = await SalesService.getVendorSplit(branch.id, { from: startOfDay(firstDay), to: at(date, 17) });
      if (split && split.balanceDue > 0) {
        await SalesService.payVendor(ctxFor(manager.id, at(date, 16, 50)), { vendorId: vendor.id, amount: split.balanceDue });
      }
      if (offset % 14 < 7) {
        const expenseCtx = ctxFor(manager.id, at(date, 17));
        await AccountingService.postManualEntry(expenseCtx, { description: 'Store staff allowance', lines: [{ code: '6100', debit: Math.round(config.salesPerDay * 55), credit: 0 }, { code: '1010', debit: 0, credit: Math.round(config.salesPerDay * 55) }] });
        await AccountingService.postManualEntry(expenseCtx, { description: 'Electricity and water share', lines: [{ code: '6200', debit: Math.round(config.salesPerDay * 22), credit: 0 }, { code: '1010', debit: 0, credit: Math.round(config.salesPerDay * 22) }] });
      }
    }
  }

  return branch;
}

async function main() {
  console.log(`Seeding PRISM${MINIMAL ? ' (minimal: no demo history)' : ''}...`);
  await wipe();

  await prisma.systemSetting.create({ data: { id: 1, data: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) } });
  await prisma.user.create({
    data: { username: 'admin', name: 'District Administrator', role: 'ADMIN', passwordHash: hashPassword('admin123') },
  });

  let cursor = 0;
  for (const [index, config] of BRANCHES.entries()) {
    const started = Date.now();
    const memberCount = index === 0 ? 6 : 3;
    const names = MEMBER_NAMES.slice(cursor, cursor + memberCount);
    cursor += memberCount;
    await seedBranch(config, index, names);
    console.log(`  ${config.name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }

  const [sales, entries] = await Promise.all([prisma.transaction.count(), prisma.journalEntry.count()]);
  console.log(`Done: ${BRANCHES.length} cooperatives, ${sales} sales, ${entries} journal entries.`);
  console.log('Logins: admin/admin123, manager/manager123, cashier/cashier123, storekeeper/store123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
