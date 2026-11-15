// src/lib/authGuard.ts
import { getSession } from './session';
import { Role, SessionUser } from './auth';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized: User is not authenticated') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden: Insufficient permissions for this action') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Server-side helper to resolve the currently authenticated user.
 * Reads from the server session cookie.
 */
export async function requireServerUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * Server-side guard to enforce role-based access control inside Server Actions / Service Layer.
 * Throws ForbiddenError if the active user doesn't possess one of the allowed roles.
 */
export async function requireRole(allowedRoles: Role[]): Promise<SessionUser> {
  const user = await requireServerUser();
  
  // Treat 'USER' as 'CASHIER' for backwards compatibility
  const userRole = user.role === 'USER' ? 'CASHIER' : user.role;
  const isAllowed = allowedRoles.some((role) => role === userRole || role === user.role);

  if (!isAllowed) {
    throw new ForbiddenError(
      `Forbidden: Role '${user.role}' is not authorized. Required: ${allowedRoles.join(', ')}`
    );
  }

  return user;
}
