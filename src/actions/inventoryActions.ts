'use server';

import { branchAction } from '@/lib/action';
import type { Role } from '@/lib/roles';
import { InventoryService, type InventoryItemInput } from '@/services/inventoryService';
import { ProductService, type ProductInput } from '@/services/productService';

const ROLES: Role[] = ['MANAGER', 'STOREKEEPER'];
const PAGES = ['/inventory', '/products', '/pos', '/', '/reports'];

export async function createInventoryItemAction(input: InventoryItemInput) {
  return branchAction(ROLES, (user) => InventoryService.create({ branchId: user.branchId, userId: user.id }, input), {
    revalidate: PAGES,
    message: (item) => `${item.name} added to inventory.`,
  });
}

export async function updateInventoryItemAction(id: number, input: InventoryItemInput) {
  return branchAction(ROLES, (user) => InventoryService.update({ branchId: user.branchId, userId: user.id }, id, input), {
    revalidate: PAGES,
    message: (item) => `${item.name} updated.`,
  });
}

export async function archiveInventoryItemAction(id: number) {
  return branchAction(ROLES, (user) => InventoryService.archive({ branchId: user.branchId, userId: user.id }, id), {
    revalidate: PAGES,
    message: () => 'Item archived.',
  });
}

export async function receiveDeliveryAction(input: {
  itemId: number;
  quantity: string;
  unitCost: string;
  paymentType: string;
  reference?: string;
  note?: string;
}) {
  return branchAction(
    ROLES,
    (user) => InventoryService.receiveDelivery({ branchId: user.branchId, userId: user.id }, input),
    { revalidate: PAGES, message: (result) => `Delivery received. ${result.itemName} now at ${result.stock}.` }
  );
}

export async function logSpoilageAction(input: { itemId: number; quantity: string; reason: string }) {
  return branchAction(
    ROLES,
    (user) => InventoryService.logSpoilage({ branchId: user.branchId, userId: user.id }, input),
    { revalidate: PAGES, message: (result) => `Spoilage logged. ${result.itemName} now at ${result.stock}.` }
  );
}

export async function createProductAction(input: ProductInput) {
  return branchAction(ROLES, (user) => ProductService.create({ branchId: user.branchId, userId: user.id }, input), {
    revalidate: PAGES,
    message: (product) => `${product.name} added.`,
  });
}

export async function updateProductAction(id: number, input: ProductInput) {
  return branchAction(ROLES, (user) => ProductService.update({ branchId: user.branchId, userId: user.id }, id, input), {
    revalidate: PAGES,
    message: (product) => `${product.name} updated.`,
  });
}

export async function setProductActiveAction(id: number, isActive: boolean) {
  return branchAction(
    ROLES,
    (user) => ProductService.setActive({ branchId: user.branchId, userId: user.id }, id, isActive),
    { revalidate: PAGES, message: (result) => (result.isActive ? 'Product is on sale again.' : 'Product taken off sale.') }
  );
}
