// src/lib/accounting/chartOfAccounts.ts
//
// The Chart of Accounts: account types, how they group on the statements, and
// the default chart a canteen cooperative starts with. Pure and isomorphic —
// shared by the service layer, the UI, the seed script and the test script.
// Uses relative imports only so `tsx` scripts can load it without path aliases.

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type AccountSubtype =
  | 'CASH'
  | 'CURRENT_ASSET'
  | 'NON_CURRENT_ASSET'
  | 'CURRENT_LIABILITY'
  | 'NON_CURRENT_LIABILITY'
  | 'EQUITY'
  | 'OPERATING_REVENUE'
  | 'OTHER_INCOME'
  | 'COST_OF_SALES'
  | 'OPERATING_EXPENSE'
  | 'OTHER_EXPENSE';

export type CashFlowCategory = 'OPERATING' | 'INVESTING' | 'FINANCING';

/** Accounts the system posts to automatically. */
export type SystemAccountKey =
  | 'CASH_ON_HAND'
  | 'INVENTORY'
  | 'VENDOR_PAYABLE'
  | 'SALES_TAX_PAYABLE'
  | 'SHARE_CAPITAL'
  | 'RETAINED_EARNINGS'
  | 'SALES'
  | 'COMMISSION_INCOME'
  | 'CASH_OVERAGE'
  | 'COST_OF_GOODS_SOLD'
  | 'CASH_SHORTAGE';

export interface AccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  description?: string;
  systemKey?: SystemAccountKey;
}

export const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};

export const SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  CASH: 'Cash & Cash Equivalents',
  CURRENT_ASSET: 'Current Assets',
  NON_CURRENT_ASSET: 'Non-current Assets',
  CURRENT_LIABILITY: 'Current Liabilities',
  NON_CURRENT_LIABILITY: 'Non-current Liabilities',
  EQUITY: 'Members’ Equity',
  OPERATING_REVENUE: 'Operating Revenue',
  OTHER_INCOME: 'Other Income',
  COST_OF_SALES: 'Cost of Sales',
  OPERATING_EXPENSE: 'Operating Expenses',
  OTHER_EXPENSE: 'Other Expenses',
};

/** Which subtypes belong to each type, in statement order. */
export const SUBTYPES_BY_TYPE: Record<AccountType, AccountSubtype[]> = {
  ASSET: ['CASH', 'CURRENT_ASSET', 'NON_CURRENT_ASSET'],
  LIABILITY: ['CURRENT_LIABILITY', 'NON_CURRENT_LIABILITY'],
  EQUITY: ['EQUITY'],
  REVENUE: ['OPERATING_REVENUE', 'OTHER_INCOME'],
  EXPENSE: ['COST_OF_SALES', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'],
};

/** Allowed first digit of the account code for each subtype. */
const CODE_PREFIX: Record<AccountSubtype, string[]> = {
  CASH: ['1'],
  CURRENT_ASSET: ['1'],
  NON_CURRENT_ASSET: ['1'],
  CURRENT_LIABILITY: ['2'],
  NON_CURRENT_LIABILITY: ['2'],
  EQUITY: ['3'],
  OPERATING_REVENUE: ['4'],
  OTHER_INCOME: ['7'],
  COST_OF_SALES: ['5'],
  OPERATING_EXPENSE: ['6'],
  OTHER_EXPENSE: ['7'],
};

export const CODE_RANGES_HELP =
  '1xxx assets · 2xxx liabilities · 3xxx equity · 4xxx revenue · 5xxx cost of sales · 6xxx operating expenses · 7xxx other income/expenses';

export function typeOfSubtype(subtype: AccountSubtype): AccountType {
  return ACCOUNT_TYPES.find((t) => SUBTYPES_BY_TYPE[t].includes(subtype))!;
}

/** Assets and expenses grow with debits; everything else grows with credits. */
export function isDebitNormal(type: AccountType): boolean {
  return type === 'ASSET' || type === 'EXPENSE';
}

/**
 * Cash flow classification of a non-cash account: where cash that moved
 * against this account belongs on the cash flow statement. null for cash itself.
 */
export function cashFlowCategory(subtype: AccountSubtype): CashFlowCategory | null {
  switch (subtype) {
    case 'CASH':
      return null;
    case 'NON_CURRENT_ASSET':
      return 'INVESTING';
    case 'NON_CURRENT_LIABILITY':
    case 'EQUITY':
      return 'FINANCING';
    default:
      // Revenue, expenses and working capital (current assets/liabilities).
      return 'OPERATING';
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface AccountInput {
  code: string;
  name: string;
  subtype: AccountSubtype;
  description?: string | null;
}

/** Returns an error message, or null when the input is valid. */
export function validateAccountInput(input: AccountInput, existingCodes: Iterable<string> = []): string | null {
  const code = (input.code ?? '').trim();
  const name = (input.name ?? '').trim();
  if (!/^\d{4}$/.test(code)) return 'Account code must be exactly 4 digits.';
  if (!name) return 'Account name is required.';
  if (name.length > 80) return 'Account name must be 80 characters or fewer.';
  if (!(input.subtype in CODE_PREFIX)) return 'Choose a valid account group.';
  if (!CODE_PREFIX[input.subtype].includes(code[0])) {
    return `Code ${code} does not fit ${SUBTYPE_LABELS[input.subtype]}. Use ${CODE_PREFIX[input.subtype]
      .map((p) => `${p}xxx`)
      .join(' or ')} (${CODE_RANGES_HELP}).`;
  }
  for (const existing of existingCodes) {
    if (existing === code) return `Account code ${code} is already in use.`;
  }
  return null;
}

// ─── Default chart for a canteen cooperative ─────────────────────────────────

export const DEFAULT_CHART_OF_ACCOUNTS: AccountDefinition[] = [
  // Assets
  { code: '1010', name: 'Cash on Hand', type: 'ASSET', subtype: 'CASH', systemKey: 'CASH_ON_HAND', description: 'POS drawer cash and undeposited collections.' },
  { code: '1020', name: 'Cash in Bank', type: 'ASSET', subtype: 'CASH' },
  { code: '1030', name: 'Petty Cash Fund', type: 'ASSET', subtype: 'CASH' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', subtype: 'CURRENT_ASSET' },
  { code: '1200', name: 'Merchandise & Raw Materials Inventory', type: 'ASSET', subtype: 'CURRENT_ASSET', systemKey: 'INVENTORY', description: 'Relieved at cost by POS sales through product recipes.' },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'CURRENT_ASSET' },
  { code: '1500', name: 'Kitchen Equipment', type: 'ASSET', subtype: 'NON_CURRENT_ASSET' },
  { code: '1510', name: 'Accumulated Depreciation – Kitchen Equipment', type: 'ASSET', subtype: 'NON_CURRENT_ASSET', description: 'Contra-asset: carries a credit balance.' },
  { code: '1520', name: 'Furniture & Fixtures', type: 'ASSET', subtype: 'NON_CURRENT_ASSET' },
  // Liabilities
  { code: '2010', name: 'Accounts Payable – Suppliers', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY' },
  { code: '2020', name: 'Due to Concessionaires', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', systemKey: 'VENDOR_PAYABLE', description: 'Vendors’ share of consigned-goods sales, payable on settlement.' },
  { code: '2030', name: 'Output Tax Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', systemKey: 'SALES_TAX_PAYABLE', description: 'Tax collected at the POS, payable on remittance.' },
  { code: '2040', name: 'Accrued Expenses', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY' },
  { code: '2500', name: 'Loans Payable', type: 'LIABILITY', subtype: 'NON_CURRENT_LIABILITY' },
  // Equity
  { code: '3010', name: 'Share Capital', type: 'EQUITY', subtype: 'EQUITY', systemKey: 'SHARE_CAPITAL', description: 'Paid-up capital contributed by cooperative members.' },
  { code: '3020', name: 'Statutory Reserve Fund', type: 'EQUITY', subtype: 'EQUITY' },
  { code: '3030', name: 'Retained Earnings (Undivided Net Surplus)', type: 'EQUITY', subtype: 'EQUITY', systemKey: 'RETAINED_EARNINGS' },
  // Revenue
  { code: '4010', name: 'Canteen Sales', type: 'REVENUE', subtype: 'OPERATING_REVENUE', systemKey: 'SALES', description: 'Net-of-tax sales of coop-owned goods.' },
  { code: '4020', name: 'Concession Commission Income', type: 'REVENUE', subtype: 'OPERATING_REVENUE', systemKey: 'COMMISSION_INCOME', description: 'The coop’s share of consigned-goods sales.' },
  // Cost of sales
  { code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE', subtype: 'COST_OF_SALES', systemKey: 'COST_OF_GOODS_SOLD' },
  // Operating expenses
  { code: '6010', name: 'Salaries & Wages', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6020', name: 'Utilities Expense', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6030', name: 'Rent Expense', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6040', name: 'Supplies Expense', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6050', name: 'Repairs & Maintenance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6060', name: 'Depreciation Expense', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  { code: '6090', name: 'Miscellaneous Expense', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
  // Other income / expenses
  { code: '7010', name: 'Cash Overage', type: 'REVENUE', subtype: 'OTHER_INCOME', systemKey: 'CASH_OVERAGE', description: 'Drawer cash counted above the expected amount.' },
  { code: '7020', name: 'Interest Income', type: 'REVENUE', subtype: 'OTHER_INCOME' },
  { code: '7510', name: 'Cash Shortage', type: 'EXPENSE', subtype: 'OTHER_EXPENSE', systemKey: 'CASH_SHORTAGE', description: 'Drawer cash counted below the expected amount.' },
];
