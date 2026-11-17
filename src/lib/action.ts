// src/lib/action.ts
// Shared wrapper for server actions: role check, error handling, revalidation.
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { requireBranchUser, requireRole, type BranchUser } from './authGuard';
import type { Role, SessionUser } from './roles';
import { ActionResponse, actionError, actionSuccess } from '@/utils/response';

function toMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return 'That code or name is already in use.';
    if (error.code === 'P2025') return 'That record no longer exists.';
    if (error.code === 'P2003') return 'That record is still in use and cannot be removed.';
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'Cannot reach the database. Check that it is running.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

interface Options<T> {
  revalidate?: string[];
  message?: (result: T) => string;
}

async function run<U, T>(
  getUser: () => Promise<U>,
  fn: (user: U) => Promise<T>,
  options?: Options<T>
): Promise<ActionResponse<T>> {
  try {
    const user = await getUser();
    const result = await fn(user);
    options?.revalidate?.forEach((path) => revalidatePath(path));
    return actionSuccess(result, options?.message?.(result));
  } catch (error) {
    return actionError(toMessage(error));
  }
}

/** For store actions: the user is guaranteed to belong to a cooperative. */
export function branchAction<T>(
  roles: Role[],
  fn: (user: BranchUser) => Promise<T>,
  options?: Options<T>
) {
  return run(() => requireBranchUser(roles), fn, options);
}

/** For district-level actions. */
export function adminAction<T>(fn: (user: SessionUser) => Promise<T>, options?: Options<T>) {
  return run(() => requireRole(['ADMIN']), fn, options);
}
