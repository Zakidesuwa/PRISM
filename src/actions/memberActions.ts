'use server';

import { revalidatePath } from 'next/cache';
import { requireRole, requireServerUser } from '@/lib/authGuard';
import { MemberService, CreateMemberInput, UpdateMemberInput } from '@/services/memberService';
import { ActionResponse, actionSuccess, actionError } from '@/utils/response';

/**
 * Server action to fetch cooperative members with search and filter.
 */
export async function getMembersAction(params?: { branchId?: number; search?: string }): Promise<ActionResponse<any>> {
  try {
    await requireServerUser();
    const members = await MemberService.getAllMembers(params);
    return actionSuccess(members);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch members.';
    return actionError(message);
  }
}

/**
 * Server action to register a new cooperative member.
 * Enforces ADMIN or MANAGER role server-side.
 */
export async function createMemberAction(data: CreateMemberInput): Promise<ActionResponse<any>> {
  try {
    const user = await requireRole(['ADMIN', 'MANAGER']);
    const member = await MemberService.createMember(data, user.id);
    
    revalidatePath('/members');
    return actionSuccess(member, `Member '${member.fullName}' created successfully!`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create member.';
    return actionError(message);
  }
}

/**
 * Server action to update a cooperative member.
 * Enforces ADMIN or MANAGER role server-side.
 */
export async function updateMemberAction(id: number, data: UpdateMemberInput): Promise<ActionResponse<any>> {
  try {
    const user = await requireRole(['ADMIN', 'MANAGER']);
    const member = await MemberService.updateMember(id, data, user.id);

    revalidatePath('/members');
    return actionSuccess(member, `Member '${member.fullName}' updated successfully!`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update member.';
    return actionError(message);
  }
}

/**
 * Server action to fetch all school branches for selection.
 */
export async function getBranchesAction(): Promise<ActionResponse<any>> {
  try {
    await requireServerUser();
    const branches = await MemberService.getAllBranches();
    return actionSuccess(branches);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch school branches.';
    return actionError(message);
  }
}
