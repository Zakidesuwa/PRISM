import { requireBranchUser } from '@/lib/authGuard';
import { InventoryService } from '@/services/inventoryService';
import InventoryClient from './InventoryClient';

export const metadata = { title: 'Inventory · PRISM' };

export default async function InventoryPage() {
  const user = await requireBranchUser(['MANAGER', 'STOREKEEPER']);
  const [items, movements] = await Promise.all([
    InventoryService.list(user.branchId),
    InventoryService.listMovements(user.branchId),
  ]);

  return <InventoryClient items={items} movements={movements} />;
}
