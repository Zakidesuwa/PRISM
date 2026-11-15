'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/authGuard';
import { TransactionService, CheckoutCartItem, CheckoutResult } from '@/services/transactionService';
import { ActionResponse, actionSuccess, actionError } from '@/utils/response';

export interface CheckoutActionInput {
  items: CheckoutCartItem[];
  memberId?: number | null;
}

/**
 * Server action to process a point-of-sale checkout.
 * Enforces server-side authentication and role check (CASHIER, ADMIN, or MANAGER).
 */
export async function checkoutAction(input: CheckoutActionInput): Promise<ActionResponse<CheckoutResult>> {
  try {
    // 1. Enforce Server-Side Role Guard
    const user = await requireRole(['CASHIER', 'ADMIN', 'MANAGER']);

    // 2. Execute ACID transaction engine
    const result = await TransactionService.processCheckout({
      cashierId: user.id,
      memberId: input.memberId,
      items: input.items,
    });

    // 3. Revalidate affected pages to refresh live data
    revalidatePath('/pos');
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/analytics');
    revalidatePath('/members');

    return actionSuccess(result, `Transaction ${result.transactionNumber} completed successfully!`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred during checkout.';
    return actionError(message);
  }
}
