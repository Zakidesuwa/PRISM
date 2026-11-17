'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { formatCurrency } from '@/utils/formatters';
import { getDistributionMembersAction } from '@/actions/surplusActions';
import { SAMPLE_NET_SURPLUS, sampleDistributionMembers } from '@/data/surplusMockData';
import {
  DistributionMember,
  DistributionResult,
  centavosToPesos,
  computeDistribution,
  getRateWarnings,
  parseMoneyToCentavos,
  parsePercentToBps,
} from '@/lib/surplus/distribution';

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
  {
    key: 'reserve',
    name: 'Reserve Fund',
    purpose: 'Buffer for future losses and stability',
    amount: (r) => r.reserveFund,
    bps: (r) => r.rates.reserveFundBps,
  },
  {
    key: 'cetf',
    name: 'Education & Training Fund (CETF)',
    purpose: 'Member and officer training',
    amount: (r) => r.cetf,
    bps: (r) => r.rates.cetfBps,
  },
  {
    key: 'cdf',
    name: 'Community Development Fund (CDF)',
    purpose: 'Local community projects',
    amount: (r) => r.cdf,
    bps: (r) => r.rates.cdfBps,
  },
  {
    key: 'optional',
    name: 'Optional Fund',
    purpose: 'Projects approved by the general assembly',
    amount: (r) => r.optionalFund,
    bps: (r) => r.rates.optionalFundBps,
  },
];

const peso = (centavos: number) => formatCurrency(centavosToPesos(centavos));
const percent = (bps: number) => `${bps / 100}%`;
const share = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(2)}%` : '—';

type Computed =
  | { result: DistributionResult; warnings: string[]; error?: undefined }
  | { error: string; result?: undefined; warnings?: undefined };

function buildDistribution(
  netSurplusText: string,
  rateText: Record<RateKey, string>,
  members: DistributionMember[]
): Computed {
  const netSurplus = parseMoneyToCentavos(netSurplusText);
  if (netSurplus === null) return { error: 'Enter a valid net surplus amount.' };

  const bps = {} as Record<RateKey, number>;
  for (const field of RATE_FIELDS) {
    const parsed = parsePercentToBps(rateText[field.key]);
    if (parsed === null) {
      return { error: `Enter a percentage between 0 and 100 for ${field.label}.` };
    }
    bps[field.key] = parsed;
  }

  const rates = {
    reserveFundBps: bps.reserve,
    cetfBps: bps.cetf,
    cdfBps: bps.cdf,
    optionalFundBps: bps.optional,
    patronagePoolBps: bps.patronage,
  };

  try {
    return {
      result: computeDistribution({ netSurplus, rates, members }),
      warnings: getRateWarnings(rates),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not compute the distribution.' };
  }
}

export default function DividendsPage() {
  const [netSurplusText, setNetSurplusText] = useState(SAMPLE_NET_SURPLUS);
  const [rateText, setRateText] = useState(DEFAULT_RATE_TEXT);
  const [members, setMembers] = useState<DistributionMember[]>(sampleDistributionMembers);
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [query, setQuery] = useState('');

  // Use real members once the database is connected; otherwise keep the samples.
  useEffect(() => {
    let cancelled = false;
    getDistributionMembersAction()
      .then((response) => {
        if (cancelled || !response.success || !response.data?.length) return;
        setMembers(response.data);
        setUsingLiveData(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo(
    () => buildDistribution(netSurplusText, rateText, members),
    [netSurplusText, rateText, members]
  );

  const { result } = computed;

  const rows = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return members
      .map((member, index) => ({ member, allocation: result.members[index] }))
      .filter(
        ({ member }) =>
          !q ||
          member.fullName.toLowerCase().includes(q) ||
          member.memberCode.toLowerCase().includes(q) ||
          member.branchName.toLowerCase().includes(q)
      );
  }, [members, result, query]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Net Surplus Distribution</h1>
          <p className={styles.subtitle}>
            Statutory funds, patronage refunds and interest on share capital.
          </p>
        </div>
        <span className={usingLiveData ? styles.badgeLive : styles.badgeSample}>
          {usingLiveData ? 'Live member data' : 'Sample member data'}
        </span>
      </div>

      <section className={styles.card}>
        <div className={styles.inputGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Net surplus (₱)</span>
            <input
              className={styles.input}
              inputMode="decimal"
              value={netSurplusText}
              onChange={(e) => setNetSurplusText(e.target.value)}
            />
          </label>
          {RATE_FIELDS.map((field) => (
            <label key={field.key} className={styles.field}>
              <span className={styles.fieldLabel}>{field.label} (%)</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={rateText[field.key]}
                onChange={(e) => setRateText((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className={styles.inputFooter}>
          <span className={styles.hint}>
            The rest of the available surplus goes to interest on share capital.
          </span>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setRateText(DEFAULT_RATE_TEXT)}
          >
            Reset rates
          </button>
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
              <div className={styles.fundPurpose}>
                Shared by purchases — total {peso(result.totalPatronage)}
              </div>
            </div>
            <div className={styles.fundCard}>
              <div className={styles.fundTop}>
                <span className={styles.fundName}>Interest on Share Capital pool</span>
                <span className={styles.fundRate}>
                  {percent(10000 - result.rates.patronagePoolBps)}
                </span>
              </div>
              <div className={styles.fundAmount}>{peso(result.shareCapitalInterestPool)}</div>
              <div className={styles.fundPurpose}>
                Shared by share capital — total {peso(result.totalShareCapital)}
              </div>
            </div>
          </div>

          {(result.undistributedPatronage > 0 || result.undistributedInterest > 0) && (
            <div className={styles.warningBanner}>
              {peso(result.undistributedPatronage + result.undistributedInterest)} cannot be paid
              out because no member has purchases or share capital to base it on.
            </div>
          )}

          <section className={styles.card}>
            <div className={styles.tableTop}>
              <h3 className={styles.tableTitle}>Member breakdown</h3>
              <input
                className={`${styles.input} ${styles.search}`}
                placeholder="Search member, code or school..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className={styles.num}>Purchases</th>
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
                          {member.memberCode} · {member.branchName}
                          {member.status !== 'ACTIVE' && ' · Inactive'}
                        </div>
                      </td>
                      <td className={styles.num}>{peso(member.patronageCentavos)}</td>
                      <td className={styles.num}>
                        {share(member.patronageCentavos, result.totalPatronage)}
                      </td>
                      <td className={styles.num}>{peso(allocation.patronageRefund)}</td>
                      <td className={styles.num}>{peso(member.shareCapitalCentavos)}</td>
                      <td className={styles.num}>{peso(allocation.shareCapitalInterest)}</td>
                      <td className={`${styles.num} ${styles.total}`}>{peso(allocation.total)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.empty}>
                        No members match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>All {members.length} members</td>
                    <td className={styles.num}>{peso(result.totalPatronage)}</td>
                    <td className={styles.num} />
                    <td className={styles.num}>
                      {peso(result.patronageRefundPool - result.undistributedPatronage)}
                    </td>
                    <td className={styles.num}>{peso(result.totalShareCapital)}</td>
                    <td className={styles.num}>
                      {peso(result.shareCapitalInterestPool - result.undistributedInterest)}
                    </td>
                    <td className={`${styles.num} ${styles.total}`}>
                      {peso(
                        result.availableSurplus -
                          result.undistributedPatronage -
                          result.undistributedInterest
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className={styles.formula}>
              Patronage refund = (member purchases ÷ total purchases) × patronage refund pool.
              Interest on capital = (member share capital ÷ total share capital) × interest pool.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
