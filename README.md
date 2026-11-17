# PRISM Management System

> **P**oint-of-sale **R**eporting **I**nventory **S**ales **M**anagement — a management system for school cooperatives under the City Government of Olongapo, Cooperative Development Office.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)

## Overview

Each school cooperative runs its own store in PRISM:

- a **cashier** sells at the point of sale,
- a **store keeper** receives deliveries and watches stock,
- a **manager** runs the store and sees daily sales, the financial
  statements and the year-end surplus distribution,
- the **administrator** at the Cooperative Development Office oversees every
  cooperative from an admin panel.

All data lives in PostgreSQL, and every cooperative's records are kept
separate. Every sale, delivery and payment posts to a double-entry ledger, so
the financial statements always agree with what happened at the counter.

## Modules

| Module | What it does |
|---|---|
| **Point of Sale** | Fast sales entry with barcode scanning and keyboard shortcuts; cash (with change), GCash and charge-to-member payments; receipts; voids |
| **Inventory** | Receive deliveries, log spoilage and waste, reorder thresholds, low-stock alerts. Sales deduct stock automatically, including recipe ingredients |
| **Products** | Catalog and prices; each product lists the inventory it uses, so availability and cost are always current |
| **Members** | Member records, ID lookup, charge balance and credit limit, share capital, payments, patronage |
| **Daily Sales** | Sales reading (totals, average sale, member vs walk-in, sales by hour); cash over/short per drawer, counted by bill and coin; vendor (consignment) split and payouts |
| **Financial Reports** | Income statement, balance sheet, cash flow statement, trial balance, chart of accounts, general journal with manual entries and reversals |
| **Net Surplus Distribution** | Reserve Fund, CETF, CDF, Optional Fund, patronage refund and interest on share capital, posted to the books when finalized |
| **Admin** | District dashboard, cooperative directory and per-school detail, district inventory, user accounts, system settings |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL 16 (Docker), Prisma 6 |
| Styling | CSS Modules, Lucide icons |
| Auth | Hashed passwords (scrypt), signed session cookie, role-based access |

## Getting Started

Full instructions and troubleshooting: **[SETUP.md](SETUP.md)**.

```bash
npm install
npx prisma generate
cp .env.example .env        # then set SESSION_SECRET
docker compose up -d        # Docker Desktop must be running
npx prisma db push
npm run db:seed             # demo cooperatives and about six weeks of history
npm run dev
```

Then open <http://localhost:3000>.

| Role | Username | Password | Opens on |
|---|---|---|---|
| Administrator | `admin` | `admin123` | Admin panel |
| Manager | `manager` | `manager123` | Dashboard (every store screen) |
| Cashier | `cashier` | `cashier123` | Point of Sale |
| Store Keeper | `storekeeper` | `store123` | Inventory |

These store accounts belong to Gordon College. The other demo cooperatives
use `manager2`–`manager5`, `cashier2`–`cashier5` and so on, with the same
passwords. Change all of them before real use.

## Tests

```bash
npm run test:system            # core engine, end to end, against the database
npm run test:financial-reports # statements, plus checks that every cooperative's books balance
npm run test:daily-sales       # daily-sales calculations
npm run test:surplus-engine    # surplus distribution math
npm run test:routes            # every page as every role (app must be running)
```

## Team

| Contributor | Work |
|---|---|
| Atashiwazakidaaaaaaaa | UI prototype from the Figma designs; first database schema, core engine and members module |
| Richard De Ocampo Jr. | Database integration and every module end to end; net surplus distribution; UI/UX pass; merging the team's work |
| Dench-Casaul | Daily Sales & Reconciliation and Financial Reports logic (`src/lib/dailySales`, `src/lib/accounting`) |

New to the project? Read **[TEAM_HANDOFF.md](TEAM_HANDOFF.md)** first.

---

*Built for the City Government of Olongapo — Cooperative Development Office*
