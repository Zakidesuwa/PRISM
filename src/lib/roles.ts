// src/lib/roles.ts
// Roles and route access. Pure data: safe to import from client components.

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOREKEEPER';

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  /** Null for ADMIN, who oversees every cooperative. */
  branchId: number | null;
  branchName: string | null;
  /** Where this role lands after signing in. */
  homePath: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  STOREKEEPER: 'Store Keeper',
};

export function homePathFor(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'CASHIER':
      return '/pos';
    case 'STOREKEEPER':
      return '/inventory';
    default:
      return '/';
  }
}

/** Which store roles may open each route. ADMIN is confined to /admin. */
export const ROUTE_ROLES: Record<string, Role[]> = {
  '/': ['MANAGER'],
  '/pos': ['MANAGER', 'CASHIER'],
  '/member-lookup': ['MANAGER', 'CASHIER'],
  '/daily-sales': ['MANAGER', 'CASHIER'],
  '/products': ['MANAGER', 'STOREKEEPER'],
  '/inventory': ['MANAGER', 'STOREKEEPER'],
  '/members': ['MANAGER'],
  '/analytics': ['MANAGER'],
  '/dividends': ['MANAGER'],
  '/reports': ['MANAGER'],
  '/users': ['MANAGER'],
  '/settings': ['MANAGER'],
};

export function canAccess(role: Role, pathname: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return role === 'ADMIN';
  if (role === 'ADMIN') return false;

  const match = Object.keys(ROUTE_ROLES)
    .filter((route) => route !== '/')
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (match) return ROUTE_ROLES[match].includes(role);
  if (pathname === '/') return ROUTE_ROLES['/'].includes(role);
  return true;
}
