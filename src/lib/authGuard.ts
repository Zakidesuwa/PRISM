// src/lib/authGuard.ts
import { getSession } from './session';
import type { Role, SessionUser } from './roles';

export class UnauthorizedError extends Error {
  constructor(message = 'You are signed out. Please sign in again.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** A signed-in user who belongs to a cooperative (everyone except ADMIN). */
export type BranchUser = SessionUser & { branchId: number; branchName: string };

export async function requireServerUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(allowedRoles: Role[]): Promise<SessionUser> {
  const user = await requireServerUser();
  if (!allowedRoles.includes(user.role)) throw new ForbiddenError();
  return user;
}

/** Role check for store operations: also guarantees the user has a branch. */
export async function requireBranchUser(allowedRoles: Role[]): Promise<BranchUser> {
  const user = await requireRole(allowedRoles);
  if (user.branchId === null || user.branchName === null) {
    throw new ForbiddenError('This account is not assigned to a cooperative.');
  }
  return user as BranchUser;
}
