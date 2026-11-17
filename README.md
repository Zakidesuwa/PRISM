# PRISM Management System

> **P**oint-of-sale **R**eporting **I**nventory **S**ales **M**anagement — a management system for school cooperatives under the City Government of Olongapo.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)

## Overview

Each school cooperative runs its own store in PRISM: a cashier sells at the
point of sale, a store keeper manages stock, and a manager sees the daily
sales, the financial statements and the year-end surplus distribution. The
Cooperative Development Office oversees every cooperative from an admin panel.

All data lives in PostgreSQL. Nothing on screen is mock data.

## Modules

| Module | What it does |
|---|---|
| **Cashier / POS** | Fast sales entry, cash (with change), GCash and charge-to-member payments, receipts, voids |
| **Inventory** | Receive deliveries, log spoilage and waste, reorder thresholds, low-stock alerts; sales deduct stock automatically, including recipe ingredients |
| **Members** | Member records, ID lookup, charge balance and credit limit, share capital, patronage |
| **Daily Sales** | Sales reading, cash over/short per drawer, vendor (consignment) split and payouts |
| **Financial Reports** | Income statement, balance sheet, cash flow statement, chart of accounts, journal |
| **Net Surplus Distribution** | Reserve Fund, CETF, CDF, Optional Fund, patronage refund, interest on share capital |
| **Admin** | District dashboard, cooperative directory and detail, district inventory, users, settings |

Every module posts to one double-entry ledger, so the statements are computed
from the same records the cashier and store keeper create.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL 16 (Docker), Prisma 6 |
| Styling | CSS Modules |
| Auth | Hashed passwords (scrypt), signed session cookie, role-based access |

## Getting Started

Full instructions: **[SETUP.md](SETUP.md)**.

```bash
npm install
npx prisma generate
cp .env.example .env
docker compose up -d
npx prisma db push
npm run db:seed
npm run dev
```

Then open <http://localhost:3000>.

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Cashier | `cashier` | `cashier123` |
| Store Keeper | `storekeeper` | `store123` |

## Tests

```bash
npm run test:system          # core engine against the database
npm run test:surplus-engine  # surplus distribution math
npm run test:routes          # every page as every role (app must be running)
```

---

*Built for the City Government of Olongapo — Cooperative Development Office*
