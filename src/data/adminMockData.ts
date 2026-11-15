// Synthetic data for the admin dashboard prototype.
// Replace with real queries in Phase 2 — see IMPLEMENTATION_PLAN.md.

export interface MonthlyFlow {
  month: string;
  income: number;
  expenses: number;
}

/** 12 months of cooperative cash flow, in pesos. */
export const financialOverview: MonthlyFlow[] = [
  { month: 'Jan', income: 1200, expenses: 400 },
  { month: 'Feb', income: 1650, expenses: 950 },
  { month: 'Mar', income: 2450, expenses: 1850 },
  { month: 'Apr', income: 1800, expenses: 2100 },
  { month: 'May', income: 1600, expenses: 2200 },
  { month: 'Jun', income: 1700, expenses: 1800 },
  { month: 'Jul', income: 2600, expenses: 1950 },
  { month: 'Aug', income: 2350, expenses: 2400 },
  { month: 'Sep', income: 2500, expenses: 2550 },
  { month: 'Oct', income: 4300, expenses: 2150 },
  { month: 'Nov', income: 2900, expenses: 3340 },
  { month: 'Dec', income: 3250, expenses: 2900 },
];

function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const latest = financialOverview[financialOverview.length - 1];
const previous = financialOverview[financialOverview.length - 2];

const totalIncome = financialOverview.reduce((sum, m) => sum + m.income, 0);
const totalExpenses = financialOverview.reduce((sum, m) => sum + m.expenses, 0);

const closingBalance = totalIncome - totalExpenses;
const balanceBeforeLatest = closingBalance - (latest.income - latest.expenses);

export interface SummaryStat {
  label: string;
  value: number;
  caption: string;
  /** Rendered green when rising, red when falling — direction only, as per the design. */
  change: number;
}

/**
 * The three headline cards are derived from `financialOverview` rather than
 * hardcoded, so the cards and the chart can never disagree.
 */
export const summaryStats: SummaryStat[] = [
  {
    label: 'Total Balance',
    value: closingBalance,
    caption: 'Across all accounts',
    change: percentChange(closingBalance, balanceBeforeLatest),
  },
  {
    label: 'Income',
    value: latest.income,
    caption: 'Since last month',
    change: percentChange(latest.income, previous.income),
  },
  {
    label: 'Expenses',
    value: latest.expenses,
    caption: 'Since last month',
    change: percentChange(latest.expenses, previous.expenses),
  },
];

export interface Performer {
  rank: number;
  name: string;
  /** Net margin in pesos per item sold. */
  netMargin: number;
  change: number;
}

export const topPerformers: Performer[] = [
  { rank: 1, name: 'Gordon College', netMargin: 3.4, change: 4.2 },
  { rank: 2, name: 'Sta. Rita Elementary', netMargin: 2.95, change: 2.1 },
  { rank: 3, name: 'Tapinac Senior High', netMargin: 2.3, change: 0 },
  { rank: 4, name: 'Olongapo City National', netMargin: 1.85, change: -1.2 },
];
