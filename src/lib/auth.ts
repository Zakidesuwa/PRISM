// src/lib/auth.ts
// Server-only: password hashing and the signed session cookie.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Role } from './roles';

export type { Role, SessionUser } from './roles';

export const SESSION_COOKIE = 'prism_session';
/** One shift. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production.');
  }
  return 'prism-development-only-secret';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export interface SessionToken {
  uid: string;
  role: Role;
  exp: number;
}

/** The cookie is `payload.signature`; a tampered payload fails verification. */
export function createSessionToken(uid: string, role: Role): string {
  const token: SessionToken = {
    uid,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(token)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(value: string | undefined): SessionToken | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const token = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionToken;
    if (!token.uid || !token.role || token.exp < Math.floor(Date.now() / 1000)) return null;
    return token;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const given = scryptSync(password, salt, expected.length);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
