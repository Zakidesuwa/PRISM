import { CalendarDays, Package, PackagePlus, PhilippinePeso, ShoppingCart, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';
import { requireBranchUser } from '@/lib/authGuard';
import { DashboardService } from '@/services/dashboardService';
import { formatCurrency, formatManilaTime } from '@/utils/formatters';
import { longDate, manilaToday, weekdayLabel } from '@/lib/dates';

/** Good morning / afternoon / evening, by the time in Manila. */
function greeting() {
  const hour = (new Date().getUTCHours() + 8) % 24;
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export const metadata = { title: 'Dashboard · PRISM' };

/** Short amount for a bar label: ₱953, ₱1.6k, ₱12k. */
function compactPeso(amount: number) {
  if (amount >= 10000) return `₱${Math.round(amount / 1000)}k`;
  if (amount >= 1000) return `₱${(amount / 1000).toFixed(1)}k`;
  return `₱${Math.round(amount)}`;
}

export default async function Dashboard() {
  const user = await requireBranchUser(['MANAGER']);
  const data = await DashboardService.getDashboard(user.branchId);

  const maxSales = Math.max(1, ...data.weeklySales.map((day) => day.amount));
  const weekTotal = data.weeklySales.reduce((sum, day) => sum + day.amount, 0);
  const tradingDays = data.weeklySales.filter((day) => day.amount > 0).length;
  const weekAverage = tradingDays > 0 ? weekTotal / tradingDays : 0;
  const up = data.salesChange >= 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className={styles.headerSub}>
            {weekdayLabel(manilaToday())}, {longDate(manilaToday())} · {user.branchName}
          </p>
        </div>
        {/* The jobs a manager does most often, one tap away. */}
        <nav className={styles.quickActions} aria-label="Quick actions">
          <Link href="/pos" className={styles.quickPrimary}>
            <ShoppingCart size={16} aria-hidden="true" />
            New sale
          </Link>
          <Link href="/inventory" className={styles.quickAction}>
            <PackagePlus size={16} aria-hidden="true" />
            Receive stock
          </Link>
          <Link href="/daily-sales?tab=cash" className={styles.quickAction}>
            <CalendarDays size={16} aria-hidden="true" />
            Count drawer
          </Link>
        </nav>
      </header>

      <div className={styles.grid}>
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Weekly Sales Trend</h2>
              <span className={styles.badge}>Last 7 days</span>
            </div>
            <div className={styles.chart}>
              {data.weeklySales.map((day, index) => {
                const isToday = index === data.weeklySales.length - 1;
                // The value label sits on top of the bar; leave room for it at the tallest.
                const height = (day.amount / maxSales) * 82;
                return (
                  <div key={day.date} className={styles.barGroup}>
                    <div className={styles.barTrack}>
                      <span className={styles.barValue}>{day.amount > 0 ? compactPeso(day.amount) : '—'}</span>
                      <div
                        className={`${styles.bar} ${isToday ? styles.barToday : ''}`}
                        style={{ height: `${height}%` }}
                        title={`${day.date}: ${formatCurrency(day.amount)}`}
                      />
                    </div>
                    <span className={`${styles.dayLabel} ${isToday ? styles.dayLabelToday : ''}`}>
                      {isToday ? 'Today' : day.day}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={styles.chartFooter}>
              <span>
                7-day total <strong>{formatCurrency(weekTotal)}</strong>
              </span>
              <span>
                Daily average <strong>{formatCurrency(weekAverage)}</strong> (days with sales)
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Popular Items</h2>
              <span className={styles.badge}>Last 30 days</span>
            </div>
            <div className={styles.popularGrid}>
              {data.popularItems.map((item) => (
                <div key={item.name} className={styles.popularItem}>
                  <div className={styles.emojiCircle}>
                    <Package size={18} color="#2563EB" aria-hidden="true" />
                  </div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemSold}>{item.sold} sold</span>
                  </div>
                </div>
              ))}
              {data.popularItems.length === 0 && <span className={styles.itemSold}>No sales yet.</span>}
            </div>
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Quick Stats</h2>
            </div>

            <div className={styles.statRow}>
              <div className={`${styles.statIcon} ${styles.iconSales}`}>
                <PhilippinePeso size={20} aria-hidden="true" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Today&apos;s Sales</div>
                <div className={styles.statValue}>{formatCurrency(data.todaySales)}</div>
                <div className={`${styles.statSub} ${up ? styles.green : styles.red}`}>
                  {up ? '↗' : '↘'} {Math.abs(data.salesChange)}% vs yesterday
                </div>
              </div>
            </div>

            <div className={styles.statRow}>
              <div className={`${styles.statIcon} ${styles.iconOrders}`}>
                <ShoppingCart size={20} aria-hidden="true" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Transactions Today</div>
                <div className={styles.statValue}>{data.todayTransactions}</div>
                <div className={`${styles.statSub} ${styles.gray}`}>Completed sales</div>
              </div>
            </div>

            <div className={styles.statRow}>
              <div className={`${styles.statIcon} ${styles.iconStock}`}>
                <TriangleAlert size={20} aria-hidden="true" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Low Stock Items</div>
                <div className={styles.statValue}>{data.lowStockItems}</div>
                <div className={`${styles.statSub} ${styles.red}`}>
                  <Link href="/inventory" className={styles.redLink}>View inventory list</Link>
                </div>
              </div>
            </div>

            <Link href="/daily-sales" className={styles.btnFullReport} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Open Daily Sales Report
            </Link>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Recent Transactions</h2>
              <Link href="/daily-sales" className={styles.link}>View All</Link>
            </div>
            <div className={styles.transactionList}>
              {data.recentTransactions.map((sale) => (
                <div key={sale.id} className={styles.transactionItem}>
                  <div className={styles.transLeft}>
                    <span className={styles.transId}>{sale.number}</span>
                    <span className={styles.transTime}>{formatManilaTime(sale.createdAt)}</span>
                  </div>
                  <div className={styles.transRight}>
                    <span className={styles.transAmount}>{formatCurrency(sale.amount)}</span>
                    <span className={`${styles.statusBadge} ${sale.status === 'COMPLETED' ? styles.statusCompleted : styles.statusPreparing}`}>
                      {sale.status === 'COMPLETED' ? 'Completed' : 'Voided'}
                    </span>
                  </div>
                </div>
              ))}
              {data.recentTransactions.length === 0 && <span className={styles.transTime}>No sales yet.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
