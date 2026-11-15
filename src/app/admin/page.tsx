import { summaryStats, type SummaryStat } from '@/data/adminMockData';
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" />
    </svg>
  ),
  Income: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
    </svg>
  ),
  Expenses: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" />
    </svg>
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

export default function AdminDashboardPage() {
  return (
    <div className={styles.page}>
      <div className={styles.statsRow}>
        {summaryStats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className={styles.mainCol}>
        <FinancialChart />
      </div>

      <div className={styles.sideCol}>
        <TopPerformersCard />
      </div>
    </div>
  );
}
