import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCooperativeDetail, findCooperative } from '@/data/cooperativeDetailData';
import HeaderActions from './HeaderActions';
import TurnoverChart from './TurnoverChart';
import ProductTable from './ProductTable';
import StoreOverviewSection from './StoreOverviewSection';
import styles from './page.module.css';

interface PageProps {
  // `params` is a promise in Next.js 16 and must be awaited.
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const coop = findCooperative(Number(id));

  return {
    title: coop ? `${coop.name} · PRISM Management System` : 'Cooperative · PRISM Management System',
  };
}

function formatPeso(amount: number, fractionDigits = 2) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export default async function CooperativeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const coop = findCooperative(Number(id));

  if (!coop) {
    notFound();
  }

  const detail = getCooperativeDetail(coop);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Link href="/admin/cooperative" className={styles.backLink}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to directory
          </Link>
          <h1 className={styles.schoolTitle}>{coop.name}</h1>
          <p className={styles.schoolMeta}>
            Performance Analysis · Last updated: {detail.lastUpdated}
          </p>
        </div>

        <HeaderActions />
      </div>

      <div className={styles.statsRow}>
        <article className={`${styles.statCard} ${styles.tintBlue}`}>
          <p className={styles.statLabel}>Monthly Sales</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{formatPeso(detail.monthlySales)}</span>
            <span className={`${styles.chip} ${styles.chipUp}`}>↑{detail.salesChange}%</span>
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.tintIndigo}`}>
          <p className={styles.statLabel}>Net Profit</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{formatPeso(detail.netProfit)}</span>
            <span className={`${styles.chip} ${styles.chipUp}`}>↑{detail.profitChange}%</span>
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.tintGreen}`}>
          <p className={styles.statLabel}>Efficiency Ratio</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{detail.efficiencyRatio.toFixed(1)}%</span>
            <span className={`${styles.chip} ${styles.chipNeutral}`}>Stable</span>
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.tintRed}`}>
          <p className={styles.statLabel}>Low Stock Items</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{detail.lowStockItems}</span>
            <span className={`${styles.chip} ${styles.chipCritical}`}>Critical</span>
          </div>
        </article>
      </div>

      <div className={styles.middleRow}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Sales vs. Inventory Turnover</h2>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dotSales}`} />
                Sales
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dotInventory}`} />
                Inventory
              </span>
            </div>
          </div>

          <TurnoverChart data={detail.turnover} />
        </section>

        <StoreOverviewSection
          schoolName={coop.name}
          storeLocation={detail.storeLocation}
          skuCount={detail.skuCount}
          categoryCount={detail.categoryCount}
        />
      </div>

      <ProductTable products={detail.products} />
    </div>
  );
}
