# PRISM — Setup & Run Guide

How to get the PRISM Management System running on your machine.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | **20.9.0 or newer** | Next.js 16 will not run on Node 18 |
| npm | 10 or newer | Ships with Node |
| Git | any recent | To clone the repo |

Check what you have:

```bash
node -v      # must be >= v20.9.0
npm -v
```

If `node -v` prints v18 or lower, install a newer Node from
[nodejs.org](https://nodejs.org/) before continuing. This is the single most
common reason the project fails to start.

---

## 2. Install

```bash
git clone https://github.com/Richard-JR10/PRISM.git
cd PRISM
npm install
```

There is **no `.env` file to create**. The prototype has no database or API
keys yet, so it runs with no configuration at all.

---

## 3. Run

```bash
npm run dev
```

Open **<http://localhost:3000>**. You will be redirected to the login screen.

### Login credentials

The prototype ships with two hardcoded accounts. They are also printed on the
login card itself, so you do not need to memorise them.

| Role | Username | Password | Lands on |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | `/admin` — the BEAM admin panel |
| **User** | `user` | `user123` | `/` — the canteen dashboard and POS |

> These live in [`src/lib/auth.ts`](src/lib/auth.ts). Passwords are plain text
> and the session cookie is not signed, so this is a **prototype stand-in only**
> — see [Security status](#7-security-status) below.

---

## 4. What you can open

Each role only sees its own area; the other one redirects away.

### User side (`user` / `user123`)

| Route | Page |
|---|---|
| `/` | Dashboard — weekly sales, quick stats, popular items |
| `/products` | Product catalog |
| `/inventory` | Raw materials and suppliers |
| `/pos` | Point of Sale |
| `/analytics` | Profit analytics |
| `/dividends`, `/reports`, `/users`, `/settings` | Placeholder pages |

### Admin side (`admin` / `admin123`)

| Route | Page |
|---|---|
| `/admin` | Dashboard — financial overview chart, top performers |
| `/admin/cooperative` | School cooperative directory (142 schools, filter/sort/export) |
| `/admin/cooperative/[id]` | Per-school performance detail |
| `/admin/inventory` | District inventory (248 stock lines) |
| `/admin/settings` | System settings |

---

## 5. Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build — **stop the dev server first** (see below) |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check without emitting files |

---

## 6. Project structure

```
PRISM/
├── src/
│   ├── proxy.ts                  # Route protection (Next 16's renamed middleware)
│   ├── app/
│   │   ├── layout.tsx            # Root layout — html/body only
│   │   ├── globals.css           # Design tokens (colours, radii, shadows)
│   │   ├── login/                # Login screen
│   │   ├── actions/auth.ts       # login / logout server actions
│   │   ├── (app)/                # Signed-in user area (sidebar + header shell)
│   │   │   ├── layout.tsx        #   the shell itself
│   │   │   ├── page.tsx          #   dashboard
│   │   │   └── products, inventory, pos, analytics, ...
│   │   └── admin/                # Admin area (its own shell)
│   │       ├── layout.tsx
│   │       ├── page.tsx          #   admin dashboard + FinancialChart
│   │       ├── cooperative/      #   directory + [id] detail view
│   │       ├── inventory/
│   │       └── settings/
│   ├── components/
│   │   ├── Sidebar/, Header/          # User-side chrome
│   │   └── AdminSidebar/, AdminHeader/ # Admin chrome
│   ├── data/                     # All mock data lives here
│   ├── lib/                      # auth.ts (demo users), session.ts
│   └── types/
├── SETUP.md                      # this file
├── TEAM_HANDOFF.md               # task split and AI prompts
└── IMPLEMENTATION_PLAN.md        # phase roadmap
```

The `(app)` folder name is a **route group** — the parentheses mean it does not
appear in the URL. `src/app/(app)/pos/page.tsx` still serves `/pos`. It exists so
the signed-in pages can share the sidebar/header shell while `/login` and
`/admin` render without it.

---

## 7. Security status

**The current auth is a prototype, not real security.** Anyone can forge a
session by hand. Before this goes anywhere near real users, Phase 2 must
replace it:

- Passwords are stored in plain text in `src/lib/auth.ts`
- The session cookie holds a bare user id and is **not signed or encrypted**
- There is no password hashing, rate limiting, or session expiry beyond 8 hours

It is fine for demos and for building the UI against. It is not fine for
production.

---

## 8. Troubleshooting

### `npm run dev` fails, or Turbopack panics with "Access is denied (os error 5)"

The `.next/` folder was copied from someone else's machine and still contains
their absolute paths. Delete it and restart:

```bash
rm -rf .next        # Windows PowerShell: Remove-Item -Recurse -Force .next
npm run dev
```

**When sharing this project as a zip rather than through Git, always exclude
`.next/` and `node_modules/`.** Both are regenerated by `npm install` and
`npm run dev`.

### The build fails with "Jest worker encountered child process exceptions"

You ran `npm run build` while `npm run dev` was still running. Both write to
`.next/` and corrupt each other. **Stop the dev server first**, then build.

### "Port 3000 is in use"

An earlier dev server is still alive. Next will tell you the process id:

```
Port 3000 is in use by process 30344
```

```bash
# Windows
taskkill /PID 30344 /F

# macOS / Linux
kill -9 30344
```

Closing the terminal does not always stop it — the Node process can outlive the
shell that launched it.

### TypeScript complains about routes that clearly exist

Next 16 generates route types into `.next/`. If you added a page and the types
are stale:

```bash
npx next typegen
```

### I created `middleware.ts` and nothing happens

**Next.js 16 renamed `middleware` to `proxy`.** The file must be
`src/proxy.ts` and the exported function must be named `proxy`. A file called
`middleware.ts` is silently ignored. See `src/proxy.ts` for a working example.

---

## 9. Notes for the next developer

- **There is no database.** Every number on screen comes from `src/data/*.ts`.
  Nothing persists — a refresh resets everything, and the Settings page's Save
  button only updates in-memory state.
- **Mock data is generated deterministically**, using a seeded LCG rather than
  `Math.random()`. That is deliberate: random values would differ between the
  server render and the client render and cause hydration errors. If you add
  generated data, keep it deterministic.
- **Derived over hardcoded.** Stat cards are computed from the tables they
  summarise (for example inventory stock status comes from on-hand vs capacity),
  so the headline figures cannot drift from the rows beneath them. Please
  preserve that when wiring up real data.
- **This is not the Next.js you may know.** Version 16 changed several APIs —
  `cookies()` is async, `params` is a Promise, `middleware` is now `proxy`. The
  bundled docs in `node_modules/next/dist/docs/` are the authoritative reference
  for this exact version.

See [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the phase roadmap and
[`TEAM_HANDOFF.md`](TEAM_HANDOFF.md) for the task split.
