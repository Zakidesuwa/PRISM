import { cookies } from 'next/headers';
import { SESSION_COOKIE, findUserById, type SessionUser } from './auth';

/**
 * Reads the current user from the session cookie.
 * Returns null when signed out. `cookies()` is async in Next.js 16.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return findUserById(cookieStore.get(SESSION_COOKIE)?.value);
}
