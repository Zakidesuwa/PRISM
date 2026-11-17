import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { AdminService } from '@/services/adminService';
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
  const coop = Number.isInteger(Number(id))
    ? await prisma.schoolBranch.findUnique({ where: { id: Number(id) }, select: { name: true } })
    : null;

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
  const detail = Number.isInteger(Number(id)) ? await AdminService.getCooperativeDetail(Number(id)) : null;

  if (!detail) {
    notFound();
  }

  const coop = detail.coop;
  const chip = (change: number) => (
    <span className={`${styles.chip} ${change >= 0 ? styles.chipUp : styles.chipCritical}`}>
      {change >= 0 ? '↑' : '↓'}
      {Math.abs(change)}%
    </span>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Link href="/admin/cooperative" className={styles.backLink}>
            <ChevronLeft size={13} strokeWidth={2.5} aria-hidden="true" />
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
          <p className={styles.statLabel}>Sales This Month</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{formatPeso(detail.monthlySales)}</span>
            {chip(detail.salesChange)}
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.tintIndigo}`}>
          <p className={styles.statLabel}>Net Surplus This Month</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{formatPeso(detail.netProfit)}</span>
            {chip(detail.profitChange)}
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.tintGreen}`}>
          <p className={styles.statLabel}>Gross Margin</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{detail.efficiencyRatio.toFixed(1)}%</span>
            <span className={`${styles.chip} ${styles.chipNeutral}`}>Of sales</span>
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.tintRed}`}>
          <p className={styles.statLabel}>Low Stock Items</p>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{detail.lowStockItems}</span>
            <span className={`${styles.chip} ${detail.lowStockItems > 0 ? styles.chipCritical : styles.chipNeutral}`}>
              {detail.lowStockItems > 0 ? 'Critical' : 'Healthy'}
            </span>
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
