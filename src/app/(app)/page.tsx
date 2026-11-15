'use client';

import React from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { weeklySales, quickStats, popularItems, recentTransactions } from '@/data/mockData';

export default function Dashboard() {
  // Find max sales to calculate bar heights
  const maxSales = Math.max(...weeklySales.map(d => d.amount));

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Dashboard</h1>
      </header>

      <div className={styles.grid}>
        {/* Left Column */}
        <div className={styles.leftCol}>
          {/* Weekly Sales Trend */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Weekly Sales Trend</h2>
              <span className={styles.badge}>This Week</span>
            </div>
            <div className={styles.chart}>
              {weeklySales.map((data, index) => {
                const heightPercent = (data.amount / maxSales) * 100;
                return (
                  <div key={index} className={styles.barGroup}>
                    <div 
                      className={styles.bar} 
                      style={{ height: `${heightPercent}%` }}
                      title={formatCurrency(data.amount)}
                    />
                    <span className={styles.dayLabel}>{data.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Popular Items */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Popular Items</h2>
            </div>
            <div className={styles.popularGrid}>
              {popularItems.map((item, index) => (
                <div key={index} className={styles.popularItem}>
                  <div className={styles.emojiCircle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemSold}>{item.sold} sold</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightCol}>
          {/* Quick Stats */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Quick Stats</h2>
            </div>
            
            <div className={styles.statRow}>
              <div className={`${styles.statIcon} ${styles.iconSales}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Today&apos;s Sales</div>
                <div className={styles.statValue}>{formatCurrency(quickStats.todaySales)}</div>
                <div className={`${styles.statSub} ${styles.green}`}>
                  ↗ {quickStats.salesChange} vs yesterday
                </div>
              </div>
            </div>

            <div className={styles.statRow}>
              <div className={`${styles.statIcon} ${styles.iconOrders}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Active Orders</div>
                <div className={styles.statValue}>{quickStats.activeOrders}</div>
                <div className={`${styles.statSub} ${styles.gray}`}>
                  Currently preparing
                </div>
              </div>
            </div>

            <div className={styles.statRow}>
              <div className={`${styles.statIcon} ${styles.iconStock}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Low Stock Items</div>
                <div className={styles.statValue}>{quickStats.lowStockItems}</div>
                <div className={`${styles.statSub} ${styles.red}`}>
                  <Link href="/inventory" className={styles.redLink}>View inventory list</Link>
                </div>
              </div>
            </div>

            <button className={styles.btnFullReport}>Generate Full Report</button>
          </div>

          {/* Recent Transactions */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Recent Transactions</h2>
              <Link href="/transactions" className={styles.link}>View All</Link>
            </div>
            <div className={styles.transactionList}>
              {recentTransactions.map((tx, index) => (
                <div key={index} className={styles.transactionItem}>
                  <div className={styles.transLeft}>
                    <span className={styles.transId}>{tx.id}</span>
                    <span className={styles.transTime}>{tx.time}</span>
                  </div>
                  <div className={styles.transRight}>
                    <span className={styles.transAmount}>{formatCurrency(tx.amount)}</span>
                    <span className={`${styles.statusBadge} ${tx.status === 'Completed' ? styles.statusCompleted : styles.statusPreparing}`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pagination}>
        <button className={styles.pageArrow}>&lt;</button>
        <button className={styles.pageArrow}>&gt;</button>
      </div>
    </div>
  );
}
