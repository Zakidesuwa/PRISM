# PRISM — Jommel's Handoff

Where my part of PRISM stands, so the rest of the team (and future me) can
pick it up. The project-wide picture is in [TEAM_HANDOFF.md](TEAM_HANDOFF.md);
setup is in [SETUP.md](SETUP.md).

*Last updated: November 18, 2026.*

---

## 1. Status

| | |
|---|---|
| Branch | `feat/jommel` (cut from `main` at `7a2559e`) |
| Commits so far | None yet — the branch is identical to `main` |
| Assigned area | **To be decided** (see section 3) |
| Blocked on | Nothing |

I have joined the project and read the current docs and history. No code
changes yet.

---

## 2. What I know about the project so far

- PRISM is fully database-backed (PostgreSQL + Prisma), multi-cooperative:
  every operational row has a `branchId`, and staff only see their own
  cooperative.
- Every save posts double-entry journal entries; the statements are computed
  from the ledger by Dench's engine in `src/lib/accounting/`.
- Code path for a store screen: `page.tsx` → `<Route>Client.tsx` →
  `src/actions/*` (through `branchAction`) → `src/services/*` → Prisma.
- `IMPLEMENTATION_PLAN.md` is from July and out of date (it still describes
  the mock-data prototype). Trust the code, `README.md`, `SETUP.md`,
  `TEAM_HANDOFF.md` and `CLAUDE.md`.
- The Z reading is intentionally left out at the client's request.

### Who did what before me

| Contributor | Work |
|---|---|
| Atashiwazakidaaaaaaaa | UI prototype from Figma; first schema, core engine, members module |
| Richard De Ocampo Jr. | Database integration and every module end to end; surplus distribution; UI/UX pass; merges |
| Dench-Casaul | Daily Sales and Financial Reports logic (`src/lib/dailySales/`, `src/lib/accounting/`), built in a separate repo and merged Nov 18 |

---

## 3. Candidate work for me

From the "What is left to build" list in `TEAM_HANDOFF.md`. To be agreed
with the team so nobody overlaps:

| Area | What is missing |
|---|---|
| Member payouts | Paying out patronage refunds and interest on share capital (today it is a manual journal entry) |
| Inventory | Physical stock counts and adjustments, purchase orders, supplier balances screen |
| Members | A member's own login |
| Exports | PDF/Excel export of reports |
| Settings | Currency, service charge, "prices include tax", hardware and receipt layout options are saved but unused |
| Layout | Collapsible sidebar for small screens and tablets |
| Dark mode | Not built |
| Engineering | Prisma migration files, automated browser tests |

**Chosen:** _not yet — fill in once agreed._

---

## 4. Things I noticed in the docs

- `SETUP.md` says to clone `github.com/Richard-JR10/PRISM`, but our `origin`
  is `github.com/Zakidesuwa/PRISM`. One of them should be corrected.
- The README and team handoff "Team" tables list three contributors; I am
  not in them yet.
- There is an `origin/Dench` branch; it points at an old commit (`d5b6b5d`)
  and is behind `main`. Dench's real work arrived through the merge commit
  `4f27ce1`.

---

## 5. My workflow

1. Work on `feat/jommel`, keep it rebased on `main`.
2. Before pushing, run the checks from `TEAM_HANDOFF.md` section 7
   (`tsc`, lint, `test:system`, `test:financial-reports`, `test:daily-sales`,
   `test:surplus-engine`, `test:routes`).
3. Open a pull request into `main`; update this file and the team handoff
   when it merges.

---

## 6. Log

| Date | What happened |
|---|---|
| 2026-11-18 | Joined the project, read the docs and history, created `feat/jommel` and this handoff. |
