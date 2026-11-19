// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, readSessionToken } from '@/lib/auth';
import { canAccess, homePathFor } from '@/lib/roles';

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// The exported function must be named `proxy` (or be the default export).
//
// This is the first gate only: it trusts the signed cookie for the role and
// never touches the database. Layouts and server actions re-check against the
// user row, so a deactivated account is still stopped there.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!token) {
    if (pathname === '/login') return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // The login page decides for itself: it redirects a valid session home, and
  // shows the form when the cookie belongs to a deactivated account.
  if (pathname === '/login') return NextResponse.next();

  if (!canAccess(token.role, pathname)) {
    return NextResponse.redirect(new URL(homePathFor(token.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static assets and metadata files, otherwise the redirect above
    // would also block CSS, JS and images from loading. logos/ holds the
    // public/ brand images, which the login page shows before sign-in.
    '/((?!_next/static|_next/image|logos/|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
