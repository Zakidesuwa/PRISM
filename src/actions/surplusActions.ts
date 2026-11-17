'use server';

import { requireRole } from '@/lib/authGuard';
import { SurplusService } from '@/services/surplusService';
import type { DistributionMember } from '@/lib/surplus/distribution';
import { ActionResponse, actionSuccess, actionError } from '@/utils/response';

/**
 * Server action to load the members used in the net surplus distribution.
 * Enforces ADMIN or MANAGER role server-side.
 */
export async function getDistributionMembersAction(): Promise<ActionResponse<DistributionMember[]>> {
  try {
    await requireRole(['ADMIN', 'MANAGER']);
    const members = await SurplusService.getDistributionMembers();
    return actionSuccess(members);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load members.';
    return actionError(message);
  }
}
