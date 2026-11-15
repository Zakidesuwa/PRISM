"use client";

import React, { useMemo, useState } from 'react';
import styles from './page.module.css';

type Stakeholder = {
  id: number;
  name: string;
  role: string;
  shares: number;
  status: 'Processed' | 'Pending';
};

const MOCK_POOL = 124500; // total pool available

const MOCK_STAKEHOLDERS: Stakeholder[] = [
  { id: 1, name: 'John Smith', role: 'Administration', shares: 1250, status: 'Processed' },
  { id: 2, name: 'Emily Davis', role: 'Operations Manager', shares: 850, status: 'Pending' },
  { id: 3, name: 'Michael Wong', role: 'Head Chef', shares: 600, status: 'Processed' },
  { id: 4, name: 'Sarah Jenkins', role: 'Supplier Liaison', shares: 450, status: 'Pending' },
  { id: 5, name: 'Carlos Reyes', role: 'Cashier', shares: 300, status: 'Processed' },
  { id: 6, name: 'Ana Lopez', role: 'Storekeeper', shares: 200, status: 'Processed' },
  { id: 7, name: 'Rico Santos', role: 'Supervisor', shares: 180, status: 'Pending' },
  { id: 8, name: 'Grace Lim', role: 'Accountant', shares: 170, status: 'Processed' },
];

export default function DividendsPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 4;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_STAKEHOLDERS;
    return MOCK_STAKEHOLDERS.filter(s => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q));
  }, [query]);

  const totalShares = useMemo(() => MOCK_STAKEHOLDERS.reduce((s, i) => s + i.shares, 0), []);
  const avgPerShare = totalShares > 0 ? MOCK_POOL / totalShares : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  }

  function formatCurrency(n: number) {
    return '$' + n.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Q3 2023 Dividend Distribution</h1>
          <p className={styles.subtitle}>Review and manage stakeholder profit sharing.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.primaryBtn}>Generate Report</button>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statInner}>
            <div className={styles.statIcon}>🏦</div>
            <div>
              <div className={styles.statLabel}>Total Pool Available</div>
              <div className={styles.statValue}>{formatCurrency(MOCK_POOL)}</div>
            </div>
            <div className={styles.statChange}>+12.5%</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statInner}>
            <div className={styles.statIcon}>👥</div>
            <div>
              <div className={styles.statLabel}>Eligible Stakeholders</div>
              <div className={styles.statValue}>{MOCK_STAKEHOLDERS.length}</div>
            </div>
            <div className={styles.statEmpty} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statInner}>
            <div className={styles.statIcon}>💸</div>
            <div>
              <div className={styles.statLabel}>Avg. Distribution per Share</div>
              <div className={styles.statValue}>{formatCurrency(avgPerShare)}</div>
            </div>
            <div className={styles.statEmpty} />
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableTop}
        >
          <h2 className={styles.tableTitle}>Stakeholder Breakdown</h2>
          <div className={styles.searchWrapper}>
            <input
              className={styles.searchInput}
              placeholder="Search stakeholder..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Stakeholder Name</th>
              <th>Department / Role</th>
              <th>Shares Held</th>
              <th>% of Pool</th>
              <th>Calculated Dividend</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(s => {
              const pct = totalShares ? (s.shares / totalShares) * 100 : 0;
              const calc = avgPerShare * s.shares;
              return (
                <tr key={s.id}>
                  <td className={styles.nameCell}>
                    <div className={styles.avatar}>{initials(s.name)}</div>
                    <div>
                      <div className={styles.name}>{s.name}</div>
                    </div>
                  </td>
                  <td>{s.role}</td>
                  <td>{s.shares.toLocaleString()}</td>
                  <td>{pct.toFixed(1)}%</td>
                  <td className={styles.linkValue}>{formatCurrency(calc)}</td>
                  <td>
                    <span className={s.status === 'Processed' ? styles.statusProcessed : styles.statusPending}>{s.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className={styles.tableFooter}>
          <div>Showing {Math.min(filtered.length, (page-1)*perPage + 1)} to {Math.min(filtered.length, page*perPage)} of {filtered.length} entries</div>
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>&lt;</button>
            <span className={styles.pageNumber}>{page}</span>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>&gt;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
