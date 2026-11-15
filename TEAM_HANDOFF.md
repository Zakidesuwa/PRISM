# PRISM Management System: Team Handoff & AI Prompts

Welcome to the PRISM project! This document outlines what has been built so far, recommendations for the database, and provides copy-paste prompts for your teammates to use with their AI coding assistants (like Cursor, Copilot, or ChatGPT) to build out the remaining features.

---

## 1. What We Built (Phase 1: UI Prototype)

This repository contains a **frontend-only prototype** of the PRISM Management System based on the Figma mockups. It brings the designs to life using mock data. No real database is connected yet.

**Key Pages Created:**
*   **Dashboard** (`/`) - Shows weekly sales, quick stats, popular items, and recent transactions.
*   **Products** (`/products`) - Product catalog with stock badges and category tags.
*   **Inventory** (`/inventory`) - Tracks raw materials, suppliers, and stock status (Optimal/Low/Empty).
*   **Point of Sale (POS)** (`/pos`) - Interactive category tabs, product grid, and an order builder panel.
*   **Profit Analytics** (`/analytics`) - KPI cards and revenue trend charts.
*   **Placeholder Pages** - Dividends, Reports, Users, and Settings are set up with a "Coming Soon" state.

### 🔐 User vs. Admin Modes
The current prototype shows the **Admin/Manager view**, where all modules (Inventory, Products, Analytics, Users) are visible in the sidebar. 

When you move to production, you must implement **Role-Based Access Control (RBAC)**:
*   **Admin / Manager:** Full access to all sidebar links.
*   **Cashier (Standard User):** Should *only* see the Point of Sale (POS) screen and perhaps basic shift reports. The sidebar should hide all other links for them to prevent unauthorized access to inventory or analytics.

---

## 2. Tech Stack

*   **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** CSS Modules (Scoped CSS, no Tailwind)
*   **Icons:** Custom SVG icons (Feather-style)
*   **Fonts:** Inter (Google Fonts)

---

## 3. Suggested Scalable Databases (Future Phases)

To make this a real, working system, you need a backend and a database. Here are the best scalable options for this Next.js stack:

### Option A: Supabase (Highly Recommended)
*   **What it is:** An open-source Firebase alternative powered by PostgreSQL.
*   **Why it fits:** It gives you a robust relational database (SQL is best for tracking inventory and sales), built-in authentication (perfect for handling the Admin vs Cashier roles), and real-time subscriptions (great for updating the POS and Kitchen screens instantly when orders are placed).

### Option B: Vercel Postgres + Prisma ORM
*   **What it is:** Serverless PostgreSQL hosted on Vercel, queried using Prisma.
*   **Why it fits:** If you plan to host the frontend on Vercel, this is incredibly seamless. You would write your own Next.js API Routes or Server Actions to handle the business logic. It's highly scalable and type-safe.

### Option C: Firebase / Firestore
*   **What it is:** Google's NoSQL database.
*   **Why it fits:** Very easy to set up and great for real-time data sync. 
*   **Drawback:** It is a NoSQL database. Canteen systems usually require complex relational queries (e.g., "deduct 2 buns and 1 beef patty from Inventory when 1 Cheeseburger is sold on the POS"). Doing this in NoSQL is harder than in a relational SQL database like Supabase or Postgres.

---

## 4. Prompts for Your Teammates' AI Coders

Since there are 4 of you working on this, you can divide the work using AI assistants. Here are suggested prompts your teammates can copy/paste into their AI tools to build the next features.

### Prompt 1: Database Setup & ORM (For the Backend Developer)
> "We have a Next.js 15 App Router project using TypeScript. I want to set up a PostgreSQL database using Prisma ORM. Please review our `src/types/index.ts` and `src/data/mockData.ts` files to understand our data structure. Generate the `schema.prisma` file that models our Products, Inventory Items, Transactions, and Users (ensure Users have roles: ADMIN and CASHIER). After creating the schema, write the Next.js Server Actions to fetch and create Products."

### Prompt 2: Authentication & Roles (For the Security Developer)
> "In our Next.js 15 App Router project, we need to implement authentication using NextAuth.js (Auth.js). Please set up a credentials provider for local login. We have two roles in our system: 'ADMIN' and 'CASHIER'. Modify our `src/components/Sidebar/Sidebar.tsx` so that if the logged-in user has the 'CASHIER' role, they can only see the POS link, but an 'ADMIN' sees everything. Also, create a Next.js middleware file to protect the routes."

### Prompt 3: Making the POS Interactive (For the Frontend Developer)
> "I am working on the Point of Sale page (`src/app/pos/page.tsx`) in our Next.js project. Currently, the cart/order panel on the right side is hardcoded. Please update this component to use React state (or a state manager like Zustand) to manage the cart. I need to be able to click a product in the grid to add it to the cart, use the +/- buttons to change quantities, click the trash icon to remove an item, and have the subtotal, tax (5%), and total calculate automatically based on the cart's current contents."

### Prompt 4: Checkout & Inventory Deduction (For the Full Stack Developer)
> "We need to connect our POS to our database. Write a Next.js Server Action that processes a POS checkout. When the 'PAY' button is clicked in the POS, the action should: 1. Create a new transaction record in the database. 2. Loop through the items in the cart and deduct their quantities from the `Products` table stock count. 3. (Bonus) Return success or error states to the frontend so we can show a success toast notification and clear the cart."
