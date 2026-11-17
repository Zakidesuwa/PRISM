import { requireBranchUser } from '@/lib/authGuard';
import { InventoryService } from '@/services/inventoryService';
import { ProductService } from '@/services/productService';
import { SalesService } from '@/services/salesService';
import ProductsClient from './ProductsClient';

export const metadata = { title: 'Products · PRISM' };

export default async function ProductsPage() {
  const user = await requireBranchUser(['MANAGER', 'STOREKEEPER']);
  const [products, items, vendors] = await Promise.all([
    ProductService.list(user.branchId),
    InventoryService.list(user.branchId),
    SalesService.listVendorOptions(user.branchId),
  ]);

  return (
    <ProductsClient
      products={products}
      inventory={items.map((item) => ({ id: item.id, name: item.name, unit: item.unit }))}
      vendors={vendors}
    />
  );
}
