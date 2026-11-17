import { requireBranchUser } from '@/lib/authGuard';
import { dayRange, manilaToday } from '@/lib/dates';
import { ProductService } from '@/services/productService';
import { SettingsService } from '@/services/settingsService';
import { TransactionService } from '@/services/transactionService';
import PosClient from './PosClient';

export const metadata = { title: 'Point of Sale · PRISM' };

export default async function POSPage() {
  const user = await requireBranchUser(['CASHIER', 'MANAGER']);

  const [products, settings, todaysSales] = await Promise.all([
    ProductService.list(user.branchId, { activeOnly: true }),
    SettingsService.get(),
    TransactionService.list(user.branchId, {
      range: dayRange(manilaToday()),
      // A cashier sees their own sales; a manager sees the whole store's.
      cashierId: user.role === 'CASHIER' ? user.id : undefined,
      take: 40,
    }),
  ]);

  return (
    <PosClient
      products={products}
      todaysSales={todaysSales}
      taxRate={settings.taxes.taxRate}
      storeName={user.branchName}
      receiptHeader={settings.receipts.headerText}
      receiptFooter={settings.receipts.footerText}
      autoPrint={settings.preferences.autoPrintReceipts}
      canVoid={user.role === 'MANAGER' || !settings.preferences.managerOverrideVoids}
    />
  );
}
