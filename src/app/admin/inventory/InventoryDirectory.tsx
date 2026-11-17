'use client';

import { ChevronLeft, ChevronRight, CupSoda, Download, ListFilter, PenTool, ShoppingCart, TrendingUp, TriangleAlert, Utensils } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  stockRatio,
  stockStatus,
  type DistrictInventoryItem as InventoryItem,
  type DistrictInventoryStats,
  type StockLevelStatus,
} from '@/lib/adminTypes';
import styles from './page.module.css';

const PER_PAGE = 10;

const ALL_COOPS = 'All District Schools';
const ALL_CATEGORIES = 'All Categories';
const ANY_STATUS = 'Any Status';

const STATUS_STYLE: Record<StockLevelStatus, { text: string; fill: string }> = {
  'In Stock': { text: styles.inStockText, fill: styles.inStockFill },
  'Reorder Soon': { text: styles.reorderText, fill: styles.reorderFill },
  'Low Stock': { text: styles.lowText, fill: styles.lowFill },
  'Out of Stock': { text: styles.outText, fill: styles.outFill },
};

type InventoryCategory = 'Food' | 'Beverage' | 'Stationery';

/** Any category name falls into one of the three thumbnail styles. */
function thumbKey(category: string): InventoryCategory {
  const name = category.toLowerCase();
  if (name.includes('bever') || name.includes('drink')) return 'Beverage';
  if (name.includes('suppl') || name.includes('station')) return 'Stationery';
  return 'Food';
}

const THUMB_STYLE: Record<InventoryCategory, string> = {
  Food: styles.thumbFood,
  Beverage: styles.thumbBeverage,
  Stationery: styles.thumbStationery,
};

const THUMB_ICON: Record<InventoryCategory, React.ReactNode> = {
  Food: (
    <Utensils size={18} aria-hidden="true" />
  ),
  Beverage: (
    <CupSoda size={18} aria-hidden="true" />
  ),
  Stationery: (
    <PenTool size={18} aria-hidden="true" />
  ),
};

function formatPeso(amount: number, fractionDigits = 2) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

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

function toCsv(rows: InventoryItem[]) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const header = [
    'Product Name', 'SKU', 'Category', 'Cooperative',
    'On Hand', 'Capacity', 'Status', 'Cost Price', 'Selling Price', 'Profit Per Unit',
  ];

  const body = rows.map((row) =>
    [
      row.name, row.sku, row.category, row.cooperative,
      row.onHand, row.capacity, stockStatus(row),
      row.costPrice.toFixed(2), row.sellingPrice === null ? '' : row.sellingPrice.toFixed(2),
      row.sellingPrice === null ? '' : (row.sellingPrice - row.costPrice).toFixed(2),
    ].map(escape).join(',')
  );

  return [header.map(escape).join(','), ...body].join('\r\n');
}

export default function InventoryDirectory({
  items: inventoryItems,
  stats: inventoryStats,
  cooperatives: inventoryCooperatives,
}: {
  items: InventoryItem[];
  stats: DistrictInventoryStats;
  cooperatives: string[];
}) {
  const [coop, setCoop] = useState(ALL_COOPS);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [status, setStatus] = useState(ANY_STATUS);
  const [page, setPage] = useState(1);


  const hasFilters = coop !== ALL_COOPS || category !== ALL_CATEGORIES || status !== ANY_STATUS;

  const visible = useMemo(
    () =>
      inventoryItems.filter((item) => {
        if (coop !== ALL_COOPS && item.cooperative !== coop) return false;
        if (category !== ALL_CATEGORIES && item.category !== category) return false;
        if (status !== ANY_STATUS && stockStatus(item) !== status) return false;
        return true;
      }),
    [coop, category, status, inventoryItems]
  );

  const categories = useMemo(
    () => Array.from(new Set(inventoryItems.map((item) => item.category))).sort(),
    [inventoryItems]
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const rows = visible.slice(start, start + PER_PAGE);

  function clearFilters() {
    setCoop(ALL_COOPS);
    setCategory(ALL_CATEGORIES);
    setStatus(ANY_STATUS);
    setPage(1);
  }

  function handleExport() {
    const blob = new Blob([toCsv(visible)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'district-inventory.csv';
    link.click();

    URL.revokeObjectURL(url);
  }


  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>District Inventory</h1>
          <p className={styles.subtitle}>
            Real-time oversight of resources across all {inventoryStats.cooperativeCount} educational
            cooperatives.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.ghostBtn} onClick={handleExport}>
            <Download size={14} aria-hidden="true" />
            Export
          </button>

        </div>
      </div>

      <div className={styles.statsRow}>
        <article className={`${styles.statCard} ${styles.statCritical}`}>
          <span className={`${styles.statIcon} ${styles.iconCritical}`}>
            <TriangleAlert size={20} aria-hidden="true" />
          </span>
          <div>
            <p className={styles.statLabel}>Critical Stock Alert</p>
            <p className={styles.statValue}>{inventoryStats.itemsOut} Items Out</p>
          </div>
        </article>

        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.iconValuation}`}>
            <TrendingUp size={20} aria-hidden="true" />
          </span>
          <div>
            <p className={styles.statLabel}>Total Valuation</p>
            <p className={styles.statValue}>{formatPeso(inventoryStats.totalValuation)}</p>
          </div>
        </article>

        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.iconRequests}`}>
            <ShoppingCart size={20} aria-hidden="true" />
          </span>
          <div>
            <p className={styles.statLabel}>Needs Reorder</p>
            <p className={styles.statValue}>{inventoryStats.needsReorder} Lines</p>
          </div>
        </article>
      </div>

      <div className={styles.filterBar}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Cooperative</span>
          <select
            className={styles.select}
            value={coop}
            onChange={(event) => { setCoop(event.target.value); setPage(1); }}
          >
            <option>{ALL_COOPS}</option>
            {inventoryCooperatives.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Category</span>
          <select
            className={styles.select}
            value={category}
            onChange={(event) => { setCategory(event.target.value); setPage(1); }}
          >
            <option>{ALL_CATEGORIES}</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Stock Status</span>
          <select
            className={styles.select}
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
          >
            <option>{ANY_STATUS}</option>
            <option>In Stock</option>
            <option>Reorder Soon</option>
            <option>Low Stock</option>
            <option>Out of Stock</option>
          </select>
        </label>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={clearFilters}
          disabled={!hasFilters}
        >
          <ListFilter size={14} aria-hidden="true" />
          Clear Filters
        </button>
      </div>

      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Product Name</th>
                <th scope="col">Category</th>
                <th scope="col">Cooperative</th>
                <th scope="col">Stock Level</th>
                <th scope="col" className={styles.alignRight}>Cost Price</th>
                <th scope="col" className={styles.alignRight}>Selling Price</th>
                <th scope="col" className={styles.alignRight}>Profit/Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>
                    No inventory matches these filters.
                  </td>
                </tr>
              )}

              {rows.map((item) => {
                const itemStatus = stockStatus(item);
                const style = STATUS_STYLE[itemStatus];

                return (
                  <tr key={item.id}>
                    <td>
                      <div className={styles.productCell}>
                        <span className={`${styles.thumb} ${THUMB_STYLE[thumbKey(item.category)]}`}>
                          {THUMB_ICON[thumbKey(item.category)]}
                        </span>
                        <span className={styles.productText}>
                          <span className={styles.productName} title={item.name}>{item.name}</span>
                          <span className={styles.productSku}>SKU: {item.sku}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.categoryBadge}>{item.category}</span>
                    </td>
                    <td className={styles.coopCell}>{item.cooperative}</td>
                    <td className={styles.stockCell}>
                      <div className={styles.stockTop}>
                        <span className={styles.stockCount}>
                          {item.onHand}/{item.capacity}
                        </span>
                        <span className={`${styles.stockBadge} ${style.text}`}>{itemStatus}</span>
                      </div>
                      <div className={styles.meter}>
                        <div
                          className={`${styles.meterFill} ${style.fill}`}
                          style={{ width: `${stockRatio(item) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className={`${styles.money} ${styles.alignRight}`}>
                      {formatPeso(item.costPrice)}
                    </td>
                    <td className={`${styles.money} ${styles.alignRight}`}>
                      {item.sellingPrice === null ? '—' : formatPeso(item.sellingPrice)}
                    </td>
                    <td className={`${styles.money} ${styles.profit} ${styles.alignRight}`}>
                      {item.sellingPrice === null ? '—' : formatPeso(item.sellingPrice - item.costPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerText}>
            {visible.length === 0
              ? 'No items to show'
              : `Showing ${start + 1} to ${Math.min(start + PER_PAGE, visible.length)} of ${visible.length} items`}
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
