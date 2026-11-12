# 🏛️ PRISM Management System

> **P**oint-of-sale **R**eporting **I**nventory **S**ales **M**anagement — A canteen management system for the City Government of Olongapo.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Overview

PRISM is a web-based canteen management system designed for government canteen operations. It provides tools for managing products, tracking inventory, processing point-of-sale transactions, and analyzing financial performance.

### Current Status: **🟡 UI Prototype**

This is currently a **frontend-only prototype** that brings the Figma designs to life. No backend or database is connected yet — all data is hardcoded mock data.

---

## ✨ Features

| Module | Status | Description |
|--------|--------|-------------|
| 📊 **Dashboard** | ✅ Complete | Weekly sales trends, quick stats, popular items, recent transactions |
| 📦 **Products** | ✅ Complete | Product catalog with SKU, pricing, stock levels, search & filter |
| 🗃️ **Inventory** | ✅ Complete | Raw materials tracking, suppliers, delivery schedules, stock status |
| 💳 **Point of Sale** | ✅ Complete | POS interface with category filters, order builder, tax calculation |
| 📈 **Profit Analytics** | ✅ Complete | Revenue/profit KPIs, trend charts, top selling items |
| 💰 Dividends | 🔲 Coming Soon | Dividend management and distribution |
| 📄 Reports | 🔲 Coming Soon | Downloadable reports and summaries |
| 👥 Users | 🔲 Coming Soon | User management and roles |
| ⚙️ Settings | 🔲 Coming Soon | System configuration |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **UI Library** | [React 19](https://react.dev/) |
| **Styling** | CSS Modules |
| **Font** | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| **Currency** | ₱ Philippine Peso |

---

## 🚀 Getting Started

> 📖 **Full instructions, troubleshooting and project structure: [SETUP.md](SETUP.md)**

### Prerequisites

- [Node.js](https://nodejs.org/) **v20.9.0 or higher** — Next.js 16 will not run on v18
- [npm](https://www.npmjs.com/) (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/Richard-JR10/PRISM.git
cd PRISM

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo logins

The app opens on a login screen. Both accounts are also shown on the login card:

| Role | Username | Password | Lands on |
|------|----------|----------|----------|
| Admin | `admin` | `admin123` | `/admin` — admin panel |
| User | `user` | `user123` | `/` — dashboard & POS |

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 📁 Project Structure

```
prism/
├── public/                    # Static assets
├── src/
│   ├── proxy.ts               # Route protection (Next 16's renamed middleware)
│   ├── app/
│   │   ├── layout.tsx         # Root layout — html/body only
│   │   ├── globals.css        # Design system & global styles
│   │   ├── login/             # Login screen
│   │   ├── actions/           # Server actions (login / logout)
│   │   ├── (app)/             # Signed-in user area (sidebar + header shell)
│   │   └── admin/             # Admin area (its own shell)
│   ├── components/            # Sidebar, Header, AdminSidebar, AdminHeader
│   ├── data/                  # All mock/seed data
│   ├── lib/                   # Demo users & session helpers
│   └── types/
├── package.json
├── tsconfig.json
└── next.config.ts
```

`(app)` is a **route group** — the parentheses keep it out of the URL, so
`src/app/(app)/pos/page.tsx` still serves `/pos`.

See [SETUP.md](SETUP.md) for the full tree.

---

## 🗺️ Implementation Roadmap

### Phase 1: UI Prototype ✅ (Current)
- [x] Figma-to-code conversion for all 5 main pages
- [x] Responsive sidebar navigation
- [x] Mock data for all modules
- [x] Placeholder pages for upcoming features

### Phase 2: Backend Integration (Upcoming)
- [ ] Database setup (PostgreSQL / Supabase)
- [ ] API routes for CRUD operations
- [ ] Real data persistence

### Phase 3: Authentication & Roles
- [ ] Login / Logout functionality
- [ ] Role-based access (Admin, Manager, Cashier)
- [ ] Session management

### Phase 4: Advanced Features
- [ ] Real-time POS transaction processing
- [ ] Inventory auto-reorder alerts
- [ ] Report generation (PDF/Excel)
- [ ] Dividend calculation engine

---

## 👥 Team

| Name | Role |
|------|------|
| TBD  | Project Lead |
| TBD  | Frontend Developer |
| TBD  | Backend Developer |
| TBD  | UI/UX Designer |

---

## 📝 License

This project is licensed under the MIT License.

---

*Built for the City Government of Olongapo Canteen Management*
"# PRIsm" 
