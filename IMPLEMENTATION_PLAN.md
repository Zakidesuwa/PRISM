# PRISM Implementation Plan

> Last updated: July 22, 2026

---

## 1. Project Overview

**PRISM** (Point-of-sale Reporting Inventory Sales Management) is a web-based canteen management system for the City Government of Olongapo. The system will handle the full lifecycle of canteen operations: product management, inventory tracking, point-of-sale transactions, financial analytics, and reporting.

---

## 2. What We Are Doing (Current Phase)

### Phase 1: UI Prototype (✅ COMPLETE)

We are converting the **Figma design mockups** into a working, navigable web prototype using Next.js. This phase focuses purely on the frontend — all data is hardcoded, and no backend or database is connected.

**Completed pages:**

| Page | Description |
|------|-------------|
| **Dashboard** | Weekly sales chart, quick stats (today's sales, active orders, low stock), popular items, recent transactions |
| **Products** | Product catalog table with name, SKU, category, price, stock level badges, search & filter toolbar |
| **Inventory** | Raw materials table with supplier info, delivery schedules, stock status indicators (Low Stock/Optimal/Empty) |
| **Point of Sale** | POS interface with category tabs, product grid, order builder panel, subtotal/tax/total calculation |
| **Profit Analytics** | KPI cards (revenue, profit, orders), revenue trend chart, top selling items |
| **Placeholder Pages** | Dividends, Reports, Users, Settings (marked "Coming Soon") |

---

## 3. What We Are Going To Do (Future Phases)

### Phase 2: Backend & Database
- Set up a PostgreSQL database (or Supabase) for persistent data storage
- Create API routes in Next.js for CRUD operations
- Connect all pages to real data instead of mock data
- Implement data validation and error handling

### Phase 3: Authentication & Authorization
- Build login/logout functionality
- Implement role-based access control:
  - **Admin** — Full access to all modules
  - **Manager** — Access to products, inventory, analytics, reports
  - **Cashier** — Access to POS only
- Session management and security

### Phase 4: Core Functionality
- **POS**: Real-time order processing, receipt printing, payment methods
- **Inventory**: Stock level tracking, automatic low-stock alerts, reorder management
- **Products**: Add, edit, delete products with image upload
- **Analytics**: Real-time data aggregation, date range filters

### Phase 5: Advanced Features
- Report generation (PDF, Excel export)
- Dividend calculation and distribution
- User activity logs and audit trails
- Data backup and recovery
- Mobile-responsive optimization

---

## 4. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend Framework | Next.js 15 (App Router) | Server-side rendering, file-based routing, API routes |
| Language | TypeScript | Type safety for production reliability |
| UI | React 19 + CSS Modules | Component-based UI with scoped styles |
| Font | Inter (Google Fonts) | Clean, professional typography |
| Backend (future) | Next.js API Routes | Keep everything in one project |
| Database (future) | PostgreSQL / Supabase | Reliable, scalable relational database |
| Auth (future) | NextAuth.js / Supabase Auth | Secure authentication |
| Deployment (future) | Vercel | Optimized for Next.js |

---

## 5. File Structure

```
prism/
├── src/
│   ├── app/                   # Pages (Next.js App Router)
│   │   ├── layout.tsx         # Root layout with sidebar + header
│   │   ├── page.tsx           # Dashboard
│   │   ├── products/          # Product management
│   │   ├── inventory/         # Inventory tracking
│   │   ├── pos/               # Point of Sale
│   │   ├── analytics/         # Profit Analytics
│   │   └── ...                # Other pages
│   ├── components/            # Reusable UI components
│   ├── data/                  # Mock data (will be replaced by API calls)
│   └── types/                 # TypeScript type definitions
├── public/                    # Static assets (images, icons)
├── package.json
└── README.md
```

---

## 6. How to Contribute

1. Clone the repository
2. Create a new branch for your feature: `git checkout -b feature/your-feature`
3. Make your changes
4. Test locally with `npm run dev`
5. Push and create a Pull Request

### Branch Naming Convention
- `feature/xxx` — New features
- `fix/xxx` — Bug fixes
- `ui/xxx` — UI/styling changes
- `docs/xxx` — Documentation updates

---

## 7. Timeline (Tentative)

| Phase | Target |
|-------|--------|
| Phase 1: UI Prototype | ✅ Done |
| Phase 2: Backend & Database | TBD |
| Phase 3: Authentication | TBD |
| Phase 4: Core Functionality | TBD |
| Phase 5: Advanced Features | TBD |

---

*This document will be updated as the project progresses.*
