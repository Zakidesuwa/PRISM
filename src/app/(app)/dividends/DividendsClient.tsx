'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { formatCurrency, formatManilaDate } from '@/utils/formatters';
import { finalizeDistributionAction, reverseDistributionAction } from '@/actions/accountingActions';
import type { DistributionSummary } from '@/services/surplusService';
import {
  DistributionMember,
  DistributionRates,
  DistributionResult,
  centavosToPesos,
  computeDistribution,
  getRateWarnings,
  parseMoneyToCentavos,
  parsePercentToBps,
} from '@/lib/surplus/distribution';

interface Props {
  year: number;
  years: number[];
  yearEnded: boolean;
  booksNetSurplus: number;
  members: DistributionMember[];
  distributions: DistributionSummary[];
  funds: {
    reserveFund: number;
    cetf: number;
    cdf: number;
    optionalFund: number;
    patronagePayable: number;
    interestPayable: number;
  };
}

type RateKey = 'reserve' | 'cetf' | 'cdf' | 'optional' | 'patronage';

const DEFAULT_RATE_TEXT: Record<RateKey, string> = {
  reserve: '10',
  cetf: '10',
  cdf: '3',
  optional: '7',
  patronage: '30',
};

const RATE_FIELDS: { key: RateKey; label: string }[] = [
  { key: 'reserve', label: 'Reserve Fund' },
  { key: 'cetf', label: 'CETF' },
  { key: 'cdf', label: 'CDF' },
  { key: 'optional', label: 'Optional Fund' },
  { key: 'patronage', label: 'Patronage share of available surplus' },
];

const FUNDS: {
  key: RateKey;
  name: string;
  purpose: string;
  amount: (result: DistributionResult) => number;
  bps: (result: DistributionResult) => number;
}[] = [
  { key: 'reserve', name: 'Reserve Fund', purpose: 'Buffer for future losses and stability', amount: (r) => r.reserveFund, bps: (r) => r.rates.reserveFundBps },
  { key: 'cetf', name: 'Education & Training Fund (CETF)', purpose: 'Member and officer training', amount: (r) => r.cetf, bps: (r) => r.rates.cetfBps },
  { key: 'cdf', name: 'Community Development Fund (CDF)', purpose: 'Local community projects', amount: (r) => r.cdf, bps: (r) => r.rates.cdfBps },
  { key: 'optional', name: 'Optional Fund', purpose: 'Projects approved by the general assembly', amount: (r) => r.optionalFund, bps: (r) => r.rates.optionalFundBps },
];

const peso = (centavos: number) => formatCurrency(centavosToPesos(centavos));
const percent = (bps: number) => `${bps / 100}%`;
const share = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(2)}%` : '—');

type Computed =
  | { result: DistributionResult; rates: DistributionRates; warnings: string[]; error?: undefined }
  | { error: string; result?: undefined; rates?: undefined; warnings?: undefined };

function buildDistribution(netSurplusText: string, rateText: Record<RateKey, string>, members: DistributionMember[]): Computed {
  const netSurplus = parseMoneyToCentavos(netSurplusText);
  if (netSurplus === null) return { error: 'Enter a valid net surplus amount.' };

  const bps = {} as Record<RateKey, number>;
  for (const field of RATE_FIELDS) {
    const parsed = parsePercentToBps(rateText[field.key]);
    if (parsed === null) return { error: `Enter a percentage between 0 and 100 for ${field.label}.` };
    bps[field.key] = parsed;
  }

  const rates: DistributionRates = {
    reserveFundBps: bps.reserve,
    cetfBps: bps.cetf,
    cdfBps: bps.cdf,
    optionalFundBps: bps.optional,
    patronagePoolBps: bps.patronage,
  };

  try {
    return { result: computeDistribution({ netSurplus, rates, members }), rates, warnings: getRateWarnings(rates) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not compute the distribution.' };
  }
}

export default function DividendsClient(props: Props) {
  const { year, members, booksNetSurplus, distributions, funds } = props;
  const router = useRouter();
  const { run, pending } = useAction();

  const booksText = booksNetSurplus > 0 ? booksNetSurplus.toFixed(2) : '0';
  const [netSurplusText, setNetSurplusText] = useState(booksText);
  const [rateText, setRateText] = useState(DEFAULT_RATE_TEXT);
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);

  const computed = useMemo(() => buildDistribution(netSurplusText, rateText, members), [netSurplusText, rateText, members]);
  const { result } = computed;

  const finalized = distributions.find((distribution) => distribution.fiscalYear === year);
  const usingBooks = parseMoneyToCentavos(netSurplusText) === Math.round(booksNetSurplus * 100);
  const canFinalize = Boolean(result) && usingBooks && booksNetSurplus > 0 && !finalized;

  const rows = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return members
      .map((member, index) => ({ member, allocation: result.members[index] }))
      .filter(({ member }) => !q || member.fullName.toLowerCase().includes(q) || member.memberCode.toLowerCase().includes(q));
  }, [members, result, query]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Net Surplus Distribution</h1>
          <p className={styles.subtitle}>Statutory funds, patronage refunds and interest on share capital.</p>
        </div>
        <label className={ui.row}>
          <span className={ui.label}>Fiscal year</span>
          <select className={ui.select} style={{ width: 'auto' }} value={year} onChange={(event) => router.push(`/dividends?year=${event.target.value}`)}>
            {props.years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={ui.statGrid}>
        {[
          ['Reserve Fund', funds.reserveFund],
          ['CETF', funds.cetf],
          ['CDF', funds.cdf],
          ['Optional Fund', funds.optionalFund],
          ['Patronage refund payable', funds.patronagePayable],
          ['Interest on capital payable', funds.interestPayable],
        ].map(([label, value]) => (
          <div key={label as string} className={ui.stat}>
            <div className={ui.statLabel}>{label}</div>
            <div className={ui.statValue}>{formatCurrency(value as number)}</div>
            <div className={ui.statHint}>Current balance in the books</div>
          </div>
        ))}
      </div>

      {finalized ? (
        <div className={ui.notice}>
          The {year} distribution was finalized on {formatManilaDate(finalized.createdAt)}. The figures below are a recomputation for reference.
        </div>
      ) : booksNetSurplus <= 0 ? (
        <div className={ui.warning}>
          The books show {booksNetSurplus < 0 ? `a net loss of ${formatCurrency(-booksNetSurplus)}` : 'no net surplus'} for {year}, so there is nothing to distribute. You can still type an amount to preview the computation.
        </div>
      ) : (
        !props.yearEnded && (
          <div className={ui.warning}>
            {year} has not ended. The net surplus below is the year to date and will keep changing; finalize after year-end closing.
          </div>
        )
      )}

      <section className={styles.card}>
        <div className={styles.inputGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Net surplus for {year} (₱)</span>
            <input className={styles.input} inputMode="decimal" value={netSurplusText} onChange={(event) => setNetSurplusText(event.target.value)} />
          </label>
          {RATE_FIELDS.map((field) => (
            <label key={field.key} className={styles.field}>
              <span className={styles.fieldLabel}>{field.label} (%)</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={rateText[field.key]}
                onChange={(event) => setRateText((previous) => ({ ...previous, [field.key]: event.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className={styles.inputFooter}>
          <span className={styles.hint}>
            From the income statement: {formatCurrency(booksNetSurplus)}.
            {!usingBooks && ' You are previewing a different amount.'}
          </span>
          <div className={ui.row}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setRateText(DEFAULT_RATE_TEXT);
                setNetSurplusText(booksText);
              }}
            >
              Reset to books
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={!canFinalize}
              title={
                finalized
                  ? 'Already finalized'
                  : !usingBooks
                    ? 'Reset to the books figure to finalize'
                    : booksNetSurplus <= 0
                      ? 'No net surplus to distribute'
                      : undefined
              }
              onClick={() => setConfirming(true)}
            >
              Finalize {year} distribution
            </button>
          </div>
        </div>
      </section>

      {computed.error && <div className={styles.errorBanner}>{computed.error}</div>}
      {computed.warnings?.map((warning) => (
        <div key={warning} className={styles.warningBanner}>
          {warning}
        </div>
      ))}

      {result && (
        <>
          <h2 className={styles.sectionTitle}>Step 1 — Statutory funds</h2>
          <div className={styles.fundGrid}>
            {FUNDS.map((fund) => (
              <div key={fund.key} className={styles.fundCard}>
                <div className={styles.fundTop}>
                  <span className={styles.fundName}>{fund.name}</span>
                  <span className={styles.fundRate}>{percent(fund.bps(result))}</span>
                </div>
                <div className={styles.fundAmount}>{peso(fund.amount(result))}</div>
                <div className={styles.fundPurpose}>{fund.purpose}</div>
              </div>
            ))}
          </div>

          <h2 className={styles.sectionTitle}>Step 2 — Surplus available for members</h2>
          <div className={styles.equation}>
            <div className={styles.equationItem}>
              <span className={styles.equationLabel}>Net surplus</span>
              <span className={styles.equationValue}>{peso(result.netSurplus)}</span>
            </div>
            <span className={styles.operator}>−</span>
            <div className={styles.equationItem}>
              <span className={styles.equationLabel}>Total statutory funds</span>
              <span className={styles.equationValue}>{peso(result.totalStatutory)}</span>
            </div>
            <span className={styles.operator}>=</span>
            <div className={styles.equationItem}>
              <span className={styles.equationLabel}>Available surplus</span>
              <span className={styles.equationResult}>{peso(result.availableSurplus)}</span>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Step 3 — Patronage refund and interest on share capital</h2>
          <div className={styles.poolGrid}>
            <div className={styles.fundCard}>
              <div className={styles.fundTop}>
                <span className={styles.fundName}>Patronage Refund pool</span>
                <span className={styles.fundRate}>{percent(result.rates.patronagePoolBps)}</span>
              </div>
              <div className={styles.fundAmount}>{peso(result.patronageRefundPool)}</div>
              <div className={styles.fundPurpose}>Shared by {year} purchases — total {peso(result.totalPatronage)}</div>
            </div>
            <div className={styles.fundCard}>
              <div className={styles.fundTop}>
                <span className={styles.fundName}>Interest on Share Capital pool</span>
                <span className={styles.fundRate}>{percent(10000 - result.rates.patronagePoolBps)}</span>
              </div>
              <div className={styles.fundAmount}>{peso(result.shareCapitalInterestPool)}</div>
              <div className={styles.fundPurpose}>Shared by share capital — total {peso(result.totalShareCapital)}</div>
            </div>
          </div>

          {(result.undistributedPatronage > 0 || result.undistributedInterest > 0) && (
            <div className={styles.warningBanner}>
              {peso(result.undistributedPatronage + result.undistributedInterest)} cannot be paid out because no member has
              purchases or share capital to base it on. It stays in undistributed surplus.
            </div>
          )}

          <section className={styles.card}>
            <div className={styles.tableTop}>
              <h3 className={styles.tableTitle}>Member breakdown</h3>
              <input
                className={`${styles.input} ${styles.search}`}
                placeholder="Search member or code..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className={styles.num}>{year} purchases</th>
                    <th className={styles.num}>% of purchases</th>
                    <th className={styles.num}>Patronage refund</th>
                    <th className={styles.num}>Share capital</th>
                    <th className={styles.num}>Interest on capital</th>
                    <th className={styles.num}>Total payout</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ member, allocation }) => (
                    <tr key={member.id}>
                      <td>
                        <div className={styles.name}>{member.fullName}</div>
                        <div className={styles.meta}>
                          {member.memberCode}
                          {member.status !== 'ACTIVE' && ' · Inactive'}
                        </div>
                      </td>
                      <td className={styles.num}>{peso(member.patronageCentavos)}</td>
                      <td className={styles.num}>{share(member.patronageCentavos, result.totalPatronage)}</td>
                      <td className={styles.num}>{peso(allocation.patronageRefund)}</td>
                      <td className={styles.num}>{peso(member.shareCapitalCentavos)}</td>
                      <td className={styles.num}>{peso(allocation.shareCapitalInterest)}</td>
                      <td className={`${styles.num} ${styles.total}`}>{peso(allocation.total)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.empty}>
                        {members.length === 0 ? 'No members registered yet.' : 'No members match your search.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>All {members.length} members</td>
                    <td className={styles.num}>{peso(result.totalPatronage)}</td>
                    <td className={styles.num} />
                    <td className={styles.num}>{peso(result.patronageRefundPool - result.undistributedPatronage)}</td>
                    <td className={styles.num}>{peso(result.totalShareCapital)}</td>
                    <td className={styles.num}>{peso(result.shareCapitalInterestPool - result.undistributedInterest)}</td>
                    <td className={`${styles.num} ${styles.total}`}>
                      {peso(result.availableSurplus - result.undistributedPatronage - result.undistributedInterest)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className={styles.formula}>
              Patronage refund = (member purchases ÷ total purchases) × patronage refund pool. Interest on capital = (member
              share capital ÷ total share capital) × interest pool.
            </p>
          </section>
        </>
      )}

      <section className={styles.card}>
        <div className={styles.tableTop}>
          <h3 className={styles.tableTitle}>Finalized distributions</h3>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Year</th>
                <th className={styles.num}>Net surplus</th>
                <th className={styles.num}>Reserve</th>
                <th className={styles.num}>CETF</th>
                <th className={styles.num}>CDF</th>
                <th className={styles.num}>Optional</th>
                <th className={styles.num}>Patronage refunds</th>
                <th className={styles.num}>Interest</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {distributions.map((distribution) => (
                <tr key={distribution.id}>
                  <td>
                    <div className={styles.name}>{distribution.fiscalYear}</div>
                    <div className={styles.meta}>
                      {formatManilaDate(distribution.createdAt)} · {distribution.memberCount} members
                    </div>
                  </td>
                  <td className={styles.num}>{formatCurrency(distribution.netSurplus)}</td>
                  <td className={styles.num}>{formatCurrency(distribution.reserveFund)}</td>
                  <td className={styles.num}>{formatCurrency(distribution.cetf)}</td>
                  <td className={styles.num}>{formatCurrency(distribution.cdf)}</td>
                  <td className={styles.num}>{formatCurrency(distribution.optionalFund)}</td>
                  <td className={styles.num}>{formatCurrency(distribution.patronageRefundPool)}</td>
                  <td className={styles.num}>{formatCurrency(distribution.interestPool)}</td>
                  <td className={styles.num}>
                    <button
                      className={`${ui.btn} ${ui.btnSmall} ${ui.btnDanger}`}
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Reverse the ${distribution.fiscalYear} distribution? Its ledger entry will be reversed.`)) {
                          run(() => reverseDistributionAction(distribution.id));
                        }
                      }}
                    >
                      Reverse
                    </button>
                  </td>
                </tr>
              ))}
              {distributions.length === 0 && (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    No distribution has been finalized yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirming && result && computed.rates && (
        <Modal
          title={`Finalize the ${year} distribution?`}
          hint="This posts the allocation to the ledger: the four funds are credited, and member refunds and interest become payable."
          onClose={() => setConfirming(false)}
        >
          <table className={ui.table}>
            <tbody>
              <tr>
                <td>Net surplus (from the books)</td>
                <td className={ui.num}>{peso(result.netSurplus)}</td>
              </tr>
              <tr>
                <td>Statutory funds</td>
                <td className={ui.num}>{peso(result.totalStatutory)}</td>
              </tr>
              <tr>
                <td>Patronage refunds to members</td>
                <td className={ui.num}>{peso(result.patronageRefundPool - result.undistributedPatronage)}</td>
              </tr>
              <tr>
                <td>Interest on share capital to members</td>
                <td className={ui.num}>{peso(result.shareCapitalInterestPool - result.undistributedInterest)}</td>
              </tr>
            </tbody>
          </table>
          {!props.yearEnded && (
            <div className={ui.warning} style={{ marginTop: 12 }}>
              {year} has not ended. Sales made after this will not be part of this distribution.
            </div>
          )}
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending}
              onClick={() => run(() => finalizeDistributionAction(year, computed.rates), () => setConfirming(false))}
            >
              Finalize
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
