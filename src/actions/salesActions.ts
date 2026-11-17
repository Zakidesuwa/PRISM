'use server';

import { branchAction } from '@/lib/action';
import { SalesService } from '@/services/salesService';

const PAGES = ['/daily-sales', '/reports', '/products'];

export async function submitCashCountAction(input: {
  date: string;
  cashierId: string;
  openingFloat: string;
  /** Piece count per bill and coin. When given, the counted cash is their total. */
  denominations?: Record<string, number> | null;
  countedCash?: string;
  notes?: string;
}) {
  return branchAction(
    ['MANAGER', 'CASHIER'],
    (user) => {
      // A cashier may only close their own drawer.
      if (user.role === 'CASHIER' && input.cashierId !== user.id) {
        throw new Error('You can only count your own drawer.');
      }
      return SalesService.submitCashCount({ branchId: user.branchId, userId: user.id }, input);
    },
    {
      revalidate: PAGES,
      message: (result) =>
        result.variance === 0
          ? 'Drawer counted: exact.'
          : result.variance > 0
            ? `Drawer counted: ₱${result.variance.toFixed(2)} over.`
            : `Drawer counted: ₱${Math.abs(result.variance).toFixed(2)} short.`,
    }
  );
}

export async function reopenCashCountAction(countId: number) {
  return branchAction(
    ['MANAGER'],
    (user) => SalesService.reopenCashCount({ branchId: user.branchId, userId: user.id }, countId),
    { revalidate: PAGES, message: () => 'Cash count reopened.' }
  );
}

export async function saveVendorAction(input: {
  id?: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  commissionPercent: string;
  isActive?: boolean;
}) {
  return branchAction(['MANAGER'], (user) => SalesService.saveVendor({ branchId: user.branchId, userId: user.id }, input), {
    revalidate: PAGES,
    message: (vendor) => `${vendor.name} saved.`,
  });
}

export async function payVendorAction(input: { vendorId: number; amount: string; note?: string }) {
  return branchAction(['MANAGER'], (user) => SalesService.payVendor({ branchId: user.branchId, userId: user.id }, input), {
    revalidate: PAGES,
    message: (result) => `Paid ₱${result.amount.toFixed(2)} to ${result.vendorName}.`,
  });
}
