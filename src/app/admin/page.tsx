import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { SummaryStat } from '@/lib/adminTypes';
import { AdminService } from '@/services/adminService';
import FinancialChart from './FinancialChart';
import TopPerformersCard from './TopPerformersCard';
import styles from './page.module.css';

function formatPeso(amount: number, fractionDigits = 2) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatChange(change: number) {
  return `${Math.abs(change).toFixed(2)}%`;
}

const STAT_ICONS: Record<string, React.ReactNode> = {
  'Total Balance': (
    <Wallet size={18} aria-hidden="true" />
  ),
  Income: (
    <TrendingUp size={18} aria-hidden="true" />
  ),
  Expenses: (
    <TrendingDown size={18} aria-hidden="true" />
  ),
};

function StatCard({ stat }: { stat: SummaryStat }) {
  const isUp = stat.change >= 0;

  return (
    <article className={styles.statCard}>
      <div className={styles.statLabelRow}>
        <span className={styles.statIcon}>{STAT_ICONS[stat.label]}</span>
        <span className={styles.statLabel}>{stat.label}</span>
      </div>
      <p className={styles.statValue}>{formatPeso(stat.value)}</p>
      <div className={styles.statFooter}>
        <span className={styles.statCaption}>{stat.caption}</span>
        <span className={`${styles.statChange} ${isUp ? styles.up : styles.down}`}>
          {isUp ? '↑' : '↓'} {formatChange(stat.change)}
        </span>
      </div>
    </article>
  );
}

export default async function AdminDashboardPage() {
  const [overview, leaderboard] = await Promise.all([AdminService.getOverview(), AdminService.getLeaderboard()]);

  return (
    <div className={styles.page}>
      <div className={styles.statsRow}>
        {overview.stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className={styles.mainCol}>
        <FinancialChart data={overview.flows} />
      </div>

      <div className={styles.sideCol}>
        <TopPerformersCard leaderboard={leaderboard} />
      </div>
    </div>
  );
}
