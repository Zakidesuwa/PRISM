'use client';

import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, Download, ListFilter, School, TrendingUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Cooperative, CooperativeStats, StockStatus, UnitLevel } from '@/lib/adminTypes';
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

export default function CooperativeDirectory({
  cooperatives,
  stats: cooperativeStats,
}: {
  cooperatives: Cooperative[];
  stats: CooperativeStats;
}) {
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
  }, [level, sort, cooperatives]);

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
            <TrendingUp size={12} strokeWidth={3} aria-hidden="true" />
            {cooperativeStats.profitChange >= 0 ? '+' : ''}{cooperativeStats.profitChange}% from last month
          </span>
        </article>

        <article className={styles.statCard}>
          <p className={styles.statLabel}>Active Cooperatives</p>
          <p className={styles.statValue}>{cooperativeStats.activeCooperatives}</p>
          <p className={styles.statCaption}>
            {cooperativeStats.operationalEfficiency}% of stock lines available
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
                <ListFilter size={13} aria-hidden="true" />
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
                <ArrowDownWideNarrow size={13} aria-hidden="true" />
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
              <Download size={13} aria-hidden="true" />
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
                        <School size={17} aria-hidden="true" />
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
                      <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
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
              <ChevronLeft size={13} strokeWidth={2.5} aria-hidden="true" />
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
              <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
