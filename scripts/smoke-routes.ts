// scripts/smoke-routes.ts
// Loads every page as each role against a running dev server and reports
// anything that does not render. Run with: npm run test:routes
// (start the app first with `npm run dev`).
import fs from 'node:fs';
import path from 'node:path';

// Read .env before anything that needs SESSION_SECRET or DATABASE_URL.
for (const line of fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const PAGES: Record<string, string[]> = {
  manager: [
    '/', '/pos', '/member-lookup', '/daily-sales', '/daily-sales?tab=cash', '/daily-sales?tab=vendors',
    '/products', '/inventory', '/members', '/analytics', '/dividends',
    '/reports', '/reports?tab=balance', '/reports?tab=cashflow', '/reports?tab=accounts', '/reports?tab=trial', '/reports?tab=journal',
    '/users', '/settings',
  ],
  cashier: ['/pos', '/member-lookup', '/daily-sales', '/daily-sales?tab=cash'],
  storekeeper: ['/inventory', '/products'],
  admin: ['/admin', '/admin/cooperative', '/admin/cooperative/1', '/admin/inventory', '/admin/users', '/admin/settings'],
};

/** Pages each role must be turned away from. */
const BLOCKED: Record<string, string[]> = {
  cashier: ['/', '/reports', '/inventory', '/members', '/admin'],
  storekeeper: ['/pos', '/reports', '/daily-sales', '/admin'],
  manager: ['/admin', '/admin/users'],
  admin: ['/', '/pos', '/reports'],
};

async function main() {
  const { default: prisma } = await import('../src/lib/prisma');
  const { createSessionToken, SESSION_COOKIE } = await import('../src/lib/auth');

  let failures = 0;
  const check = (ok: boolean, label: string, detail = '') => {
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  };

  const anonymous = await fetch(`${BASE}/pos`, { redirect: 'manual' });
  console.log('\nSigned out');
  check(anonymous.status >= 300 && anonymous.status < 400 && (anonymous.headers.get('location') ?? '').includes('/login'), '/pos redirects to /login');

  for (const username of Object.keys(PAGES)) {
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    const cookie = `${SESSION_COOKIE}=${createSessionToken(user.id, user.role)}`;
    console.log(`\n${username} (${user.role})`);

    for (const page of PAGES[username]) {
      const response = await fetch(`${BASE}${page}`, { headers: { cookie }, redirect: 'manual' });
      const html = response.status === 200 ? await response.text() : '';
      const broken = /Application error|__next_error__|Unhandled Runtime Error/.test(html);
      check(response.status === 200 && !broken, page, response.status === 200 ? (broken ? 'error page' : '') : `status ${response.status} -> ${response.headers.get('location') ?? ''}`);
    }

    for (const page of BLOCKED[username] ?? []) {
      const response = await fetch(`${BASE}${page}`, { headers: { cookie }, redirect: 'manual' });
      check(response.status >= 300 && response.status < 400, `${page} is blocked`, `status ${response.status}`);
    }
  }

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All pages render and access rules hold.' : `${failures} problem(s).`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
