import { AdminService } from '@/services/adminService';
import InventoryDirectory from './InventoryDirectory';

export default async function AdminInventoryPage() {
  const { items, stats, cooperatives } = await AdminService.getDistrictInventory();
  return <InventoryDirectory items={items} stats={stats} cooperatives={cooperatives} />;
}
