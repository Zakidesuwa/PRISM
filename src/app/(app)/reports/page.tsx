import Link from 'next/link';
import ui from '@/styles/ui.module.css';
import { requireBranchUser } from '@/lib/authGuard';
import { isDateString, longDate, manilaToday, rangeOf } from '@/lib/dates';
import { AccountingService, type StatementLine } from '@/services/accountingService';
import { formatCurrency, formatManilaDateTime } from '@/utils/formatters';
import { LedgerForms, PrintButton } from './ReportControls';

export const metadata = { title: 'Financial Reports · PRISM' };

interface PageProps {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}

const TABS = [
  { id: 'income', label: 'Income Statement' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'accounts', label: 'Chart of Accounts' },
  { id: 'journal', label: 'Journal' },
];

const TYPE_LABEL: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};

/** Accounting style: negatives in parentheses. */
function money(amount: number) {
  return amount < 0 ? `(${formatCurrency(-amount)})` : formatCurrency(amount);
}

function Lines({ lines, empty }: { lines: StatementLine[]; empty: string }) {
  if (lines.length === 0) {
    return (
      <tr className={ui.indent}>
        <td className={ui.muted}>{empty}</td>
        <td />
      </tr>
    );
  }
  return (
    <>
      {lines.map((line) => (
        <tr key={`${line.code}-${line.name}`} className={ui.indent}>
          <td>{line.name}</td>
          <td className={ui.num}>{money(line.amount)}</td>
        </tr>
      ))}
    </>
  );
}

function Row({ label, amount, kind }: { label: string; amount: number; kind: 'total' | 'grand' }) {
  return (
    <tr className={kind === 'grand' ? ui.grand : ui.total}>
      <td>{label}</td>
      <td className={ui.num}>{money(amount)}</td>
    </tr>
  );
}

function Section({ title }: { title: string }) {
  return (
    <tr className={ui.section}>
      <td colSpan={2}>{title}</td>
    </tr>
  );
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await requireBranchUser(['MANAGER']);
  const params = await searchParams;

  const today = manilaToday();
  const tab = TABS.some((candidate) => candidate.id === params.tab) ? params.tab! : 'income';
  const to = isDateString(params.to) ? params.to : today;
  const from = isDateString(params.from) && params.from <= to ? params.from : `${to.slice(0, 4)}-01-01`;
  const range = rangeOf(from, to);
  const query = `from=${from}&to=${to}`;
  const period = `${longDate(from)} to ${longDate(to)}`;

  const branchId = user.branchId;
  const heading = (title: string, sub: string) => (
    <div style={{ marginBottom: 12 }}>
      <div className={ui.muted}>{user.branchName}</div>
      <h2 className={ui.title}>{title}</h2>
      <div className={ui.muted}>{sub}</div>
    </div>
  );

  let body: React.ReactNode = null;

  if (tab === 'income') {
    const statement = await AccountingService.incomeStatement(branchId, range);
    body = (
      <>
        {heading('Income Statement', `For the period ${period}`)}
        <table className={ui.statement}>
          <tbody>
            <Section title="Revenue" />
            <Lines lines={statement.revenue} empty="No revenue in this period" />
            <Row label="Total revenue" amount={statement.totalRevenue} kind="total" />
            <Section title="Cost of sales" />
            <Lines lines={statement.costOfSales} empty="No cost of sales in this period" />
            <Row label="Gross profit" amount={statement.grossProfit} kind="total" />
            <Section title="Operating expenses" />
            <Lines lines={statement.expenses} empty="No expenses in this period" />
            <Row label="Total operating expenses" amount={statement.totalExpenses} kind="total" />
            <Row label={statement.netSurplus >= 0 ? 'Net surplus' : 'Net loss'} amount={statement.netSurplus} kind="grand" />
          </tbody>
        </table>
      </>
    );
  } else if (tab === 'balance') {
    const sheet = await AccountingService.balanceSheet(branchId, range.to);
    body = (
      <>
        {heading('Balance Sheet', `As of ${longDate(to)}`)}
        {!sheet.balanced && <div className={ui.error}>The books do not balance. Check the journal for an incomplete entry.</div>}
        <table className={ui.statement}>
          <tbody>
            <Section title="Assets" />
            <Lines lines={sheet.assets} empty="No assets" />
            <Row label="Total assets" amount={sheet.totalAssets} kind="grand" />
            <Section title="Liabilities" />
            <Lines lines={sheet.liabilities} empty="No liabilities" />
            <Row label="Total liabilities" amount={sheet.totalLiabilities} kind="total" />
            <Section title="Members' equity" />
            <Lines lines={sheet.equity} empty="No equity" />
            <Row label="Total equity" amount={sheet.totalEquity} kind="total" />
            <Row label="Total liabilities and equity" amount={sheet.totalLiabilities + sheet.totalEquity} kind="grand" />
          </tbody>
        </table>
      </>
    );
  } else if (tab === 'cashflow') {
    const flow = await AccountingService.cashFlow(branchId, range);
    const group = (title: string, section: typeof flow.operating) => (
      <>
        <Section title={title} />
        <Lines lines={section.items} empty="No cash movement" />
        <Row label={`Net cash from ${title.toLowerCase().replace(' activities', '')} activities`} amount={section.total} kind="total" />
      </>
    );
    body = (
      <>
        {heading('Statement of Cash Flows', `For the period ${period}`)}
        <table className={ui.statement}>
          <tbody>
            {group('Operating activities', flow.operating)}
            {group('Investing activities', flow.investing)}
            {group('Financing activities', flow.financing)}
            <Row label="Net change in cash" amount={flow.netChange} kind="total" />
            <tr className={ui.indent}>
              <td>Cash at start of period</td>
              <td className={ui.num}>{money(flow.openingCash)}</td>
            </tr>
            <Row label="Cash at end of period" amount={flow.closingCash} kind="grand" />
          </tbody>
        </table>
        <p className={ui.muted} style={{ marginTop: 12 }}>
          Each line is the cash received (or paid, in parentheses) against that account. Cash includes cash on hand, bank and e-wallet.
        </p>
      </>
    );
  } else if (tab === 'accounts') {
    const accounts = await AccountingService.listAccounts(branchId);
    body = (
      <>
        {heading('Chart of Accounts', `Balances as of ${longDate(today)}`)}
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th>Type</th>
                <th>Cash flow group</th>
                <th className={ui.num}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className={ui.strong}>{account.code}</td>
                  <td>
                    {account.name}
                    {!account.isSystem && <span className={`${ui.badge} ${ui.badgeBlue}`} style={{ marginLeft: 8 }}>Custom</span>}
                  </td>
                  <td>{TYPE_LABEL[account.type]}</td>
                  <td className={ui.muted}>{account.cashFlowGroup === 'CASH' ? 'Cash account' : account.cashFlowGroup.toLowerCase()}</td>
                  <td className={ui.num}>{money(account.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else {
    const entries = await AccountingService.listJournal(branchId, range);
    body = (
      <>
        {heading('General Journal', `${period} · latest ${entries.length} entries`)}
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry</th>
                <th>Account</th>
                <th className={ui.num}>Debit</th>
                <th className={ui.num}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) =>
                entry.lines.map((line, index) => (
                  <tr key={`${entry.id}-${index}`}>
                    <td>{index === 0 ? formatManilaDateTime(entry.date) : ''}</td>
                    <td>
                      {index === 0 && (
                        <>
                          <span className={ui.strong}>{entry.description}</span>
                          <div className={ui.muted}>
                            JE-{entry.id} · {entry.sourceType.toLowerCase().replace(/_/g, ' ')}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={line.credit > 0 ? { paddingLeft: 28 } : undefined}>
                      {line.code} {line.name}
                    </td>
                    <td className={ui.num}>{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                    <td className={ui.num}>{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                  </tr>
                ))
              )}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className={ui.empty}>
                    No journal entries in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const accountOptions =
    tab === 'accounts' || tab === 'journal'
      ? (await AccountingService.listAccounts(branchId)).map((account) => ({ code: account.code, name: account.name }))
      : [];

  return (
    <div className={ui.page}>
      <div className={`${ui.pageHeader} ${ui.noPrint}`}>
        <div>
          <h1 className={ui.title}>Financial Reports</h1>
          <p className={ui.subtitle}>Generated from the cooperative&apos;s ledger. Every sale, delivery and payment posts there automatically.</p>
        </div>
        <div className={ui.row}>
          {/* A plain GET form: changing the period reloads the report from the server. */}
          <form method="get" className={ui.row}>
            <input type="hidden" name="tab" value={tab} />
            <label className={ui.row}>
              <span className={ui.label}>From</span>
              <input type="date" name="from" defaultValue={from} max={today} className={ui.input} style={{ width: 'auto' }} />
            </label>
            <label className={ui.row}>
              <span className={ui.label}>To</span>
              <input type="date" name="to" defaultValue={to} max={today} className={ui.input} style={{ width: 'auto' }} />
            </label>
            <button type="submit" className={ui.btn}>
              Apply
            </button>
          </form>
          <PrintButton />
        </div>
      </div>

      <nav className={`${ui.tabs} ${ui.noPrint}`}>
        {TABS.map((candidate) => (
          <Link
            key={candidate.id}
            href={`/reports?tab=${candidate.id}&${query}`}
            className={`${ui.tab} ${tab === candidate.id ? ui.tabActive : ''}`}
          >
            {candidate.label}
          </Link>
        ))}
      </nav>

      {(tab === 'accounts' || tab === 'journal') && <LedgerForms mode={tab} accounts={accountOptions} />}

      <section className={`${ui.card} print-area`}>{body}</section>
    </div>
  );
}
