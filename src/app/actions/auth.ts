'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, verifyPassword } from '@/lib/auth';
import { homePathFor } from '@/lib/roles';
import { AuditService } from '@/services/auditService';

export interface LoginState {
  error?: string;
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: 'Please enter both a username and a password.' };
  }

  let user;
  let offlineDemo = !process.env.DATABASE_URL;
  if (!offlineDemo) {
    try {
      user = await prisma.user.findUnique({ where: { username }, include: { branch: true } });
    } catch {
      offlineDemo = true;
    }
  }

  if (offlineDemo) {
    const demoAccounts: Record<string, { role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOREKEEPER'; password: string }> = {
      manager: { role: 'MANAGER', password: 'manager123' },
      cashier: { role: 'CASHIER', password: 'cashier123' },
      admin: { role: 'ADMIN', password: 'admin123' },
      storekeeper: { role: 'STOREKEEPER', password: 'store123' },
    };
    const demo = demoAccounts[username];
    if (demo && demo.password === password) {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, createSessionToken(username, demo.role), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
      redirect(homePathFor(demo.role));
    }
    return { error: 'Incorrect username or password (offline demo accounts: manager/manager123, cashier/cashier123, admin/admin123).' };
  }

  // Same message for an unknown user and a wrong password.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: 'Incorrect username or password.' };
  }
  if (!user.isActive || (user.branch && !user.branch.isActive)) {
    return { error: 'This account has been deactivated.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(user.id, user.role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  await AuditService.log({ branchId: user.branchId, userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id });

  // redirect() throws to unwind — it must stay outside any try/catch.
  redirect(homePathFor(user.role));
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
