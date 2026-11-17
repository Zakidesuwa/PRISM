'use server';

import { revalidatePath } from 'next/cache';
import { adminAction, branchAction } from '@/lib/action';
import { requireRole } from '@/lib/authGuard';
import type { SystemSettings } from '@/lib/settings';
import { BranchService, type BranchInput } from '@/services/branchService';
import { SettingsService } from '@/services/settingsService';
import { UserService, type UserInput } from '@/services/userService';
import { actionError, actionSuccess } from '@/utils/response';

export async function saveSystemSettingsAction(settings: SystemSettings) {
  return adminAction((user) => SettingsService.save(settings, user.id), {
    revalidate: ['/admin/settings', '/pos'],
    message: () => 'Settings saved.',
  });
}

export async function createBranchAction(input: BranchInput) {
  return adminAction((user) => BranchService.create(input, user.id), {
    revalidate: ['/admin', '/admin/cooperative'],
    message: (branch) => `${branch.name} registered.`,
  });
}

/** A manager edits their own cooperative's profile. */
export async function updateStoreProfileAction(input: BranchInput) {
  return branchAction(['MANAGER'], (user) => BranchService.update(user.branchId, input, user.id), {
    revalidate: ['/settings'],
    message: () => 'Store profile saved.',
  });
}

// User management is shared: an admin manages every account, a manager only
// the accounts of their own cooperative (enforced in UserService).

async function userAction<T>(fn: (actor: Awaited<ReturnType<typeof requireRole>>) => Promise<T>, message: string) {
  try {
    const actor = await requireRole(['ADMIN', 'MANAGER']);
    const result = await fn(actor);
    revalidatePath('/users');
    revalidatePath('/admin/settings');
    return actionSuccess(result, message);
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Something went wrong.';
    return actionError<T>(text.includes('Unique constraint') ? 'That username is already taken.' : text);
  }
}

export async function createUserAction(input: UserInput) {
  return userAction((actor) => UserService.create(actor, input), 'User created.');
}

export async function updateUserAction(id: string, input: { name: string; role: string; isActive: boolean }) {
  return userAction((actor) => UserService.update(actor, id, input), 'User updated.');
}

export async function resetPasswordAction(id: string, password: string) {
  return userAction((actor) => UserService.resetPassword(actor, id, password), 'Password reset.');
}
