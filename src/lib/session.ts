// src/lib/session.ts
import { cache } from 'react';
import { cookies } from 'next/headers';
import prisma from './prisma';
import { SESSION_COOKIE, readSessionToken } from './auth';
import { homePathFor, type SessionUser } from './roles';

/**
 * Reads the signed-in user. The cookie only proves identity; the user row is
 * re-read so a deactivated account or a changed role takes effect immediately.
 * Cached per request. `cookies()` is async in Next.js 16.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!token) return null;

  const user = await prisma.user.findUnique({
    where: { id: token.uid },
    include: { branch: { select: { name: true, isActive: true } } },
  });

  if (!user || !user.isActive) return null;
  if (user.branch && !user.branch.isActive) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    branchName: user.branch?.name ?? null,
    homePath: homePathFor(user.role),
  };
});
