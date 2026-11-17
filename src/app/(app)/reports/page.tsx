import Link from 'next/link';
import { CircleAlert, CircleCheck } from 'lucide-react';
import ui from '@/styles/ui.module.css';
import { requireBranchUser } from '@/lib/authGuard';
import { isDateString, manilaToday, rangeOf, startOfDay, addDays } from '@/lib/dates';
import { PERIOD_PRESETS, formatAsOf, formatPeriod, matchPreset, presetPeriod } from '@/lib/accounting/periods';
import { ACCOUNT_TYPE_LABELS, SUBTYPES_BY_TYPE, type AccountType } from '@/lib/accounting/chartOfAccounts';
import type { StatementSection } from '@/lib/accounting/statements';
import { AccountingService } from '@/services/accountingService';
import { formatCurrency, formatManilaDateTime } from '@/utils/formatters';
import { AccountRowActions, JournalReverseButton, LedgerForms, PrintButton } from './ReportControls';

export const metadata = { title: 'Financial Reports · PRISM' };

interface PageProps {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}

const TABS = [
  { id: 'income', label: 'Income Statement' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'trial', label: 'Trial Balance' },
  { id: 'accounts', label: 'Chart of Accounts' },
  { id: 'journal', label: 'Journal' },
];

/** Accounting style: negatives in parentheses. */
function money(amount: number) {
  return amount < 0 ? `(${formatCurrency(-amount)})` : formatCurrency(amount);
}

const pct = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

function Section({ title }: { title: string }) {
  return (
    <tr className={ui.section}>
      <td colSpan={2}>{title}</td>
    </tr>
  );
}

function Lines({ section, empty }: { section: StatementSection; empty: string }) {
  if (section.lines.length === 0) {
    return (
      <tr className={ui.indent}>
        <td className={ui.muted}>{empty}</td>
        <td />
      </tr>
    );
  }
  return (
    <>
      {section.lines.map((line) => (
        <tr key={`${line.code}-${line.name}`} className={ui.indent}>
          <td>
            {line.code && <span className={ui.muted}>{line.code} </span>}
            {line.name}
          </td>
          <td className={ui.num}>{money(line.amount)}</td>
        </tr>
      ))}
    </>
  );
}

function Row({ label, amount, kind, note }: { label: string; amount: number; kind: 'total' | 'grand'; note?: string }) {
  return (
    <tr className={kind === 'grand' ? ui.grand : ui.total}>
      <td>
        {label}
        {note && <span className={ui.muted} style={{ fontWeight: 400 }}> · {note}</span>}
      </td>
      <td className={ui.num}>{money(amount)}</td>
    </tr>
  );
}

/** A visible check that the statement ties out, so the reader can trust it. */
function Check({ ok, good, bad }: { ok: boolean; good: string; bad: string }) {
  return (
    <div className={ok ? ui.notice : ui.error} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {ok ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
      {ok ? good : bad}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await requireBranchUser(['MANAGER']);
  const params = await searchParams;
  const branchId = user.branchId;

  const today = manilaToday();
  const tab = TABS.some((candidate) => candidate.id === params.tab) ? params.tab! : 'income';
  const fallback = presetPeriod('year-to-date', today);
  const to = isDateString(params.to) && params.to <= today ? params.to : fallback.to;
  const from = isDateString(params.from) && params.from <= to ? params.from : fallback.from;
  const range = rangeOf(from, to);
  const endOfTo = startOfDay(addDays(to, 1));
  const query = `from=${from}&to=${to}`;
  const activePreset = matchPreset({ from, to }, today);
  // Point-in-time reports only use the end date.
  const pointInTime = tab === 'balance' || tab === 'trial';

  const heading = (title: string, sub: string) => (
    <div style={{ marginBottom: 12 }}>
      <div className={ui.muted}>{user.branchName}</div>
      <h2 className={ui.title}>{title}</h2>
      <div className={ui.muted}>{sub}</div>
    </div>
  );

  let body: React.ReactNode = null;

  if (tab === 'income') {
    const s = await AccountingService.incomeStatement(branchId, range);
    body = (
      <>
        {heading('Income Statement', `For the period ${formatPeriod({ from, to })}`)}
        <table className={ui.statement}>
          <tbody>
            <Section title="Revenue" />
            <Lines section={s.revenue} empty="No revenue in this period" />
            <Row label="Total revenue" amount={s.revenue.total} kind="total" />
            <Section title="Cost of sales" />
            <Lines section={s.costOfSales} empty="No cost of sales in this period" />
            <Row label="Gross profit" amount={s.grossProfit} kind="total" note={`margin ${pct(s.grossMarginPct)}`} />
            <Section title="Operating expenses" />
            <Lines section={s.operatingExpenses} empty="No operating expenses in this period" />
            <Row label="Operating income" amount={s.operatingIncome} kind="total" />
            {(s.otherIncome.lines.length > 0 || s.otherExpenses.lines.length > 0) && (
              <>
                <Section title="Other income and expenses" />
                <Lines section={s.otherIncome} empty="No other income" />
                {s.otherExpenses.lines.map((line) => (
                  <tr key={line.code} className={ui.indent}>
                    <td>
                      <span className={ui.muted}>{line.code} </span>
                      {line.name}
                    </td>
                    <td className={ui.num}>{money(-line.amount)}</td>
                  </tr>
                ))}
              </>
            )}
            <Row
              label={s.netIncome >= 0 ? 'Net surplus' : 'Net loss'}
              amount={s.netIncome}
              kind="grand"
              note={`margin ${pct(s.netMarginPct)}`}
            />
          </tbody>
        </table>
      </>
    );
  } else if (tab === 'balance') {
    const b = await AccountingService.balanceSheet(branchId, endOfTo);
    body = (
      <>
        {heading('Balance Sheet', `As of ${formatAsOf(to)}`)}
        <Check
          ok={b.balanced}
          good="Assets equal liabilities plus equity."
          bad={`The books are off by ${formatCurrency(Math.abs(b.difference))}. Check the journal for an incomplete entry.`}
        />
        <table className={ui.statement}>
          <tbody>
            <Section title="Assets" />
            {b.assets.map((section) => (
              <SectionBlock key={section.key} section={section} />
            ))}
            <Row label="Total assets" amount={b.totalAssets} kind="grand" />
            <Section title="Liabilities" />
            {b.liabilities.map((section) => (
              <SectionBlock key={section.key} section={section} />
            ))}
            <Row label="Total liabilities" amount={b.totalLiabilities} kind="total" />
            <Section title="Members' equity" />
            <Lines section={b.equity} empty="No equity" />
            <Row label="Total equity" amount={b.totalEquity} kind="total" />
            <Row label="Total liabilities and equity" amount={b.totalLiabilitiesAndEquity} kind="grand" />
          </tbody>
        </table>
      </>
    );
  } else if (tab === 'cashflow') {
    const c = await AccountingService.cashFlow(branchId, range);
    body = (
      <>
        {heading('Statement of Cash Flows', `For the period ${formatPeriod({ from, to })} · direct method`)}
        <Check
          ok={c.reconciled}
          good="Ending cash agrees with the cash accounts in the ledger."
          bad={`Ending cash differs from the ledger (${formatCurrency(c.endingCashPerLedger)}).`}
        />
        <table className={ui.statement}>
          <tbody>
            {c.sections.map((section) => (
              <SectionFlow key={section.category} label={section.label} lines={section.lines} total={section.total} />
            ))}
            <Row label="Net change in cash" amount={c.netChange} kind="total" />
            <tr className={ui.indent}>
              <td>Cash at start of period</td>
              <td className={ui.num}>{money(c.beginningCash)}</td>
            </tr>
            <Row label="Cash at end of period" amount={c.endingCash} kind="grand" />
          </tbody>
        </table>
        <p className={ui.muted} style={{ marginTop: 12 }}>
          Each line is the cash received (or paid, in parentheses) against that account. Cash includes cash on hand,
          bank and e-wallet.
        </p>
      </>
    );
  } else if (tab === 'trial') {
    const t = await AccountingService.trialBalance(branchId, endOfTo);
    body = (
      <>
        {heading('Trial Balance', `As of ${formatAsOf(to)}`)}
        <Check ok={t.balanced} good="Total debits equal total credits." bad="Debits and credits do not agree." />
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th className={ui.num}>Debit</th>
                <th className={ui.num}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={row.accountId}>
                  <td className={ui.strong}>{row.code}</td>
                  <td>{row.name}</td>
                  <td className={ui.num}>{row.debit ? formatCurrency(row.debit) : ''}</td>
                  <td className={ui.num}>{row.credit ? formatCurrency(row.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Totals</td>
                <td className={ui.num}>{formatCurrency(t.totalDebit)}</td>
                <td className={ui.num}>{formatCurrency(t.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    );
  } else if (tab === 'accounts') {
    const accounts = await AccountingService.listAccounts(branchId);
    body = (
      <>
        {heading('Chart of Accounts', `Balances as of ${formatAsOf(today)}`)}
        {(Object.keys(SUBTYPES_BY_TYPE) as AccountType[]).map((type) => (
          <div key={type} style={{ marginBottom: 20 }}>
            <h3 className={ui.cardTitle} style={{ margin: '8px 0' }}>
              {ACCOUNT_TYPE_LABELS[type]}
            </h3>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Code</th>
                    <th>Account</th>
                    <th>Group</th>
                    <th className={ui.num}>Balance</th>
                    <th className={ui.noPrint} />
                  </tr>
                </thead>
                <tbody>
                  {accounts
                    .filter((account) => account.type === type)
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((account) => (
                      <tr key={account.id} style={account.isActive ? undefined : { opacity: 0.55 }}>
                        <td className={ui.strong}>{account.code}</td>
                        <td>
                          {account.name}
                          {!account.isSystem && (
                            <span className={`${ui.badge} ${ui.badgeBlue}`} style={{ marginLeft: 8 }}>
                              Custom
                            </span>
                          )}
                          {!account.isActive && (
                            <span className={ui.badge} style={{ marginLeft: 8 }}>
                              Inactive
                            </span>
                          )}
                          {account.description && <div className={ui.muted}>{account.description}</div>}
                        </td>
                        <td className={ui.muted}>{account.subtypeLabel}</td>
                        <td className={ui.num}>{money(account.balance)}</td>
                        <td className={ui.noPrint}>
                          {!account.isSystem && (
                            <AccountRowActions accountId={account.id} isActive={account.isActive} hasBalance={account.balance !== 0} />
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </>
    );
  } else {
    const entries = await AccountingService.listJournal(branchId, range);
    body = (
      <>
        {heading('General Journal', `${formatPeriod({ from, to })} · latest ${entries.length} entries`)}
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
                            {entry.reversedById && ` · reversed by JE-${entry.reversedById}`}
                          </div>
                          {entry.canReverse && <JournalReverseButton entryId={entry.id} />}
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
    tab === 'journal'
      ? (await AccountingService.listAccounts(branchId))
          .filter((account) => account.isActive)
          .map((account) => ({ code: account.code, name: account.name }))
      : [];

  return (
    <div className={ui.page}>
      <div className={`${ui.pageHeader} ${ui.noPrint}`}>
        <div>
          <h1 className={ui.title}>Financial Reports</h1>
          <p className={ui.subtitle}>
            Generated from the cooperative&apos;s ledger. Every sale, delivery and payment posts there automatically.
          </p>
        </div>
        <PrintButton />
      </div>

      <nav className={`${ui.tabs} ${ui.noPrint}`}>
        {TABS.map((candidate) => (
          <Link
            key={candidate.id}
            href={`/reports?tab=${candidate.id}&${query}`}
            className={`${ui.tab} ${tab === candidate.id ? ui.tabActive : ''}`}
            aria-current={tab === candidate.id ? 'page' : undefined}
          >
            {candidate.label}
          </Link>
        ))}
      </nav>

      {tab !== 'accounts' && (
        <div className={`${ui.row} ${ui.noPrint}`} style={{ justifyContent: 'space-between' }}>
          {/* Period presets (Dench's): one tap instead of picking two dates. */}
          <div className={ui.row} role="group" aria-label="Period">
            {PERIOD_PRESETS.map((preset) => {
              const p = presetPeriod(preset.id, today);
              return (
                <Link
                  key={preset.id}
                  href={`/reports?tab=${tab}&from=${p.from}&to=${p.to}`}
                  className={`${ui.btn} ${ui.btnSmall} ${activePreset === preset.id ? ui.btnPrimary : ''}`}
                  aria-current={activePreset === preset.id ? 'true' : undefined}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>
          <form method="get" className={ui.row}>
            <input type="hidden" name="tab" value={tab} />
            {!pointInTime && (
              <label className={ui.row}>
                <span className={ui.label}>From</span>
                <input type="date" name="from" defaultValue={from} max={today} className={ui.input} style={{ width: 'auto' }} />
              </label>
            )}
            {pointInTime && <input type="hidden" name="from" value={from} />}
            <label className={ui.row}>
              <span className={ui.label}>{pointInTime ? 'As of' : 'To'}</span>
              <input type="date" name="to" defaultValue={to} max={today} className={ui.input} style={{ width: 'auto' }} />
            </label>
            <button type="submit" className={ui.btn}>
              Apply
            </button>
          </form>
        </div>
      )}

      {(tab === 'accounts' || tab === 'journal') && <LedgerForms mode={tab} accounts={accountOptions} today={today} />}

      <section className={`${ui.card} print-area`}>{body}</section>
    </div>
  );
}

/** A balance-sheet group (e.g. Current Assets) with its own subtotal. */
function SectionBlock({ section }: { section: StatementSection }) {
  if (section.lines.length === 0) return null;
  return (
    <>
      <tr className={ui.indent}>
        <td className={ui.strong}>{section.label}</td>
        <td />
      </tr>
      {section.lines.map((line) => (
        <tr key={line.code ?? line.name} className={ui.indent}>
          <td style={{ paddingLeft: 40 }}>
            <span className={ui.muted}>{line.code} </span>
            {line.name}
          </td>
          <td className={ui.num}>{money(line.amount)}</td>
        </tr>
      ))}
      <tr className={ui.indent}>
        <td className={ui.muted}>Total {section.label.toLowerCase()}</td>
        <td className={ui.num}>{money(section.total)}</td>
      </tr>
    </>
  );
}

function SectionFlow({ label, lines, total }: { label: string; lines: StatementSection['lines']; total: number }) {
  return (
    <>
      <Section title={label.replace('Cash Flows from ', '')} />
      {lines.length === 0 ? (
        <tr className={ui.indent}>
          <td className={ui.muted}>No cash movement</td>
          <td />
        </tr>
      ) : (
        lines.map((line) => (
          <tr key={line.code ?? line.name} className={ui.indent}>
            <td>
              <span className={ui.muted}>{line.code} </span>
              {line.name}
            </td>
            <td className={ui.num}>{money(line.amount)}</td>
          </tr>
        ))
      )}
      <Row label={`Net cash from ${label.replace('Cash Flows from ', '').toLowerCase()}`} amount={total} kind="total" />
    </>
  );
}

