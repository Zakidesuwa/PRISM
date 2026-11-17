// src/services/inventoryService.ts
//
// Inventory engine. Inventory items are the single source of stock: sales,
// deliveries and spoilage all move stock here and leave a StockMovement.
import prisma from '@/lib/prisma';
import { ZERO, num, optionalText, requireText, round2, toAmount, toQuantity, type Dec } from '@/lib/money';
import type { Ctx, Tx } from './context';
import { ACCOUNT, AccountingService } from './accountingService';
import { AuditService } from './auditService';

export type StockStatus = 'Optimal' | 'Low Stock' | 'Empty';

export function stockStatusOf(stock: Dec, reorderLevel: Dec): StockStatus {
  if (stock.lte(0)) return 'Empty';
  if (stock.lte(reorderLevel)) return 'Low Stock';
  return 'Optimal';
}

export interface InventoryRow {
  id: number;
  name: string;
  packaging: string;
  sku: string;
  category: string;
  supplier: string;
  deliveryDays: string;
  unitCost: number;
  stock: number;
  unit: string;
  reorderLevel: number;
  parLevel: number;
  status: StockStatus;
  value: number;
}

export interface InventoryItemInput {
  name: string;
  packaging: string;
  sku: string;
  category: string;
  supplier: string;
  deliveryDays: string;
  unit: string;
  reorderLevel: unknown;
  parLevel: unknown;
}

export interface MovementRow {
  id: number;
  itemName: string;
  unit: string;
  type: string;
  quantity: number;
  unitCost: number;
  stockAfter: number;
  note: string | null;
  reference: string | null;
  createdAt: string;
}

function validateItem(input: InventoryItemInput) {
  const reorderLevel = toQuantity(input.reorderLevel, 'Reorder level', { allowZero: true });
  const parLevel = toQuantity(input.parLevel, 'Full stock level');
  if (parLevel.lt(reorderLevel)) {
    throw new Error('Full stock level must not be below the reorder level.');
  }
  return {
    name: requireText(input.name, 'Item name'),
    packaging: optionalText(input.packaging, 60) ?? '',
    sku: requireText(input.sku, 'SKU', 40).toUpperCase(),
    category: requireText(input.category, 'Category', 40),
    supplier: optionalText(input.supplier, 80) ?? '',
    deliveryDays: optionalText(input.deliveryDays, 40) ?? '',
    unit: requireText(input.unit, 'Unit', 20),
    reorderLevel,
    parLevel,
  };
}

export class InventoryService {
  static async list(branchId: number): Promise<InventoryRow[]> {
    const items = await prisma.inventoryItem.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      packaging: item.packaging,
      sku: item.sku,
      category: item.category,
      supplier: item.supplier,
      deliveryDays: item.deliveryDays,
      unitCost: num(item.unitCost),
      stock: num(item.stock),
      unit: item.unit,
      reorderLevel: num(item.reorderLevel),
      parLevel: num(item.parLevel),
      status: stockStatusOf(item.stock, item.reorderLevel),
      value: num(round2(item.stock.mul(item.unitCost))),
    }));
  }

  static async create(ctx: Ctx, input: InventoryItemInput) {
    const data = validateItem(input);
    const item = await prisma.inventoryItem.create({ data: { ...data, branchId: ctx.branchId } });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: 'INVENTORY_ITEM_CREATE',
      entityType: 'InventoryItem',
      entityId: item.id,
      details: { sku: item.sku, name: item.name },
    });
    return { id: item.id, name: item.name };
  }

  /** Edits the item's details and its reorder thresholds. */
  static async update(ctx: Ctx, id: number, input: InventoryItemInput) {
    const data = validateItem(input);
    const existing = await prisma.inventoryItem.findFirst({ where: { id, branchId: ctx.branchId } });
    if (!existing) throw new Error('Inventory item not found.');

    const item = await prisma.inventoryItem.update({ where: { id }, data });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: 'INVENTORY_ITEM_UPDATE',
      entityType: 'InventoryItem',
      entityId: id,
      details: { reorderLevel: data.reorderLevel.toString(), parLevel: data.parLevel.toString() },
    });
    return { id: item.id, name: item.name };
  }

  static async archive(ctx: Ctx, id: number) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, branchId: ctx.branchId },
      include: { productIngredients: { where: { product: { isActive: true } }, select: { id: true } } },
    });
    if (!item) throw new Error('Inventory item not found.');
    if (item.productIngredients.length > 0) {
      throw new Error('This item is still used by an active product. Remove it from the product first.');
    }
    if (item.stock.gt(0)) throw new Error('Only items with no stock left can be archived.');

    await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: 'INVENTORY_ITEM_ARCHIVE',
      entityType: 'InventoryItem',
      entityId: id,
    });
    return { id };
  }

  /**
   * Receives a delivery: adds stock, re-averages unit cost and books the
   * purchase (paid in cash, or on account to the supplier).
   */
  static async receiveDelivery(
    ctx: Ctx,
    input: { itemId: number; quantity: unknown; unitCost: unknown; paymentType: string; reference?: string; note?: string }
  ) {
    const quantity = toQuantity(input.quantity, 'Quantity');
    const unitCost = toAmount(input.unitCost, 'Unit cost', { allowZero: true });
    const onAccount = input.paymentType === 'ACCOUNT';

    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: input.itemId, branchId: ctx.branchId } });
      if (!item) throw new Error('Inventory item not found.');

      const onHand = item.stock.gt(0) ? item.stock : ZERO;
      const newStock = item.stock.add(quantity);
      const averageCost = onHand.isZero()
        ? unitCost
        : onHand.mul(item.unitCost).add(quantity.mul(unitCost)).div(onHand.add(quantity));

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { stock: newStock, unitCost: averageCost.toDecimalPlaces(4) },
      });

      const movement = await tx.stockMovement.create({
        data: {
          branchId: ctx.branchId,
          inventoryItemId: item.id,
          type: 'RECEIVE',
          quantity,
          unitCost,
          stockAfter: newStock,
          reference: optionalText(input.reference, 60),
          note: optionalText(input.note),
          userId: ctx.userId,
          ...(ctx.at ? { createdAt: ctx.at } : {}),
        },
      });

      const amount = round2(quantity.mul(unitCost));
      await AccountingService.postEntry(tx, ctx, {
        description: `Delivery received: ${item.name}`,
        sourceType: 'DELIVERY',
        sourceId: movement.id,
        lines: [
          { code: ACCOUNT.INVENTORY, debit: amount },
          { code: onAccount ? ACCOUNT.PAYABLE : ACCOUNT.CASH, credit: amount },
        ],
      });

      await AuditService.log(
        {
          branchId: ctx.branchId,
          userId: ctx.userId,
          action: 'STOCK_RECEIVE',
          entityType: 'InventoryItem',
          entityId: item.id,
          details: { quantity: quantity.toString(), unitCost: unitCost.toString(), onAccount },
          at: ctx.at,
        },
        tx
      );

      return { itemName: item.name, stock: num(newStock), amount: num(amount) };
    });
  }

  /** Writes off spoiled or wasted stock as an expense. */
  static async logSpoilage(ctx: Ctx, input: { itemId: number; quantity: unknown; reason: string }) {
    const quantity = toQuantity(input.quantity, 'Quantity');
    const reason = requireText(input.reason, 'Reason', 200);

    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: input.itemId, branchId: ctx.branchId } });
      if (!item) throw new Error('Inventory item not found.');

      const updated = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { stock: { decrement: quantity } },
      });
      if (updated.stock.lt(0)) {
        throw new Error(`Only ${item.stock.toString()} ${item.unit} of ${item.name} on hand.`);
      }

      const movement = await tx.stockMovement.create({
        data: {
          branchId: ctx.branchId,
          inventoryItemId: item.id,
          type: 'SPOILAGE',
          quantity: quantity.neg(),
          unitCost: item.unitCost,
          stockAfter: updated.stock,
          note: reason,
          userId: ctx.userId,
          ...(ctx.at ? { createdAt: ctx.at } : {}),
        },
      });

      const amount = round2(quantity.mul(item.unitCost));
      await AccountingService.postEntry(tx, ctx, {
        description: `Spoilage: ${item.name} (${reason})`,
        sourceType: 'SPOILAGE',
        sourceId: movement.id,
        lines: [
          { code: ACCOUNT.SPOILAGE, debit: amount },
          { code: ACCOUNT.INVENTORY, credit: amount },
        ],
      });

      await AuditService.log(
        {
          branchId: ctx.branchId,
          userId: ctx.userId,
          action: 'STOCK_SPOILAGE',
          entityType: 'InventoryItem',
          entityId: item.id,
          details: { quantity: quantity.toString(), reason },
          at: ctx.at,
        },
        tx
      );

      return { itemName: item.name, stock: num(updated.stock), amount: num(amount) };
    });
  }

  /**
   * Takes stock out for a sale. The decrement is atomic, so two checkouts can
   * never sell the same last unit. Called inside the checkout transaction.
   */
  static async deductForSale(
    tx: Tx,
    ctx: Ctx,
    needs: Map<number, Dec>,
    reference: string
  ) {
    for (const [itemId, quantity] of needs) {
      const updated = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { stock: { decrement: quantity } },
      });
      if (updated.stock.lt(0)) {
        const available = updated.stock.add(quantity);
        throw new Error(
          `Not enough ${updated.name} in stock. Available: ${available.toString()} ${updated.unit}, needed: ${quantity.toString()}.`
        );
      }
      await tx.stockMovement.create({
        data: {
          branchId: ctx.branchId,
          inventoryItemId: itemId,
          type: 'SALE',
          quantity: quantity.neg(),
          unitCost: updated.unitCost,
          stockAfter: updated.stock,
          reference,
          userId: ctx.userId,
          ...(ctx.at ? { createdAt: ctx.at } : {}),
        },
      });
    }
  }

  /** Puts stock back when a sale is voided, using the sale's own movements. */
  static async returnFromVoid(tx: Tx, ctx: Ctx, reference: string) {
    const movements = await tx.stockMovement.findMany({
      where: { branchId: ctx.branchId, reference, type: 'SALE' },
    });
    for (const movement of movements) {
      const quantity = movement.quantity.neg();
      const updated = await tx.inventoryItem.update({
        where: { id: movement.inventoryItemId },
        data: { stock: { increment: quantity } },
      });
      await tx.stockMovement.create({
        data: {
          branchId: ctx.branchId,
          inventoryItemId: movement.inventoryItemId,
          type: 'VOID_RETURN',
          quantity,
          unitCost: movement.unitCost,
          stockAfter: updated.stock,
          reference,
          userId: ctx.userId,
        },
      });
    }
  }

  static async listMovements(branchId: number, take = 60): Promise<MovementRow[]> {
    const rows = await prisma.stockMovement.findMany({
      where: { branchId, type: { not: 'SALE' } },
      orderBy: { id: 'desc' },
      take,
      include: { inventoryItem: { select: { name: true, unit: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      itemName: row.inventoryItem.name,
      unit: row.inventoryItem.unit,
      type: row.type,
      quantity: num(row.quantity),
      unitCost: num(row.unitCost),
      stockAfter: num(row.stockAfter),
      note: row.note,
      reference: row.reference,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  static async lowStockCount(branchId: number): Promise<number> {
    const items = await prisma.inventoryItem.findMany({
      where: { branchId, isActive: true },
      select: { stock: true, reorderLevel: true },
    });
    return items.filter((item) => item.stock.lte(item.reorderLevel)).length;
  }
}

