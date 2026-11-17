@AGENTS.md

# PRISM — Project Memory

**PRISM** (Point-of-sale Reporting Inventory Sales Management) is a canteen / school-cooperative management system for the City Government of Olongapo. Currency is ₱ (PHP), timezone Asia/Manila.

## Current state (as of commit d5b6b5d)

- **Phase 1 UI prototype is done.** Most pages still render **hardcoded mock data from `src/data/*.ts`**.
- **Backend layer exists but no DB is connected yet:** Prisma schema, seed, services, and server actions are written. Only `/members` (`createMemberAction`) and the checkout action call the backend so far.
- **Auth is a prototype.** Demo users are hardcoded with plaintext passwords in `src/lib/auth.ts`; the `prism_session` cookie holds a bare, unsigned user id (8h maxAge). Not production-safe.
- README / IMPLEMENTATION_PLAN / TEAM_HANDOFF are partly stale (they say "Next.js 15" and "no backend"). Trust the code and `package.json`.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | **Next.js 16.2** (App Router, Turbopack) — see AGENTS.md warning |
| UI | React 19.2, TypeScript 5 (strict), **CSS Modules only — no Tailwind** |
| Font / icons | Inter via `next/font/google` (+ Google Fonts import in `globals.css`); custom inline Feather-style SVGs |
| DB | PostgreSQL 16 (`docker-compose.yml`, container `prism-postgres`) |
| ORM | Prisma 6.19 (`@prisma/client`, `prisma-client-js` generator) |
| Scripts | `tsx` for seed / verification scripts |
| Lint | ESLint 9 + `eslint-config-next` |
| Node | **>= 20.9.0** required |

Path alias: `@/*` → `./src/*`.

## Commands

```bash
npm run dev               # dev server :3000
npm run build             # STOP the dev server first — both write .next/ and corrupt each other
npm run lint
npx tsc --noEmit          # type-check
npx next typegen          # regenerate route types if stale
docker compose up -d      # local Postgres (DATABASE_URL in .env.example)
npx prisma migrate dev    # apply schema (no migrations committed yet)
npm run db:seed           # tsx prisma/seed.ts — WIPES all tables then reseeds
npm run test:pos-engine   # scripts/verify-pos-engine.ts — uses DB if reachable, else in-memory simulation
```

## File structure

```
PRISM/
├── prisma/
│   ├── schema.prisma          # User, SchoolBranch, CoopMember, Product, InventoryItem,
│   │                          # ProductIngredient (recipe), Transaction, TransactionItem, AuditLog
│   └── seed.ts                # users, 4 school branches, members, inventory, products, recipes
├── scripts/verify-pos-engine.ts
├── docker-compose.yml, .env.example
├── src/
│   ├── proxy.ts               # Route protection (Next 16's renamed middleware)
│   ├── app/
│   │   ├── layout.tsx         # Root: html/body, Inter font, <ToastProvider>
│   │   ├── globals.css        # Design tokens (--primary-blue, --gray-*, --radius-*, --shadow-*)
│   │   ├── login/             # LoginForm + page
│   │   ├── actions/auth.ts    # login / logout server actions (cookie set/delete)
│   │   ├── (app)/             # Route group (not in URL): signed-in user area
│   │   │   ├── layout.tsx     #   getSession → SessionProvider + Sidebar + Header shell
│   │   │   ├── page.tsx       #   / dashboard
│   │   │   └── analytics, dividends, inventory, members, pos, products, reports, settings, users
│   │   └── admin/             # ADMIN-only area with its own shell (AdminSidebar/AdminHeader)
│   │       ├── page.tsx, FinancialChart, TopPerformersCard
│   │       ├── cooperative/   #   school directory + [id] detail (charts, product table)
│   │       ├── inventory/, settings/
│   ├── actions/               # Domain server actions: checkoutAction.ts, memberActions.ts
│   ├── services/              # Business logic (static classes): TransactionService,
│   │                          # MemberService, AuditService
│   ├── lib/
│   │   ├── auth.ts            # Role type, DEMO_USERS, verifyCredentials, findUserById, SESSION_COOKIE
│   │   ├── session.ts         # getSession() (async cookies())
│   │   ├── authGuard.ts       # requireServerUser(), requireRole([...]) → Unauthorized/ForbiddenError
│   │   └── prisma.ts          # PrismaClient singleton (globalThis cache in dev)
│   ├── context/               # SessionContext (useSession, hasRole), ToastContext (useToast)
│   ├── components/            # Sidebar, Header (user side), AdminSidebar, AdminHeader, Toast css
│   ├── data/                  # Mock data (mockData, adminMockData, cooperative*, inventory*, settings*)
│   ├── utils/
│   │   ├── formatters.ts      # formatCurrency (₱, handles Decimal), formatManilaDate/DateTime/Time
│   │   └── response.ts        # ActionResponse<T>, actionSuccess(), actionError()
│   └── types/index.ts
```

Note: there are two action folders — `src/app/actions/` (auth only) and `src/actions/` (domain actions).

## Architecture conventions

- **Layering:** page/component → server action (`src/actions/*`, `'use server'`) → service (`src/services/*`) → Prisma.
- **Every server action** must: call `requireRole([...])` or `requireServerUser()` first, wrap in try/catch, return `actionSuccess` / `actionError` (never throw to the client), and `revalidatePath` affected routes.
- **Mutations write an `AuditLog`** via `AuditService.log(params, tx?)` — pass the `tx` client when inside `prisma.$transaction`.
- **Money uses `Prisma.Decimal`**, never JS floats. Round with `toDecimalPlaces(2, ROUND_HALF_UP)`. Inventory stock is `Decimal(10,3)`; product stock is `Int`.
- **Checkout (`TransactionService.processCheckout`)** runs in one `prisma.$transaction`: validate product stock → aggregate recipe ingredient needs → deduct `InventoryItem` stock (status → `Empty` at 0, `Low Stock` at ≤ 5) → decrement product stock → **5% tax** → credit member `accumulatedPatronage` (+ total; member must be `ACTIVE`) → create transaction `#1001+count` → audit `POS_CHECKOUT`. **Cash only.**
- Status fields are plain strings, not enums: inventory `Optimal | Low Stock | Empty`; member `ACTIVE | INACTIVE`; transaction `COMPLETED | VOIDED`; branch stockStatus `In Stock | Low Stock | Stock Out`.
- UI feedback via `useToast()` (`success/error/warning/info`). Client role checks via `useSession()`.
- Styling: one `page.module.css` per page / `Component.module.css` per component; use the CSS variables from `globals.css`.

## Net surplus distribution (`/dividends`)

- Engine: `src/lib/surplus/distribution.ts` — pure, no Prisma, runs on client and server. **Integer centavos + basis points** (the one deliberate exception to "money uses `Prisma.Decimal`", so it can run in the browser).
- Steps: statutory funds on net surplus (Reserve 10%, CETF 10%, CDF 3%, Optional 7%) → available surplus → Patronage Refund pool (30%) and Interest on Share Capital pool (remainder, 70%) → per-member pro-rata shares (patronage by `accumulatedPatronage`, interest by `shareCapital`) using largest-remainder rounding so shares sum exactly to the pool.
- Rates are editable on the page; out-of-range rates vs RA 9520 Art. 86 only produce warnings.
- `SurplusService` / `getDistributionMembersAction` (ADMIN/MANAGER) load members from the DB; the page falls back to `src/data/surplusMockData.ts` when the DB is unavailable.
- Tests: `npm run test:surplus-engine` (no DB needed).
- Not built yet: saving a finalized distribution / fund balances per fiscal year (needs new Prisma models).

## Auth & roles

- Roles: `ADMIN`, `MANAGER`, `CASHIER` (Prisma enum) plus legacy `USER` in `lib/auth.ts`, **treated as CASHIER** everywhere.
- `src/proxy.ts`: signed out → `/login`; signed in at `/login` → `homePath`; non-ADMIN on `/admin*` → `/`.
- Sidebar hides non-POS links for CASHIER/USER.
- Demo logins (`lib/auth.ts`): `admin/admin123` → `/admin`, `user/user123` → `/`, `cashier/cashier123` → `/pos`, `manager/manager123` → `/`.
- Checkout allowed for CASHIER/ADMIN/MANAGER; create/update member requires ADMIN/MANAGER.

## Gotchas — do not forget

- **Next.js 16 differences:** `middleware.ts` is now **`src/proxy.ts`** exporting `proxy` (a `middleware.ts` is silently ignored); `cookies()` is **async**; route `params` is a **Promise**. Read `node_modules/next/dist/docs/` before writing Next code.
- **`redirect()` throws** — keep it outside try/catch (see `app/actions/auth.ts`).
- **Mock/generated data must be deterministic** (seeded LCG, not `Math.random()`) to avoid hydration mismatches.
- **Derive, don't hardcode:** stat cards are computed from the rows they summarise; preserve that when wiring real data.
- **Demo-user ↔ seed mismatch:** `DEMO_USERS` ids are `admin`, `user`, `cashier`, `manager`, but `seed.ts` creates ids `admin`, `cashier` (username `user`), `manager`. Logging in as `user` (session id `user`) will fail checkout with "Cashier not found" once the DB is live. Reconcile when switching auth to the DB.
- `npm run db:seed` deletes all data first.
- Turbopack "Access is denied (os error 5)" → delete `.next/` (stale paths from another machine). Never share `.next/` or `node_modules/`.
- `transactionNumber` uses `count()` inside the transaction — can collide under concurrency; revisit later.

## Roadmap (remaining)

Connect DB and replace `src/data` mocks page by page → real auth (hashed passwords, signed sessions, DB users) → products/inventory CRUD, reorder alerts → reports (PDF/Excel), dividend engine (uses `accumulatedPatronage`, `shareCapital`) → users/settings pages.
