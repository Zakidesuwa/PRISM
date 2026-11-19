# PRISM — Team Handoff

For anyone joining or continuing work on PRISM: where the project stands,
how the code is organised, the rules that keep it working, and what is left
to build. Setup steps are in [SETUP.md](SETUP.md).

*Last updated: November 18, 2026.*

---

## 1. Where the project stands

PRISM is a working system, not a prototype. Every screen reads and writes
PostgreSQL; there is no mock data in the app.

- **One system, many cooperatives.** Each school cooperative has its own
  products, stock, members, sales and books. Staff only ever see their own
  cooperative. The administrator sees all of them.
- **One set of books per cooperative.** Sales, deliveries, spoilage, member
  payments, cash counts, vendor payouts and the surplus distribution all post
  double-entry journal entries automatically. The financial statements are
  computed from those entries, so they always match the counter.
- **Tested.** Five test suites cover the engine, the books of every
  cooperative and every page for every role (section 7).

The client asked us to **leave out the Z reading**. Daily Sales has a sales
reading for any day instead.

---

## 2. Who built what

| Contributor | Work | Main places in the code |
|---|---|---|
| Atashiwazakidaaaaaaaa | UI prototype from the Figma designs; first schema, core engine and members module | Page layouts and styles under `src/app/` |
| Richard De Ocampo Jr. | Database integration; POS, inventory, products, members, daily sales, reports, surplus distribution, users, settings, admin; UI/UX pass; merging the team's work | `prisma/`, `src/services/`, `src/actions/`, `src/app/` |
| Dench-Casaul | Daily Sales & Reconciliation and Financial Reports logic | `src/lib/dailySales/`, `src/lib/accounting/`, `scripts/verify-daily-sales.ts`, `scripts/verify-financial-reports.ts` |
| Jommel | Joined November 18; area to be decided. Status in [JOMMEL_HANDOFF.md](JOMMEL_HANDOFF.md) | Branch `feat/jommel` |

**About Dench's work.** It was built in a separate repository
(github.com/CasaulDench/Dench_Prism) on an early copy of the project, and
merged in on November 18. His three commits are kept in our history. His
calculation libraries now drive our financial statements and daily-sales
figures. His database layer and pages were not carried over: they were built
for a single cooperative and around the Z reading. They remain in his
commits for reference.

---

## 3. Logins and what each role sees

After `npm run db:seed`:

| Role | Login | Screens |
|---|---|---|
| Administrator | `admin` / `admin123` | Admin dashboard, cooperatives, district inventory, users, system settings |
| Manager | `manager` / `manager123` | Every store screen |
| Cashier | `cashier` / `cashier123` | Point of Sale, Member Lookup, Daily Sales (own sales and drawer only) |
| Store Keeper | `storekeeper` / `store123` | Inventory, Products |

The demo accounts above belong to Gordon College. The other four cooperatives
use `manager2`–`manager5`, `cashier2`–`cashier5`, `storekeeper2`–`storekeeper5`.

---

## 4. Where each module lives

Every store screen follows the same pattern:

`src/app/(app)/<route>/page.tsx` (loads data) → `<Route>Client.tsx` (the
screen) → `src/actions/*` (saves) → `src/services/*` (business rules) →
Prisma.

| Module | Route | Service | Actions |
|---|---|---|---|
| Point of Sale | `/pos` | `transactionService`, `productService` | `posActions` |
| Member Lookup | `/member-lookup` | `memberService` | `memberActions` |
| Daily Sales | `/daily-sales` | `salesService` (uses `lib/dailySales`) | `salesActions` |
| Inventory | `/inventory` | `inventoryService` | `inventoryActions` |
| Products | `/products` | `productService` | `inventoryActions` |
| Members | `/members` | `memberService` | `memberActions` |
| Financial Reports | `/reports` | `accountingService` (uses `lib/accounting`) | `accountingActions` |
| Dividends (surplus distribution) | `/dividends` | `surplusService` (uses `lib/surplus`) | `accountingActions` |
| Dashboard, Analytics | `/`, `/analytics` | `dashboardService` | — |
| Users, Settings | `/users`, `/settings` | `userService`, `branchService` | `adminActions` |
| Admin panel | `/admin/...` | `adminService`, `branchService`, `settingsService` | `adminActions` |

Database schema: `prisma/schema.prisma`. Access rules: `src/lib/roles.ts`.

---

## 5. Rules that keep the system correct

Please follow these. Most bugs would come from breaking one of them.

1. **Every query filters by the cooperative.** Take `branchId` from the
   signed-in user, never from the browser. Look records up with
   `findFirst({ where: { id, branchId } })`.
2. **Every save goes through `branchAction` (or `adminAction`)** in
   `src/lib/action.ts`. It checks the role, turns errors into a message for
   the user and refreshes the affected pages.
3. **Money is `Prisma.Decimal` in services**, never a JavaScript number.
   Convert to a number only when sending data to the screen.
4. **A save is one database transaction** that also posts its journal entry
   and an audit log entry. If one part fails, nothing is saved.
5. **Stock lives only on inventory items.** Products have no stock of their
   own; their availability comes from the inventory they use.
6. **Journal entries are never edited or deleted.** Corrections are posted as
   reversing entries.
7. **Business dates are Manila time.** Use the helpers in `src/lib/dates.ts`.
8. **Icons come from `lucide-react`.** Do not hand-write SVG icons.
9. **`'use client'` must be the first line** of a client component file.

`CLAUDE.md` has the full technical notes, including the accounting entries
each event posts.

---

## 6. Working with Git

- **Branch from `main`, open a pull request, merge when the tests pass.**
  Please work in this repository rather than a separate one. Work uploaded to
  a different repository has no shared history with ours and has to be merged
  by hand.
- **`main` was rewritten on November 18** to correct a commit email. If you
  pulled `main` that day, re-sync before doing anything else:

  ```bash
  git fetch origin
  git reset --hard origin/main   # discards local changes to main
  ```

- **Set your git email to the one on your GitHub account**, or your commits
  will not count for you on GitHub:

  ```bash
  git config --global user.email "you@example.com"
  ```

- **Schema changes:** `npx prisma db push` applies them. If a change would
  need the database wiped, write a small upgrade script instead (see
  `scripts/migrations/` for an example), so nobody loses their data.

---

## 7. Before you push

```bash
npx tsc --noEmit
npm run lint
npm run test:system            # 40 checks: engine end to end (uses a throwaway cooperative)
npm run test:financial-reports # 50 checks: statements + every cooperative's books balance
npm run test:daily-sales       # 16 checks
npm run test:surplus-engine    # 14 checks
npm run dev                    # then, in a second terminal:
npm run test:routes            # every page as every role
```

`test:system` creates its own temporary cooperative and deletes it after, so
it is safe to run on a database with data in it.

---

## 8. What is left to build

| Area | What is missing |
|---|---|
| Member payouts | Paying out patronage refunds and interest on share capital. The amounts owed are recorded; paying them is a manual journal entry today |
| Inventory | Physical stock counts and adjustments, purchase orders, a supplier balances screen |
| Members | A member's own login (members currently use the staff-operated Member Lookup) |
| Exports | PDF/Excel export (printing to PDF works) |
| Settings | Currency, service charge, "prices include tax", hardware and receipt layout options are saved but not yet used |
| Layout | Small screens and tablets: the sidebar does not collapse yet |
| Dark mode | Not built |
| Engineering | Prisma migration files (schema is applied with `db push`), automated browser tests |

---

## 9. Known gotchas

- **Docker Desktop must be running**, or the app says it cannot reach the
  database.
- **Stop `npm run dev` before `npm run build` or `npx prisma generate`.** On
  Windows they fight over the same files.
- **`npm run db:seed` wipes every table** before reseeding.
- **This is Next.js 16.** Middleware is now `src/proxy.ts`; `cookies()`,
  `params` and `searchParams` are async. The bundled docs in
  `node_modules/next/dist/docs/` are the reference.
