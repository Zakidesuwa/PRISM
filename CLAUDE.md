@AGENTS.md

# PRISM — Project Memory

**PRISM** (Point-of-sale Reporting Inventory Sales Management) is a management system for school cooperatives under the City Government of Olongapo (Cooperative Development Office). Currency is ₱ (PHP), timezone Asia/Manila.

## Current state

- **Fully database-backed.** No mock data anywhere; `src/data/` and `src/types/` were removed.
- **Multi-tenant:** every operational table has a `branchId`. A `SchoolBranch` is one cooperative with its own catalog, stock, members, sales and ledger. ADMIN has no branch.
- Modules built: POS, inventory, products, members + member lookup, daily sales (sales reading, cash over/short, vendor split), financial reports, net surplus distribution, users, settings, district admin panel.
- `IMPLEMENTATION_PLAN.md` and `TEAM_HANDOFF.md` are **old planning docs and are out of date**. Trust the code, `README.md` and `SETUP.md`.
- The client's "Z reading" was deliberately left out (their request). The sales reading is a read-only daily summary.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | **Next.js 16.2** (App Router, Turbopack) — see AGENTS.md warning |
| UI | React 19.2, TypeScript 5 (strict), **CSS Modules only — no Tailwind** |
| DB | PostgreSQL 16 in Docker (`docker-compose.yml`, container `prism-postgres`) |
| ORM | Prisma 6.19. Schema applied with `prisma db push` (no migration files yet) |
| Auth | scrypt password hashes, HMAC-signed session cookie (`node:crypto`), no auth library |
| Scripts | `tsx` for seed and tests |
| Node | **>= 20.9.0** |

Path alias: `@/*` → `./src/*`. Env: `DATABASE_URL`, `SESSION_SECRET` (see `.env.example`).

## Commands

```bash
npm run dev                  # dev server :3000
npm run build                # STOP the dev server first
npm run lint && npx tsc --noEmit
docker compose up -d         # Postgres (Docker Desktop must be running)
npx prisma db push           # apply schema
npx prisma generate          # STOP the dev server first on Windows (file lock -> EPERM)
npm run db:seed              # WIPES everything, reseeds (~2 min). `-- --minimal` skips demo history
npm run test:system          # 34 end-to-end checks against the DB (uses a throwaway branch)
npm run test:surplus-engine  # 14 checks, no DB
npm run test:routes          # every page as every role; needs the dev server running
```

Seeded logins: `admin/admin123`, `manager/manager123`, `cashier/cashier123`, `storekeeper/store123` (Gordon College); other branches use `manager2`..`manager5` etc.

## File structure

```
prisma/schema.prisma        # 20 models; see header comment
prisma/seed.ts              # runs the real services day by day to build consistent history
scripts/                    # verify-system.ts, verify-surplus-engine.ts, smoke-routes.ts
src/
├── proxy.ts                # Route gate (Next 16's renamed middleware); role from signed cookie, no DB
├── app/
│   ├── layout.tsx, globals.css (design tokens + .print-area print rule)
│   ├── login/, actions/auth.ts
│   ├── (app)/              # Store area. Each route: page.tsx (server, fetches) + XClient.tsx
│   │   ├── page.tsx (dashboard), pos, member-lookup, daily-sales, inventory, products,
│   │   └── members, analytics, reports, dividends, users, settings
│   └── admin/              # ADMIN only: dashboard, cooperative (+[id]), inventory, users, settings
├── actions/                # Server actions, thin: posActions, inventoryActions, memberActions,
│                           # salesActions, accountingActions, adminActions
├── services/               # All business logic (static classes), each call takes a Ctx
│   ├── context.ts          #   Ctx { branchId, userId, at? }
│   ├── accountingService   #   ledger: postEntry, statements, chart of accounts
│   ├── transactionService  #   checkout + void
│   ├── inventoryService, productService, memberService, salesService,
│   └── surplusService, dashboardService, adminService, branchService, userService,
│       settingsService, auditService
├── lib/
│   ├── roles.ts            # Role, SessionUser, ROUTE_ROLES, canAccess — pure, client-safe
│   ├── auth.ts             # SERVER ONLY: hashing, session token
│   ├── session.ts, authGuard.ts (requireBranchUser), action.ts (branchAction/adminAction)
│   ├── dates.ts            # Manila business dates and [from, to) ranges
│   ├── money.ts            # Decimal helpers + input validation
│   ├── settings.ts, adminTypes.ts, useAction.ts (client hook), surplus/distribution.ts
├── components/             # Sidebar, Header, AdminSidebar, AdminHeader, Modal, UsersManager, MemberProfile
├── context/                # SessionContext, ToastContext
├── styles/ui.module.css    # Shared UI kit for the newer screens
└── utils/                  # formatters.ts, response.ts
```

## Architecture rules

- **Layering:** `page.tsx` (server component) calls services directly to read. Client components mutate through server actions → services → Prisma.
- **Every server action** goes through `branchAction(roles, fn, { revalidate, message })` or `adminAction` in `src/lib/action.ts`. That does the role check, error → `ActionResponse`, and `revalidatePath`. Client side uses `useAction()` (toast + `router.refresh()`).
- **Every query filters by `branchId`** taken from the session, never from the client. Services look records up with `findFirst({ id, branchId })`.
- **Money is `Prisma.Decimal`** in services; convert to `number` only in the DTO returned to the client (`num()`). Exception: `lib/surplus/distribution.ts` uses integer centavos so it can run in the browser.
- **Mutations are one `prisma.$transaction`** that also posts the ledger entry and an `AuditLog`.
- **Stock lives only on `InventoryItem`.** A `Product` has no stock column: availability and cost are derived from its `ProductIngredient` rows (one item ×1 for resale goods, several for a recipe). Stock decrements are atomic `update({ decrement })` followed by a `< 0` check.
- **Transaction numbers** come from `SchoolBranch.nextTransactionSeq` incremented inside the sale's transaction (row lock → no duplicates).
- Status fields are plain strings: transaction `COMPLETED | VOIDED`; member `ACTIVE | INACTIVE`; payment `CASH | CHARGE | GCASH`.
- Styling: existing Figma-derived pages keep their own `page.module.css`; new screens use `@/styles/ui.module.css`.
- **Icons: `lucide-react` only** (pinned 1.67.0), `size` 16–20, `aria-hidden="true"` unless the icon is the only label. No hand-written `<svg>` icons; the only inline SVGs are the two admin data charts.
- **UI tokens** in `globals.css`: `--color-*` semantic colours, `--duration-*`/`--ease-out` motion, `--z-*` layers, `--focus-ring`. Global `:focus-visible` ring and `prefers-reduced-motion` are set there; do not remove focus outlines.
- Shared UI pieces: `Modal` (Escape, focus trap, scroll lock, close button), `EmptyState`, `PageSkeleton` (used by `loading.tsx`). Sidebar links are grouped; add new store routes to `NAV_GROUPS` and `ROUTE_ROLES`.
- POS keyboard shortcuts: `/` or F2 search, F4 member, F9 pay; Enter in search adds an exact SKU (barcode scanner).

## Accounting

Double-entry ledger per branch (`Account`, `JournalEntry`, `JournalLine`). Default chart in `DEFAULT_ACCOUNTS`; codes in `ACCOUNT`. Statements are computed from posted lines only.

| Event | Debit | Credit |
|---|---|---|
| Sale | Cash / E-wallet / AR-Members | Sales, Tax Payable; for consigned items: Due to Consignors + Commission Income |
| Cost of goods (separate entry) | COGS | Inventory |
| Delivery | Inventory | Cash or AP |
| Spoilage | Spoilage expense | Inventory |
| Member payment | Cash | AR-Members |
| Share capital | Cash | Share Capital |
| Cash over / short | Cash / Cash Shortage | Other Income / Cash |
| Vendor payout | Due to Consignors | Cash |
| Surplus distribution | 3900 Net Surplus Distributed | funds 3100–3130, payables 2100/2110 |

- **Entries that touch a cash account must contain only cash-related lines** — the cash flow statement explains each cash entry by its other lines. That is why COGS is a separate entry.
- Revenue/expense accounts are never closed. The balance sheet shows "Net Surplus Earned to Date" computed, offset by account 3900.
- Voids and reopened cash counts post mirror-image reversing entries (`reverseEntries`).
- Tax rate comes from system settings (default 5%, added on top of prices).

## Auth & roles

- Roles: `ADMIN`, `MANAGER`, `CASHIER`, `STOREKEEPER`. Access table: `ROUTE_ROLES` in `lib/roles.ts`, used by both `proxy.ts` and the sidebar.
- Cookie `prism_session` = `base64url(payload).hmac`, 8 hours. `proxy.ts` trusts it for the role only; `getSession()` re-reads the user row, so deactivation takes effect immediately.
- A cashier can only read their own sales and count their own drawer. Voids need MANAGER unless the admin turns off "manager override".

## Gotchas — do not forget

- **Next.js 16:** `middleware.ts` → `src/proxy.ts` (Node runtime); `cookies()`, `params` and `searchParams` are async. Read `node_modules/next/dist/docs/` before writing Next code.
- **`redirect()` throws** — keep it outside try/catch.
- Never import `lib/auth.ts` or a service into a client component except as `import type`. Use `lib/roles.ts` for shared constants.
- `'use server'` files may only export async functions (types are fine).
- `'use client'` must be the very first line. Scripted edits that prepend imports have broken this before (files here use CRLF line endings).
- React Compiler lint: do not put try/catch or object mutation inside `useMemo`; extract a plain function.
- Raw SQL date grouping uses `"createdAt" + interval '8 hours'` (columns are UTC without time zone).
- Avoid `Math.random()`/`Date.now()` in render paths (hydration).
- Running big shell heredocs through the Bash tool has failed here; write files with the Write tool.

## Not built yet

- Paying out patronage refunds / interest to members (the payables exist; use a manual journal entry).
- Physical stock count adjustments, purchase orders, supplier payables screen.
- Per-member login (members use the staff-operated Member Lookup).
- Prisma migrations, automated browser tests, PDF/Excel export (print to PDF works).
