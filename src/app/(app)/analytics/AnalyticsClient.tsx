'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { formatCurrency } from '@/utils/formatters';

interface Point {
  label: string;
  amount: number;
}

interface AnalyticsData {
  totalRevenue: number;
  revenueChange: number;
  totalProfit: number;
  profitChange: number;
  totalOrders: number;
  ordersChange: number;
  monthly: Point[];
  weekly: Point[];
  topSelling: { rank: number; name: string; unitsSold: number; revenue: number }[];
}

function Change({ value }: { value: number }) {
  return (
    <span className={value >= 0 ? styles.changePositive : styles.changeNegative}>
      {value >= 0 ? '+' : ''}
      {value}%
    </span>
  );
}

const compact = (amount: number) =>
  amount >= 1000 ? `₱${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k` : `₱${Math.round(amount)}`;

export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const [timeframe, setTimeframe] = useState<'Weekly' | 'Monthly'>('Monthly');
  const [hovered, setHovered] = useState<number | null>(null);

  const points = timeframe === 'Monthly' ? data.monthly : data.weekly;
  const max = Math.max(1, ...points.map((point) => point.amount));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profit Analytics</h1>
        <p className={styles.subtitle}>This month so far, from the cooperative&apos;s books.</p>
      </header>

      <div className={styles.kpiRow}>
        <div className={`${styles.kpiCard} ${styles.borderBlue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>TOTAL REVENUE</span>
          </div>
          <div className={styles.kpiValue}>{formatCurrency(data.totalRevenue)}</div>
          <div className={styles.kpiChange}>
            <Change value={data.revenueChange} />
            <span className={styles.changeLabel}>vs last month</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.borderTeal}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>NET SURPLUS</span>
          </div>
          <div className={styles.kpiValue}>{formatCurrency(data.totalProfit)}</div>
          <div className={styles.kpiChange}>
            <Change value={data.profitChange} />
            <span className={styles.changeLabel}>vs last month</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.borderBlue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>TOTAL ORDERS</span>
          </div>
          <div className={styles.kpiValue}>{data.totalOrders.toLocaleString()}</div>
          <div className={styles.kpiChange}>
            <Change value={data.ordersChange} />
            <span className={styles.changeLabel}>vs last month</span>
          </div>
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.leftCol}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Revenue Over Time</h2>
            <div className={styles.toggle}>
              {(['Weekly', 'Monthly'] as const).map((option) => (
                <button
                  key={option}
                  className={`${styles.toggleBtn} ${timeframe === option ? styles.toggleBtnActive : ''}`}
                  onClick={() => {
                    setTimeframe(option);
                    setHovered(null);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.chartContainer}>
            {points.map((point, index) => (
              <div
                key={point.label}
                className={styles.chartBarWrapper}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === index && <div className={styles.tooltip}>{compact(point.amount)}</div>}
                <div
                  className={styles.chartBar}
                  style={{ height: `${Math.max(1, (point.amount / max) * 100)}%` }}
                  title={formatCurrency(point.amount)}
                />
                <span className={styles.chartLabel}>{point.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Top Selling Items</h2>
          </div>
          <div className={styles.rankingList}>
            {data.topSelling.map((item) => (
              <div key={item.rank} className={styles.rankingItem}>
                <div className={styles.rankBadge}>#{item.rank}</div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemSales}>{item.unitsSold} units sold</div>
                </div>
                <div className={styles.itemRevenue}>{formatCurrency(item.revenue)}</div>
              </div>
            ))}
            {data.topSelling.length === 0 && <div className={styles.itemSales}>No sales this month yet.</div>}
          </div>
          <Link href="/products" className={styles.viewAllBtn} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            View All Products &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
