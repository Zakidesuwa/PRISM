// scripts/verify-system.ts
// End-to-end test of the system core against the real database.
// Run with: npm run test:system
//
// It works inside a throwaway cooperative and removes it afterwards, so it is
// safe to run against a database that already has data.
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { hashPassword, verifyPassword, createSessionToken, readSessionToken } from '../src/lib/auth';
import { canAccess } from '../src/lib/roles';
import { manilaToday, rangeOf, yearRange } from '../src/lib/dates';
import { ACCOUNT, AccountingService } from '../src/services/accountingService';
import { BranchService } from '../src/services/branchService';
import { InventoryService } from '../src/services/inventoryService';
import { MemberService } from '../src/services/memberService';
import { ProductService } from '../src/services/productService';
import { SalesService } from '../src/services/salesService';
import { SurplusService } from '../src/services/surplusService';
import { TransactionService } from '../src/services/transactionService';
import { SettingsService } from '../src/services/settingsService';
import type { Ctx } from '../src/services/context';

let passed = 0;
let failed = 0;

async function test(name: string, run: () => Promise<void>) {
  try {
    await run();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error instanceof Error ? error.message : error}`);
  }
}

const near = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 0.005, `${label}: expected ${expected}, got ${actual}`);

async function balanceOf(branchId: number, code: string) {
  const accounts = await AccountingService.listAccounts(branchId);
  return accounts.find((account) => account.code === code)?.balance ?? 0;
}

async function stockOf(itemId: number) {
  const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
  return item.stock.toNumber();
}

async function cleanup(branchId: number) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { branchId } }),
    prisma.journalEntry.deleteMany({ where: { branchId } }),
    prisma.account.deleteMany({ where: { branchId } }),
    prisma.surplusDistribution.deleteMany({ where: { branchId } }),
    prisma.cashCount.deleteMany({ where: { branchId } }),
    prisma.vendorPayout.deleteMany({ where: { branchId } }),
    prisma.memberLedgerEntry.deleteMany({ where: { branchId } }),
    prisma.stockMovement.deleteMany({ where: { branchId } }),
    prisma.transaction.deleteMany({ where: { branchId } }),
    prisma.product.deleteMany({ where: { branchId } }),
    prisma.inventoryItem.deleteMany({ where: { branchId } }),
    prisma.vendor.deleteMany({ where: { branchId } }),
    prisma.coopMember.deleteMany({ where: { branchId } }),
    prisma.user.deleteMany({ where: { branchId } }),
    prisma.schoolBranch.deleteMany({ where: { id: branchId } }),
  ]);
}

async function main() {
  console.log('\nPRISM system test\n');

  const stamp = Date.now();
  const taxRate = (await SettingsService.get()).taxes.taxRate / 100;
  const branch = await BranchService.create(
    { name: `ZZ Test Cooperative ${stamp}`, address: 'Test', level: 'College' },
    null
  );
  const cashier = await prisma.user.create({
    data: {
      username: `test.cashier.${stamp}`,
      name: 'Test Cashier',
      passwordHash: hashPassword('secret123'),
      role: 'CASHIER',
      branchId: branch.id,
    },
  });
  const ctx: Ctx = { branchId: branch.id, userId: cashier.id };
  const today = manilaToday();

  try {
    // ---------- Shared functionality ----------
    console.log('Shared functionality');

    await test('Passwords are hashed and verified', async () => {
      assert.ok(!cashier.passwordHash.includes('secret123'));
      assert.ok(verifyPassword('secret123', cashier.passwordHash));
      assert.ok(!verifyPassword('wrong', cashier.passwordHash));
    });

    await test('Session cookie is signed and tamper-proof', async () => {
      const token = createSessionToken(cashier.id, 'CASHIER');
      assert.equal(readSessionToken(token)?.uid, cashier.id);
      const forged = `${Buffer.from(JSON.stringify({ uid: cashier.id, role: 'ADMIN', exp: 9999999999 })).toString('base64url')}.${token.split('.')[1]}`;
      assert.equal(readSessionToken(forged), null);
      assert.equal(readSessionToken('garbage'), null);
    });

    await test('Route access follows the role', async () => {
      assert.ok(canAccess('CASHIER', '/pos'));
      assert.ok(!canAccess('CASHIER', '/reports'));
      assert.ok(!canAccess('CASHIER', '/admin'));
      assert.ok(canAccess('STOREKEEPER', '/inventory'));
      assert.ok(!canAccess('STOREKEEPER', '/pos'));
      assert.ok(canAccess('MANAGER', '/dividends'));
      assert.ok(canAccess('ADMIN', '/admin/cooperative/3'));
      assert.ok(!canAccess('ADMIN', '/pos'));
    });

    await test('A new cooperative gets the chart of accounts', async () => {
      const accounts = await AccountingService.listAccounts(branch.id);
      assert.ok(accounts.length >= 25);
      assert.ok(accounts.every((account) => account.balance === 0));
    });

    // ---------- Inventory ----------
    console.log('\nInventory');

    const item = async (name: string, sku: string, unit: string) =>
      (
        await InventoryService.create(ctx, {
          name,
          sku,
          packaging: '',
          category: 'Test',
          supplier: 'Test Supplier',
          deliveryDays: 'Mon',
          unit,
          reorderLevel: 5,
          parLevel: 50,
        })
      ).id;

    const water = await item('Water', 'T-WATER', 'pcs');
    const bread = await item('Bread Slice', 'T-BREAD', 'pcs');
    const cheese = await item('Cheese Slice', 'T-CHEESE', 'pcs');
    const kakanin = await item('Banana Cue (consigned)', 'T-BCUE', 'pcs');

    let member = await MemberService.create(ctx, {
      memberCode: `T-MEM-${stamp}`,
      fullName: 'Test Member',
      shareCapital: 5000,
      creditLimit: 100,
    });

    await test('Share capital is booked to cash and equity', async () => {
      near(await balanceOf(branch.id, ACCOUNT.CASH), 5000, 'cash');
      near(await balanceOf(branch.id, ACCOUNT.SHARE_CAPITAL), 5000, 'share capital');
    });

    await test('Receiving a delivery adds stock and books the purchase', async () => {
      await InventoryService.receiveDelivery(ctx, { itemId: water, quantity: 24, unitCost: 9, paymentType: 'CASH' });
      await InventoryService.receiveDelivery(ctx, { itemId: bread, quantity: 20, unitCost: 2.5, paymentType: 'CASH' });
      await InventoryService.receiveDelivery(ctx, { itemId: cheese, quantity: 10, unitCost: 6, paymentType: 'ACCOUNT' });
      await InventoryService.receiveDelivery(ctx, { itemId: kakanin, quantity: 10, unitCost: 0, paymentType: 'CASH' });
      assert.equal(await stockOf(water), 24);
      near(await balanceOf(branch.id, ACCOUNT.INVENTORY), 216 + 50 + 60, 'inventory');
      near(await balanceOf(branch.id, ACCOUNT.CASH), 5000 - 216 - 50, 'cash');
      near(await balanceOf(branch.id, ACCOUNT.PAYABLE), 60, 'payable');
    });

    await test('Unit cost is a weighted average across deliveries', async () => {
      await InventoryService.receiveDelivery(ctx, { itemId: water, quantity: 24, unitCost: 11, paymentType: 'CASH' });
      const row = (await InventoryService.list(branch.id)).find((r) => r.id === water)!;
      near(row.unitCost, 10, 'average cost');
      assert.equal(row.stock, 48);
      assert.equal(row.status, 'Optimal');
    });

    await test('Stock monitoring flags low and empty items', async () => {
      const rows = await InventoryService.list(branch.id);
      assert.equal(rows.find((r) => r.id === kakanin)!.status, 'Optimal');
      await InventoryService.logSpoilage(ctx, { itemId: kakanin, quantity: 6, reason: 'Unsold at closing' });
      assert.equal((await InventoryService.list(branch.id)).find((r) => r.id === kakanin)!.status, 'Low Stock');
      assert.equal(await InventoryService.lowStockCount(branch.id), 1);
    });

    await test('Spoilage reduces stock and is expensed at cost', async () => {
      await InventoryService.logSpoilage(ctx, { itemId: water, quantity: 2, reason: 'Damaged bottles' });
      assert.equal(await stockOf(water), 46);
      near(await balanceOf(branch.id, ACCOUNT.SPOILAGE), 20, 'spoilage');
      await assert.rejects(InventoryService.logSpoilage(ctx, { itemId: water, quantity: 999, reason: 'x' }));
      assert.equal(await stockOf(water), 46);
    });

    // ---------- Products ----------
    const vendor = await SalesService.saveVendor(ctx, { name: 'Test Vendor', commissionPercent: 15 });
    const waterProduct = await ProductService.create(ctx, {
      name: 'Bottled Water', sku: 'P-WATER', category: 'Beverages', price: 15,
      ingredients: [{ inventoryItemId: water, quantity: 1 }],
    });
    const sandwich = await ProductService.create(ctx, {
      name: 'Cheese Sandwich', sku: 'P-SAND', category: 'Meals', price: 30,
      ingredients: [{ inventoryItemId: bread, quantity: 2 }, { inventoryItemId: cheese, quantity: 1 }],
    });
    const bananaCue = await ProductService.create(ctx, {
      name: 'Banana Cue', sku: 'P-BCUE', category: 'Snacks', price: 20, vendorId: vendor.id,
      ingredients: [{ inventoryItemId: kakanin, quantity: 1 }],
    });

    await test('Product availability and cost come from inventory', async () => {
      const products = await ProductService.list(branch.id);
      const s = products.find((p) => p.id === sandwich.id)!;
      assert.equal(s.available, 10);
      near(s.unitCost, 11, 'sandwich cost');
      assert.equal(products.find((p) => p.id === bananaCue.id)!.unitCost, 0);
      assert.equal(products.find((p) => p.id === waterProduct.id)!.available, 46);
    });

    // ---------- Cashier ----------
    console.log('\nCashier');

    const cashBefore = await balanceOf(branch.id, ACCOUNT.CASH);
    const subtotal = 2 * 15 + 30;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    let cashSale = await TransactionService.processCheckout(ctx, {
      items: [{ productId: waterProduct.id, quantity: 2 }, { productId: sandwich.id, quantity: 1 }],
      paymentMethod: 'CASH',
      amountTendered: 100,
    });

    await test('Cash sale: totals, tax and change', async () => {
      near(cashSale.subtotal, subtotal, 'subtotal');
      near(cashSale.taxAmount, tax, 'tax');
      near(cashSale.totalAmount, subtotal + tax, 'total');
      near(cashSale.changeAmount!, 100 - subtotal - tax, 'change');
      assert.equal(cashSale.status, 'COMPLETED');
    });

    await test('Sale deducts inventory, including recipe ingredients', async () => {
      assert.equal(await stockOf(water), 44);
      assert.equal(await stockOf(bread), 18);
      assert.equal(await stockOf(cheese), 9);
    });

    await test('Sale posts revenue, tax, cash and cost of goods', async () => {
      near(await balanceOf(branch.id, ACCOUNT.SALES), subtotal, 'sales');
      near(await balanceOf(branch.id, ACCOUNT.TAX_PAYABLE), tax, 'tax payable');
      near(await balanceOf(branch.id, ACCOUNT.CASH), cashBefore + subtotal + tax, 'cash');
      near(await balanceOf(branch.id, ACCOUNT.COGS), 2 * 10 + 11, 'cogs');
    });

    await test('Payment handling rejects bad payments and changes nothing', async () => {
      const one = [{ productId: waterProduct.id, quantity: 1 }];
      await assert.rejects(TransactionService.processCheckout(ctx, { items: one, paymentMethod: 'CASH', amountTendered: 1 }), /less than the total/);
      await assert.rejects(TransactionService.processCheckout(ctx, { items: one, paymentMethod: 'GCASH' }), /reference/);
      await assert.rejects(TransactionService.processCheckout(ctx, { items: one, paymentMethod: 'CHARGE' }), /member/);
      await assert.rejects(TransactionService.processCheckout(ctx, { items: [], paymentMethod: 'CASH', amountTendered: 50 }), /empty/);
      await assert.rejects(TransactionService.processCheckout(ctx, { items: [{ productId: waterProduct.id, quantity: 500 }], paymentMethod: 'CASH', amountTendered: 99999 }), /Not enough/);
      assert.equal(await stockOf(water), 44);
      near(await balanceOf(branch.id, ACCOUNT.SALES), subtotal, 'sales unchanged');
    });

    await test('GCash sale goes to the e-wallet account', async () => {
      const sale = await TransactionService.processCheckout(ctx, {
        items: [{ productId: waterProduct.id, quantity: 1 }], paymentMethod: 'GCASH', paymentReference: 'REF123',
      });
      near(await balanceOf(branch.id, ACCOUNT.EWALLET), sale.totalAmount, 'e-wallet');
    });

    let chargeTotal = 0;
    await test('Charge sale updates the member ledger and patronage', async () => {
      const sale = await TransactionService.processCheckout(ctx, {
        items: [{ productId: sandwich.id, quantity: 1 }], paymentMethod: 'CHARGE', memberId: member.id,
      });
      chargeTotal = sale.totalAmount;
      const profile = (await MemberService.getProfile(branch.id, member.id))!;
      near(profile.chargeBalance, chargeTotal, 'charge balance');
      near(profile.accumulatedPatronage, chargeTotal, 'patronage');
      assert.equal(profile.ledger[0].type, 'CHARGE');
      near(await balanceOf(branch.id, ACCOUNT.RECEIVABLE), chargeTotal, 'receivable');
    });

    await test('Charge sale over the credit limit is refused', async () => {
      await assert.rejects(
        TransactionService.processCheckout(ctx, {
          items: [{ productId: sandwich.id, quantity: 4 }], paymentMethod: 'CHARGE', memberId: member.id,
        }),
        /credit limit/
      );
      assert.equal(await stockOf(cheese), 8);
    });

    await test('Member payment reduces the balance owed', async () => {
      member = await MemberService.recordPayment(ctx, member.id, 10);
      near(member.chargeBalance, chargeTotal - 10, 'balance');
      near(await balanceOf(branch.id, ACCOUNT.RECEIVABLE), chargeTotal - 10, 'receivable');
      await assert.rejects(MemberService.recordPayment(ctx, member.id, 9999));
    });

    await test('Consigned sale splits between vendor and cooperative', async () => {
      await TransactionService.processCheckout(ctx, {
        items: [{ productId: bananaCue.id, quantity: 1 }], paymentMethod: 'CASH', amountTendered: 50,
      });
      near(await balanceOf(branch.id, ACCOUNT.COMMISSION), 3, 'commission');
      near(await balanceOf(branch.id, ACCOUNT.CONSIGNORS), 17, 'due to vendor');
      const split = (await SalesService.getVendorSplit(branch.id, rangeOf(today, today)))[0];
      near(split.grossSales, 20, 'gross');
      near(split.vendorShare, 17, 'vendor share');
      near(split.balanceDue, 17, 'balance due');
    });

    await test('Vendor payout clears what is owed', async () => {
      await assert.rejects(SalesService.payVendor(ctx, { vendorId: vendor.id, amount: 100 }));
      await SalesService.payVendor(ctx, { vendorId: vendor.id, amount: 17 });
      near(await balanceOf(branch.id, ACCOUNT.CONSIGNORS), 0, 'due to vendor');
    });

    await test('Voiding a sale restores stock and reverses the ledger', async () => {
      const salesBefore = await balanceOf(branch.id, ACCOUNT.SALES);
      cashSale = await TransactionService.voidTransaction(ctx, cashSale.id, 'Wrong order');
      assert.equal(cashSale.status, 'VOIDED');
      assert.equal(await stockOf(water), 45);
      assert.equal(await stockOf(bread), 18);
      near(await balanceOf(branch.id, ACCOUNT.SALES), salesBefore - subtotal, 'sales');
      await assert.rejects(TransactionService.voidTransaction(ctx, cashSale.id, 'again'), /already/);
    });

    await test('Simultaneous sales never oversell or reuse a number', async () => {
      await InventoryService.logSpoilage(ctx, { itemId: kakanin, quantity: 2, reason: 'test setup' });
      const attempt = () =>
        TransactionService.processCheckout(ctx, {
          items: [{ productId: bananaCue.id, quantity: 1 }], paymentMethod: 'CASH', amountTendered: 50,
        });
      const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(await stockOf(kakanin), 0);
      const numbers = (await prisma.transaction.findMany({ where: { branchId: branch.id } })).map((t) => t.transactionNumber);
      assert.equal(new Set(numbers).size, numbers.length);
    });

    // ---------- Daily sales ----------
    console.log('\nDaily sales');

    await test('Sales reading summarises the day', async () => {
      const reading = await SalesService.getSalesReading(branch.id, today);
      assert.equal(reading.transactionCount, 4);
      assert.equal(reading.voidedCount, 1);
      const total = reading.byPayment.reduce((sum, row) => sum + row.amount, 0);
      near(total, reading.totalCollected, 'payments add up');
      near(reading.grossSales + reading.taxCollected, reading.totalCollected, 'gross + tax');
    });

    await test('Cash over is booked as other income', async () => {
      const drawer = (await SalesService.getDrawers(branch.id, today, cashier.id))[0];
      const expected = 500 + drawer.cashSales + drawer.collections;
      const result = await SalesService.submitCashCount(ctx, {
        date: today, cashierId: cashier.id, openingFloat: 500, countedCash: expected + 5,
      });
      near(result.variance, 5, 'variance');
      near(await balanceOf(branch.id, ACCOUNT.OTHER_INCOME), 5, 'other income');
      await assert.rejects(
        SalesService.submitCashCount(ctx, { date: today, cashierId: cashier.id, openingFloat: 500, countedCash: 1 }),
        /already/
      );
    });

    await test('Cash short is booked as an expense after reopening', async () => {
      const drawer = (await SalesService.getDrawers(branch.id, today, cashier.id))[0];
      await SalesService.reopenCashCount(ctx, drawer.count!.id);
      near(await balanceOf(branch.id, ACCOUNT.OTHER_INCOME), 0, 'overage reversed');
      const expected = 500 + drawer.cashSales + drawer.collections;
      const result = await SalesService.submitCashCount(ctx, {
        date: today, cashierId: cashier.id, openingFloat: 500, countedCash: expected - 8,
      });
      near(result.variance, -8, 'variance');
      near(await balanceOf(branch.id, ACCOUNT.CASH_SHORTAGE), 8, 'cash shortage');
    });

    // ---------- Financial reports ----------
    console.log('\nFinancial reports');

    const year = Number(today.slice(0, 4));
    const range = yearRange(year);

    await test('Ledger debits equal credits', async () => {
      const sums = await AccountingService.accountSums(branch.id);
      const debit = sums.reduce((sum, row) => sum + row.debit.toNumber(), 0);
      const credit = sums.reduce((sum, row) => sum + row.credit.toNumber(), 0);
      near(debit, credit, 'trial balance');
    });

    await test('Income statement adds up', async () => {
      const statement = await AccountingService.incomeStatement(branch.id, range);
      near(statement.grossProfit, statement.totalRevenue - statement.totalCostOfSales, 'gross profit');
      near(statement.netSurplus, statement.grossProfit - statement.totalExpenses, 'net surplus');
      assert.ok(statement.revenue.some((line) => line.code === ACCOUNT.SALES));
    });

    await test('Balance sheet balances', async () => {
      const sheet = await AccountingService.balanceSheet(branch.id, range.to);
      assert.ok(sheet.balanced, `assets ${sheet.totalAssets} vs ${sheet.totalLiabilities + sheet.totalEquity}`);
    });

    await test('Cash flow reconciles to the cash accounts', async () => {
      const flow = await AccountingService.cashFlow(branch.id, range);
      near(flow.openingCash + flow.netChange, flow.closingCash, 'cash flow');
      const cash =
        (await balanceOf(branch.id, ACCOUNT.CASH)) + (await balanceOf(branch.id, ACCOUNT.EWALLET)) + (await balanceOf(branch.id, ACCOUNT.BANK));
      near(flow.closingCash, cash, 'closing cash');
      assert.ok(flow.financing.items.some((line) => line.code === ACCOUNT.SHARE_CAPITAL));
    });

    await test('Manual entries and new accounts work', async () => {
      await AccountingService.createAccount(ctx, { code: '6500', name: 'Repairs', type: 'EXPENSE' });
      await AccountingService.postManualEntry(ctx, { description: 'Fix shelf', debitCode: '6500', creditCode: ACCOUNT.CASH, amount: 12 });
      near(await balanceOf(branch.id, '6500'), 12, 'repairs');
      await assert.rejects(AccountingService.createAccount(ctx, { code: '6500', name: 'Dup', type: 'EXPENSE' }));
      assert.ok((await AccountingService.balanceSheet(branch.id, range.to)).balanced);
    });

    // ---------- Net surplus distribution ----------
    console.log('\nNet surplus distribution');

    await test('No surplus, no distribution', async () => {
      const surplus = await SurplusService.getNetSurplus(branch.id, year);
      if (surplus <= 0) await assert.rejects(SurplusService.finalize(ctx, year), /no net surplus/);
    });

    await test('Distribution posts the statutory funds and member payables', async () => {
      // Bring the books to a clear surplus first.
      await InventoryService.receiveDelivery(ctx, { itemId: water, quantity: 400, unitCost: 10, paymentType: 'CASH' });
      await TransactionService.processCheckout(ctx, {
        items: [{ productId: waterProduct.id, quantity: 400 }], paymentMethod: 'CASH', amountTendered: 99999, memberId: member.id,
      });
      const surplus = await SurplusService.getNetSurplus(branch.id, year);
      assert.ok(surplus > 0);

      await SurplusService.finalize(ctx, year);
      const funds = await AccountingService.fundBalances(branch.id);
      near(funds.reserveFund, Math.round(surplus * 10) / 100, 'reserve fund');
      near(funds.cetf, Math.round(surplus * 10) / 100, 'cetf');
      near(funds.cdf, Math.round(surplus * 3) / 100, 'cdf');
      near(funds.optionalFund, Math.round(surplus * 7) / 100, 'optional fund');
      const statutory = funds.reserveFund + funds.cetf + funds.cdf + funds.optionalFund;
      near(funds.patronagePayable + funds.interestPayable, surplus - statutory, 'member pools');
      assert.ok((await AccountingService.balanceSheet(branch.id, range.to)).balanced);
      await assert.rejects(SurplusService.finalize(ctx, year), /already/);
    });

    await test('A distribution can be reversed', async () => {
      const [distribution] = await SurplusService.listDistributions(branch.id);
      await SurplusService.reverse(ctx, distribution.id);
      near((await AccountingService.fundBalances(branch.id)).reserveFund, 0, 'reserve fund');
      assert.equal((await SurplusService.listDistributions(branch.id)).length, 0);
    });

    await test('Data stays inside its own cooperative', async () => {
      const other: Ctx = { branchId: -1, userId: cashier.id };
      await assert.rejects(TransactionService.voidTransaction(other, cashSale.id, 'x'));
      await assert.rejects(MemberService.recordPayment(other, member.id, 1));
      await assert.rejects(InventoryService.logSpoilage(other, { itemId: water, quantity: 1, reason: 'x' }));
      assert.equal((await ProductService.list(-1)).length, 0);
    });
  } finally {
    await cleanup(branch.id);
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
