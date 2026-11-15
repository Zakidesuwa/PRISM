// src/lib/auth.ts
// Authentication and demo user configuration for PRISM

export type Role = 'ADMIN' | 'CASHIER' | 'MANAGER' | 'USER';

export interface DemoUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: Role;
  /** Where this role lands after a successful login. */
  homePath: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'admin',
    username: 'admin',
    password: 'admin123',
    name: 'Admin User',
    role: 'ADMIN',
    homePath: '/admin',
  },
  {
    id: 'user',
    username: 'user',
    password: 'user123',
    name: 'Standard Cashier',
    role: 'CASHIER',
    homePath: '/',
  },
  {
    id: 'cashier',
    username: 'cashier',
    password: 'cashier123',
    name: 'POS Cashier',
    role: 'CASHIER',
    homePath: '/pos',
  },
  {
    id: 'manager',
    username: 'manager',
    password: 'manager123',
    name: 'Elena Gomez (Manager)',
    role: 'MANAGER',
    homePath: '/',
  },
];

/** What we expose to the app — never includes the password. */
export type SessionUser = Omit<DemoUser, 'password'>;

/** Copies fields explicitly so a future field on DemoUser can't leak by accident. */
export function toSessionUser(user: DemoUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    homePath: user.homePath,
  };
}

export function verifyCredentials(username: string, password: string): SessionUser | null {
  const match = DEMO_USERS.find(
    (user) => user.username === username.trim().toLowerCase() && user.password === password
  );

  return match ? toSessionUser(match) : null;
}

/**
 * The session cookie stores only the user id, so a tampered cookie can at worst
 * select another seeded user rather than inject arbitrary data.
 */
export function findUserById(id: string | undefined): SessionUser | null {
  if (!id) return null;

  const match = DEMO_USERS.find((user) => user.id === id);
  return match ? toSessionUser(match) : null;
}

export const SESSION_COOKIE = 'prism_session';
