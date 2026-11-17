# PRISM — Setup & Run Guide

How to get the PRISM Management System running on your machine.

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | **20.9.0 or newer** | Next.js 16 will not run on Node 18 |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent | Runs the PostgreSQL database. Any other PostgreSQL works too. |
| Git | any recent | To clone the repo |

## 2. Install

```bash
git clone https://github.com/Richard-JR10/PRISM.git
cd PRISM
npm install
npx prisma generate
```

`npx prisma generate` is needed because npm may skip the packages' install scripts.

## 3. Database

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
docker compose up -d        # starts PostgreSQL on port 5432 (Docker Desktop must be running)
npx prisma db push          # creates the tables
npm run db:seed             # demo cooperatives, users, catalog and ~6 weeks of history
```

Set `SESSION_SECRET` in `.env` to a long random value.

`npm run db:seed` **wipes every table first**. It takes about two minutes, because
the demo history is produced by running real deliveries, sales and cash counts
through the app's own services. Use `npm run db:seed -- --minimal` for the
cooperatives, users and catalog with no history.

## 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

### Demo logins (created by the seed)

| Role | Username | Password | Lands on | Can open |
|---|---|---|---|---|
| Administrator | `admin` | `admin123` | `/admin` | The district admin panel only |
| Manager | `manager` | `manager123` | `/` | Every store screen |
| Cashier | `cashier` | `cashier123` | `/pos` | POS, Member Lookup, Daily Sales (own) |
| Store Keeper | `storekeeper` | `store123` | `/inventory` | Inventory, Products |

Those three store accounts belong to **Gordon College**. The other four
cooperatives have `manager2`…`manager5`, `cashier2`…, `storekeeper2`… with the
same passwords. Change these passwords before real use.

## 5. Screens

### Store (per cooperative)

| Route | Screen | Roles |
|---|---|---|
| `/` | Dashboard | Manager |
| `/pos` | Point of Sale: cash, GCash and charge-to-member payments, receipts, voids | Cashier, Manager |
| `/member-lookup` | Scan a member ID: balance, credit, patronage, ledger | Cashier, Manager |
| `/daily-sales` | Sales reading, cash over/short, vendor split | Cashier (own), Manager |
| `/inventory` | Stock, receive deliveries, log spoilage, reorder thresholds | Store Keeper, Manager |
| `/products` | Products and the inventory each one uses | Store Keeper, Manager |
| `/members` | Members, share capital, payments on account | Manager |
| `/analytics` | Revenue, net surplus, top sellers | Manager |
| `/reports` | Income statement, balance sheet, cash flow, chart of accounts, journal | Manager |
| `/dividends` | Net surplus distribution: Reserve Fund, CETF, CDF, patronage refund | Manager |
| `/users`, `/settings` | Staff accounts; store profile and activity log | Manager |

### Admin (district)

`/admin` dashboard, `/admin/cooperative` directory and per-school detail,
`/admin/inventory`, `/admin/users`, `/admin/settings`.

## 6. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build — **stop the dev server first** |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run db:seed` | Wipe and reseed the database |
| `npm run test:system` | 34 end-to-end checks of the core engine against the database |
| `npm run test:surplus-engine` | 14 checks of the surplus distribution math (no database) |
| `npm run test:routes` | Loads every page as every role (needs `npm run dev` running) |

`test:system` works inside a throwaway cooperative and removes it afterwards,
so it is safe to run on a database that has data.

## 7. Troubleshooting

- **"Cannot reach the database"** — Docker Desktop is not running, or the
  container is stopped: `docker compose up -d`.
- **`prisma generate` fails with EPERM on Windows** — the dev server is holding
  the database client. Stop `npm run dev`, generate, then start it again.
- **Turbopack "Access is denied (os error 5)"** — delete `.next/` and restart.
- **Build fails with "Jest worker" errors** — the dev server was still running.
- **"Port 3000 is in use"** — an old dev server is alive; kill that process.
- **Stale route types** — `npx next typegen`.
- **`middleware.ts` does nothing** — Next.js 16 renamed it to `src/proxy.ts`.

## 8. Before real use

- Change every seeded password and set a real `SESSION_SECRET`.
- Schema changes are applied with `prisma db push`; there are no migration
  files yet. Switch to `prisma migrate` before the data matters.
- The demo history is seeded sample data. Run `npm run db:seed -- --minimal`
  for a clean start.
