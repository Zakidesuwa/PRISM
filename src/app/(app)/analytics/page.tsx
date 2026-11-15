'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { profitAnalytics, topSellingItems, revenueOverTime } from '@/data/mockData';

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<'Weekly' | 'Monthly'>('Monthly');

  // Hardcoded for the prototype to match mockup chart relative heights
  const chartHeights = [40, 50, 90, 60, 70, 55]; // Percentages

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profit Analytics</h1>
        <p className={styles.subtitle}>Overview of financial performance and top sales.</p>
      </header>

      <div className={styles.kpiRow}>
        <div className={`${styles.kpiCard} ${styles.borderBlue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>TOTAL REVENUE</span>
            <span className={styles.kpiIcon}>💰</span>
          </div>
          <div className={styles.kpiValue}>₱{(profitAnalytics.totalRevenue).toLocaleString()}</div>
          <div className={styles.kpiChange}>
            <span className={styles.changePositive}>{profitAnalytics.revenueChange}</span>
            <span className={styles.changeLabel}>vs last month</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.borderTeal}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>TOTAL PROFIT</span>
            <span className={styles.kpiIcon}>📈</span>
          </div>
          <div className={styles.kpiValue}>₱{(profitAnalytics.totalProfit).toLocaleString()}</div>
          <div className={styles.kpiChange}>
            <span className={styles.changePositive}>{profitAnalytics.profitChange}</span>
            <span className={styles.changeLabel}>vs last month</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.borderBlue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>TOTAL ORDERS</span>
            <span className={styles.kpiIcon}>🧾</span>
          </div>
          <div className={styles.kpiValue}>{(profitAnalytics.totalOrders).toLocaleString()}</div>
          <div className={styles.kpiChange}>
            <span className={styles.changeNegative}>{profitAnalytics.ordersChange}</span>
            <span className={styles.changeLabel}>vs last month</span>
          </div>
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.leftCol}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Revenue Over Time</h2>
            <div className={styles.toggle}>
              <button 
                className={`${styles.toggleBtn} ${timeframe === 'Weekly' ? styles.toggleBtnActive : ''}`}
                onClick={() => setTimeframe('Weekly')}
              >
                Weekly
              </button>
              <button 
                className={`${styles.toggleBtn} ${timeframe === 'Monthly' ? styles.toggleBtnActive : ''}`}
                onClick={() => setTimeframe('Monthly')}
              >
                Monthly
              </button>
            </div>
          </div>
          
          <div className={styles.chartContainer}>
            {revenueOverTime.map((data, index) => (
              <div key={data.month} className={styles.chartBarWrapper}>
                {data.month === 'Mar' && (
                  <div className={styles.tooltip}>₱28k</div>
                )}
                <div 
                  className={styles.chartBar} 
                  style={{ height: `${chartHeights[index]}%` }}
                />
                <span className={styles.chartLabel}>{data.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Top Selling Items</h2>
          </div>
          <div className={styles.rankingList}>
            {topSellingItems.map((item) => (
              <div key={item.rank} className={styles.rankingItem}>
                <div className={styles.rankBadge}>#{item.rank}</div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemSales}>{item.unitsSold} units sold</div>
                </div>
                <div className={styles.itemRevenue}>₱{(item.revenue).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <button className={styles.viewAllBtn}>View All Products &rarr;</button>
        </div>
      </div>

      <div className={styles.pagination}>
        <button className={styles.pageArrow}>&lt;</button>
        <button className={styles.pageArrow}>&gt;</button>
      </div>
    </div>
  );
}
