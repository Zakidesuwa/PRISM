'use server';

import { branchAction } from '@/lib/action';
import { MemberService } from '@/services/memberService';
import { SettingsService } from '@/services/settingsService';
import { TransactionService, type ProcessCheckoutInput } from '@/services/transactionService';

const SALES_PAGES = ['/pos', '/', '/inventory', '/products', '/analytics', '/members', '/daily-sales', '/reports'];

export async function checkoutAction(input: ProcessCheckoutInput) {
  return branchAction(
    ['CASHIER', 'MANAGER'],
    (user) => TransactionService.processCheckout({ branchId: user.branchId, userId: user.id }, input),
    { revalidate: SALES_PAGES, message: (receipt) => `Sale ${receipt.transactionNumber} completed.` }
  );
}

export async function voidTransactionAction(transactionId: string, reason: string) {
  const settings = await SettingsService.get();
  // When "manager override for voids" is on, only a manager may void.
  const roles = settings.preferences.managerOverrideVoids
    ? (['MANAGER'] as const)
    : (['MANAGER', 'CASHIER'] as const);

  return branchAction(
    [...roles],
    (user) => TransactionService.voidTransaction({ branchId: user.branchId, userId: user.id }, transactionId, reason),
    { revalidate: SALES_PAGES, message: (receipt) => `Sale ${receipt.transactionNumber} voided.` }
  );
}

export async function searchMembersAction(query: string) {
  return branchAction(['CASHIER', 'MANAGER'], (user) => MemberService.search(user.branchId, query));
}
