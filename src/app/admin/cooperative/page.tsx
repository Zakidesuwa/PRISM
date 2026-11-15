'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  cooperatives,
  cooperativeStats,
  type Cooperative,
  type StockStatus,
  type UnitLevel,
} from '@/data/cooperativeMockData';
import styles from './page.module.css';

const PER_PAGE = 10;

type LevelFilter = 'All Levels' | UnitLevel;
type SortOrder = 'Sort By Profit' | 'Highest Profit' | 'Lowest Profit';

const STATUS_CLASS: Record<StockStatus, string> = {
  'In Stock': styles.inStock,
  'Low Stock': styles.lowStock,
  'Stock Out': styles.stockOut,
};

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Builds a compact page list, e.g. 1 … 6 7 8 … 15. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | 'gap')[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap');
    result.push(page);
  });

  return result;
}

function toCsv(rows: Cooperative[]) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const header = ['School Name', 'Address', 'Unit Level', 'Monthly Profit', 'Stock Status'];

  const body = rows.map((row) =>
    [row.name, row.address, row.level, row.monthlyProfit.toFixed(2), row.stockStatus]
      .map(escape)
      .join(',')
  );

  return [header.map(escape).join(','), ...body].join('\r\n');
}

export default function AdminCooperativePage() {
  const [level, setLevel] = useState<LevelFilter>('All Levels');
  // Defaults to the directory's own order — sorting is something you opt into.
  const [sort, setSort] = useState<SortOrder>('Sort By Profit');
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const filtered =
      level === 'All Levels'
        ? cooperatives
        : cooperatives.filter((coop) => coop.level === level);

    if (sort === 'Sort By Profit') return filtered;

    return [...filtered].sort((a, b) =>
      sort === 'Highest Profit'
        ? b.monthlyProfit - a.monthlyProfit
        : a.monthlyProfit - b.monthlyProfit
    );
  }, [level, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const rows = visible.slice(start, start + PER_PAGE);

  function handleExport() {
    const blob = new Blob([toCsv(visible)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'cooperative-directory.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      <div className={styles.statsRow}>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Total Monthly Profit</p>
          <p className={styles.statValue}>
            ₱{cooperativeStats.totalMonthlyProfit.toLocaleString('en-PH', {
              maximumFractionDigits: 0,
            })}
          </p>
          <span className={styles.statChange}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
            </svg>
            +{cooperativeStats.profitChange}% from last month
          </span>
        </article>

        <article className={styles.statCard}>
          <p className={styles.statLabel}>Active Cooperatives</p>
          <p className={styles.statValue}>{cooperativeStats.activeCooperatives}</p>
          <p className={styles.statCaption}>
            {cooperativeStats.operationalEfficiency}% operational efficiency
          </p>
        </article>

        <article className={styles.statCard}>
          <p className={styles.statLabel}>Avg. Transaction</p>
          <p className={styles.statValue}>{formatPeso(cooperativeStats.avgTransaction)}</p>
          <p className={styles.statCaption}>Daily average per student</p>
        </article>

        <article className={styles.statCard}>
          <p className={styles.statLabel}>Stock Alerts</p>
          <p className={styles.statValue}>{cooperativeStats.stockAlerts}</p>
          <p className={styles.statCaption}>Units requiring restock</p>
        </article>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>School Cooperative Directory</h2>
            <p className={styles.cardSubtitle}>
              Manage and monitor district-wide cooperative activities
            </p>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.selectWrap}>
              <span className={styles.selectIcon}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
                </svg>
              </span>
              <label className={styles.srOnly} htmlFor="levelFilter">Filter by unit level</label>
              <select
                id="levelFilter"
                className={`${styles.toolBtn} ${styles.selectControl}`}
                value={level}
                onChange={(event) => {
                  setLevel(event.target.value as LevelFilter);
                  setPage(1);
                }}
              >
                <option>All Levels</option>
                <option>Elementary</option>
                <option>High School</option>
                <option>College</option>
              </select>
            </div>

            <div className={styles.selectWrap}>
              <span className={styles.selectIcon}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h13M3 12h9M3 18h5" /><polyline points="17 13 20 16 23 13" /><line x1="20" y1="16" x2="20" y2="7" />
                </svg>
              </span>
              <label className={styles.srOnly} htmlFor="profitSort">Sort by profit</label>
              <select
                id="profitSort"
                className={`${styles.toolBtn} ${styles.selectControl}`}
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortOrder);
                  setPage(1);
                }}
              >
                <option>Sort By Profit</option>
                <option>Highest Profit</option>
                <option>Lowest Profit</option>
              </select>
            </div>

            <button
              type="button"
              className={`${styles.toolBtn} ${styles.exportBtn}`}
              onClick={handleExport}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">School Name</th>
                <th scope="col">Unit Level</th>
                <th scope="col">Monthly Profit</th>
                <th scope="col">Stock Status</th>
                <th scope="col" className={styles.alignRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.emptyRow}>
                    No cooperatives match this filter.
                  </td>
                </tr>
              )}

              {rows.map((coop) => (
                <tr key={coop.id}>
                  <td>
                    <div className={styles.schoolCell}>
                      <span className={styles.schoolIcon}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-5h6v5" /><line x1="9" y1="10" x2="9" y2="10" /><line x1="15" y1="10" x2="15" y2="10" />
                        </svg>
                      </span>
                      <span className={styles.schoolText}>
                        <span className={styles.schoolName} title={coop.name}>{coop.name}</span>
                        <span className={styles.schoolAddress} title={coop.address}>{coop.address}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.levelBadge}>{coop.level}</span>
                  </td>
                  <td className={styles.profit}>{formatPeso(coop.monthlyProfit)}</td>
                  <td>
                    <span className={`${styles.statusPill} ${STATUS_CLASS[coop.stockStatus]}`}>
                      <span className={styles.statusDot} />
                      {coop.stockStatus}
                    </span>
                  </td>
                  <td className={styles.alignRight}>
                    <Link href={`/admin/cooperative/${coop.id}`} className={styles.detailsLink}>
                      View Details
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerText}>
            {visible.length === 0
              ? 'No cooperatives to show'
              : `Showing ${start + 1}-${Math.min(start + PER_PAGE, visible.length)} of ${visible.length} cooperatives`}
          </span>

          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {pageWindow(currentPage, totalPages).map((entry, index) =>
              entry === 'gap' ? (
                <span key={`gap-${index}`} className={styles.ellipsis}>…</span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  className={`${styles.pageBtn} ${entry === currentPage ? styles.pageBtnActive : ''}`}
                  onClick={() => setPage(entry)}
                  aria-current={entry === currentPage ? 'page' : undefined}
                >
                  {entry}
                </button>
              )
            )}

            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
