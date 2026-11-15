// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, findUserById } from '@/lib/auth';

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// The exported function must be named `proxy` (or be the default export).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = findUserById(request.cookies.get(SESSION_COOKIE)?.value);

  // Signed out: everything except /login bounces to the login screen.
  if (!user) {
    if (pathname === '/login') {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Signed in: /login is pointless, send them to their home.
  if (pathname === '/login') {
    return NextResponse.redirect(new URL(user.homePath, request.url));
  }

  // Admins own /admin; non-admins (cashiers/managers) are kept out of /admin.
  if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static assets and metadata files, otherwise the redirect above
    // would also block CSS, JS and images from loading.
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
