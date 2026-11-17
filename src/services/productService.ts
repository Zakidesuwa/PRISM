// src/services/productService.ts
//
// Products are what the cashier sells. A product holds no stock of its own:
// it lists the inventory items it uses (one item x1 for resale goods, several
// for a prepared meal), and its availability and cost are derived from them.
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ZERO, num, optionalText, requireText, toAmount, toQuantity } from '@/lib/money';
import type { Ctx } from './context';
import { AuditService } from './auditService';

export interface ProductRow {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  image: string | null;
  isActive: boolean;
  vendorId: number | null;
  vendorName: string | null;
  /** Cost of one unit, from its inventory items. Zero for consigned goods. */
  unitCost: number;
  /** Units that can be sold right now. Null when the product tracks no stock. */
  available: number | null;
  ingredients: { inventoryItemId: number; name: string; unit: string; quantityRequired: number }[];
}

export interface ProductInput {
  name: string;
  sku: string;
  category: string;
  price: unknown;
  image?: string;
  vendorId?: number | null;
  ingredients: { inventoryItemId: number; quantity: unknown }[];
}

const productInclude = {
  vendor: { select: { name: true } },
  ingredients: { include: { inventoryItem: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.ProductInclude;

type ProductWithParts = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toRow(product: ProductWithParts): ProductRow {
  const available =
    product.ingredients.length === 0
      ? null
      : Math.max(
          0,
          Math.min(
            ...product.ingredients.map((part) =>
              part.inventoryItem.stock.div(part.quantityRequired).floor().toNumber()
            )
          )
        );

  const cost = product.vendorId
    ? ZERO
    : product.ingredients.reduce(
        (sum, part) => sum.add(part.quantityRequired.mul(part.inventoryItem.unitCost)),
        ZERO
      );

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    price: num(product.price),
    image: product.image,
    isActive: product.isActive,
    vendorId: product.vendorId,
    vendorName: product.vendor?.name ?? null,
    unitCost: num(cost.toDecimalPlaces(2)),
    available,
    ingredients: product.ingredients.map((part) => ({
      inventoryItemId: part.inventoryItemId,
      name: part.inventoryItem.name,
      unit: part.inventoryItem.unit,
      quantityRequired: num(part.quantityRequired),
    })),
  };
}

async function validate(branchId: number, input: ProductInput) {
  const data = {
    name: requireText(input.name, 'Product name'),
    sku: requireText(input.sku, 'SKU', 40).toUpperCase(),
    category: requireText(input.category, 'Category', 40),
    price: toAmount(input.price, 'Price'),
    image: optionalText(input.image, 8),
    vendorId: input.vendorId ?? null,
  };

  if (data.vendorId !== null) {
    const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, branchId } });
    if (!vendor) throw new Error('Vendor not found.');
  }

  const seen = new Set<number>();
  const ingredients = (input.ingredients ?? []).map((part) => {
    if (seen.has(part.inventoryItemId)) throw new Error('Each inventory item can be listed only once.');
    seen.add(part.inventoryItemId);
    return {
      inventoryItemId: part.inventoryItemId,
      quantityRequired: toQuantity(part.quantity, 'Quantity used'),
    };
  });

  if (ingredients.length > 0) {
    const found = await prisma.inventoryItem.count({
      where: { branchId, isActive: true, id: { in: [...seen] } },
    });
    if (found !== ingredients.length) throw new Error('One of the inventory items was not found.');
  }

  return { data, ingredients };
}

export class ProductService {
  static async list(branchId: number, options: { activeOnly?: boolean } = {}): Promise<ProductRow[]> {
    const products = await prisma.product.findMany({
      where: { branchId, ...(options.activeOnly ? { isActive: true } : {}) },
      include: productInclude,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return products.map(toRow);
  }

  static async create(ctx: Ctx, input: ProductInput) {
    const { data, ingredients } = await validate(ctx.branchId, input);
    const product = await prisma.product.create({
      data: { ...data, branchId: ctx.branchId, ingredients: { create: ingredients } },
    });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: 'PRODUCT_CREATE',
      entityType: 'Product',
      entityId: product.id,
      details: { sku: product.sku, name: product.name },
    });
    return { id: product.id, name: product.name };
  }

  static async update(ctx: Ctx, id: number, input: ProductInput) {
    const existing = await prisma.product.findFirst({ where: { id, branchId: ctx.branchId } });
    if (!existing) throw new Error('Product not found.');

    const { data, ingredients } = await validate(ctx.branchId, input);
    const product = await prisma.$transaction(async (tx) => {
      await tx.productIngredient.deleteMany({ where: { productId: id } });
      return tx.product.update({ where: { id }, data: { ...data, ingredients: { create: ingredients } } });
    });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: 'PRODUCT_UPDATE',
      entityType: 'Product',
      entityId: id,
      details: { price: data.price.toFixed(2) },
    });
    return { id: product.id, name: product.name };
  }

  static async setActive(ctx: Ctx, id: number, isActive: boolean) {
    const existing = await prisma.product.findFirst({ where: { id, branchId: ctx.branchId } });
    if (!existing) throw new Error('Product not found.');

    await prisma.product.update({ where: { id }, data: { isActive } });
    await AuditService.log({
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: isActive ? 'PRODUCT_ACTIVATE' : 'PRODUCT_DEACTIVATE',
      entityType: 'Product',
      entityId: id,
    });
    return { id, isActive };
  }
}
