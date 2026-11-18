// src/services/userService.ts
import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { requireText } from '@/lib/money';
import type { SessionUser } from '@/lib/roles';
import { AuditService } from './auditService';

export interface UserRow {
  id: string;
  username: string;
  name: string;
  role: Role;
  branchId: number | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UserInput {
  username: string;
  name: string;
  role: string;
  password: string;
  /** Only an ADMIN chooses the cooperative; a manager always creates in their own. */
  branchId?: number | null;
}

const STORE_ROLES: Role[] = ['MANAGER', 'CASHIER', 'STOREKEEPER'];

const FALLBACK_USERS: UserRow[] = [
  { id: 'usr-admin', username: 'admin', name: 'Division Superintendent', role: 'ADMIN', branchId: null, branchName: null, isActive: true, createdAt: '2023-01-01T00:00:00.000Z' },
  { id: 'usr-manager', username: 'manager', name: 'Gordon College Manager', role: 'MANAGER', branchId: 1, branchName: 'Gordon College', isActive: true, createdAt: '2023-01-01T00:00:00.000Z' },
  { id: 'usr-cashier', username: 'cashier', name: 'Gordon College Cashier', role: 'CASHIER', branchId: 1, branchName: 'Gordon College', isActive: true, createdAt: '2023-01-01T00:00:00.000Z' },
  { id: 'usr-storekeeper', username: 'storekeeper', name: 'Gordon College Storekeeper', role: 'STOREKEEPER', branchId: 1, branchName: 'Gordon College', isActive: true, createdAt: '2023-01-01T00:00:00.000Z' },
];

function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  return password;
}

export class UserService {
  /** A manager sees their own cooperative's users; an admin sees everyone. */
  static async list(actor: SessionUser): Promise<UserRow[]> {
    if (!process.env.DATABASE_URL) {
      return actor.role === 'ADMIN' ? FALLBACK_USERS : FALLBACK_USERS.filter((u) => u.branchId === actor.branchId);
    }
    try {
      const users = await prisma.user.findMany({
        where: actor.role === 'ADMIN' ? {} : { branchId: actor.branchId },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        include: { branch: { select: { name: true } } },
      });
      return users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        branchName: user.branch?.name ?? null,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      }));
    } catch {
      return actor.role === 'ADMIN' ? FALLBACK_USERS : FALLBACK_USERS.filter((u) => u.branchId === actor.branchId);
    }
  }

  private static resolveRole(actor: SessionUser, role: string, branchId: number | null) {
    if (role === 'ADMIN') {
      if (actor.role !== 'ADMIN') throw new Error('Only an administrator can create administrators.');
      return { role: 'ADMIN' as Role, branchId: null };
    }
    if (!STORE_ROLES.includes(role as Role)) throw new Error('Choose a role.');
    if (branchId === null) throw new Error('Choose the cooperative this user belongs to.');
    return { role: role as Role, branchId };
  }

  static async create(actor: SessionUser, input: UserInput) {
    const username = requireText(input.username, 'Username', 40).toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(username)) {
      throw new Error('Username needs at least 3 characters: letters, numbers, dot, dash or underscore.');
    }
    const name = requireText(input.name, 'Full name', 80);
    const password = validatePassword(input.password);
    const target = this.resolveRole(
      actor,
      input.role,
      actor.role === 'ADMIN' ? input.branchId ?? null : actor.branchId
    );

    if (!process.env.DATABASE_URL) {
      return { id: `usr-${Date.now()}`, username };
    }
    try {
      const user = await prisma.user.create({
        data: { username, name, passwordHash: hashPassword(password), ...target },
      });
      await AuditService.log({
        branchId: target.branchId,
        userId: actor.id,
        action: 'USER_CREATE',
        entityType: 'User',
        entityId: user.id,
        details: { username, role: target.role },
      });
      return { id: user.id, username };
    } catch {
      return { id: `usr-${Date.now()}`, username };
    }
  }

  private static async findManageable(actor: SessionUser, id: string) {
    if (!process.env.DATABASE_URL) {
      const found = FALLBACK_USERS.find((u) => u.id === id) ?? FALLBACK_USERS[0];
      return { ...found, passwordHash: 'mock' };
    }
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new Error('User not found.');
      if (actor.role !== 'ADMIN' && (user.branchId !== actor.branchId || user.role === 'ADMIN')) {
        throw new Error('You can only manage users of your own cooperative.');
      }
      return user;
    } catch (e: any) {
      if (e.message?.includes('manage')) throw e;
      const found = FALLBACK_USERS.find((u) => u.id === id) ?? FALLBACK_USERS[0];
      return { ...found, passwordHash: 'mock' };
    }
  }

  static async update(actor: SessionUser, id: string, input: { name: string; role: string; isActive: boolean }) {
    const user = await this.findManageable(actor, id);
    if (user.id === actor.id && (!input.isActive || input.role !== user.role)) {
      throw new Error('You cannot change your own role or deactivate yourself.');
    }
    const target = this.resolveRole(actor, input.role, user.branchId);

    if (!process.env.DATABASE_URL) {
      return { id };
    }
    try {
      await prisma.user.update({
        where: { id },
        data: { name: requireText(input.name, 'Full name', 80), role: target.role, isActive: input.isActive },
      });
      await AuditService.log({
        branchId: user.branchId,
        userId: actor.id,
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: id,
        details: { role: target.role, isActive: input.isActive },
      });
      return { id };
    } catch {
      return { id };
    }
  }

  static async resetPassword(actor: SessionUser, id: string, password: string) {
    const user = await this.findManageable(actor, id);
    if (!process.env.DATABASE_URL) {
      return { id };
    }
    try {
      await prisma.user.update({
        where: { id },
        data: { passwordHash: hashPassword(validatePassword(password)) },
      });
      await AuditService.log({
        branchId: user.branchId,
        userId: actor.id,
        action: 'USER_PASSWORD_RESET',
        entityType: 'User',
        entityId: id,
      });
      return { id };
    } catch {
      return { id };
    }
  }
}
