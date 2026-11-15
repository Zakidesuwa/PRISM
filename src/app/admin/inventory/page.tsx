'use client';

import React, { useMemo, useState } from 'react';
import {
  DISTRICT_WIDE,
  inventoryCooperatives,
  inventoryItems,
  inventoryStats,
  stockRatio,
  stockStatus,
  type InventoryCategory,
  type InventoryItem,
  type StockLevelStatus,
} from '@/data/inventoryMockData';
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

const THUMB_STYLE: Record<InventoryCategory, string> = {
  Food: styles.thumbFood,
  Beverage: styles.thumbBeverage,
  Stationery: styles.thumbStationery,
};

const THUMB_ICON: Record<InventoryCategory, React.ReactNode> = {
  Food: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h1a2 2 0 0 0 2-2V2" /><line x1="5" y1="2" x2="5" y2="22" /><path d="M17 2a4 4 0 0 0-4 4v6h4v10" />
    </svg>
  ),
  Beverage: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2h8l-1 6v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V8z" /><line x1="8.5" y1="8" x2="15.5" y2="8" />
    </svg>
  ),
  Stationery: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><line x1="2" y1="2" x2="9.6" y2="9.6" />
    </svg>
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
      row.costPrice.toFixed(2), row.sellingPrice.toFixed(2),
      (row.sellingPrice - row.costPrice).toFixed(2),
    ].map(escape).join(',')
  );

  return [header.map(escape).join(','), ...body].join('\r\n');
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(15, 23, 42, 0.6)',
  padding: 24,
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  backgroundColor: '#ffffff',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

export default function AdminInventoryPage() {
  const [coop, setCoop] = useState(ALL_COOPS);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [status, setStatus] = useState(ANY_STATUS);
  const [page, setPage] = useState(1);

  // Restock Request Modal state
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockCoop, setRestockCoop] = useState(inventoryCooperatives[0] || 'Gordon College');
  const [restockItemName, setRestockItemName] = useState('San Miguel Bottled Water 500ml');
  const [restockQuantity, setRestockQuantity] = useState(50);
  const [restockPriority, setRestockPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const hasFilters = coop !== ALL_COOPS || category !== ALL_CATEGORIES || status !== ANY_STATUS;

  const visible = useMemo(
    () =>
      inventoryItems.filter((item) => {
        if (coop !== ALL_COOPS && item.cooperative !== coop) return false;
        if (category !== ALL_CATEGORIES && item.category !== category) return false;
        if (status !== ANY_STATUS && stockStatus(item) !== status) return false;
        return true;
      }),
    [coop, category, status]
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

  function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsRestockModalOpen(false);
    setToastMessage(`Restock request submitted: ${restockQuantity}x ${restockItemName} for ${restockCoop}`);
    setTimeout(() => setToastMessage(null), 3500);
  }

  return (
    <div className={styles.page}>
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            padding: '12px 20px',
            backgroundColor: '#10B981',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          }}
        >
          ✓ {toastMessage}
        </div>
      )}

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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setIsRestockModalOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Restock Request
          </button>
        </div>
      </div>

      <div className={styles.statsRow}>
        <article className={`${styles.statCard} ${styles.statCritical}`}>
          <span className={`${styles.statIcon} ${styles.iconCritical}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div>
            <p className={styles.statLabel}>Critical Stock Alert</p>
            <p className={styles.statValue}>{inventoryStats.itemsOut} Items Out</p>
          </div>
        </article>

        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.iconValuation}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
            </svg>
          </span>
          <div>
            <p className={styles.statLabel}>Total Valuation</p>
            <p className={styles.statValue}>{formatPeso(inventoryStats.totalValuation)}</p>
          </div>
        </article>

        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.iconRequests}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </span>
          <div>
            <p className={styles.statLabel}>Active Requests</p>
            <p className={styles.statValue}>{inventoryStats.pendingRequests} Pending</p>
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
            <option>{DISTRICT_WIDE}</option>
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
            <option>Food</option>
            <option>Beverage</option>
            <option>Stationery</option>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
          </svg>
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
                        <span className={`${styles.thumb} ${THUMB_STYLE[item.category]}`}>
                          {THUMB_ICON[item.category]}
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
                      {formatPeso(item.sellingPrice)}
                    </td>
                    <td className={`${styles.money} ${styles.profit} ${styles.alignRight}`}>
                      {formatPeso(item.sellingPrice - item.costPrice)}
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Restock Request Modal */}
      {isRestockModalOpen && (
        <div
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRestockModalOpen(false);
          }}
        >
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Create Restock Request</h3>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>Dispatch inventory to school canteen</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Target Cooperative School
                </label>
                <select
                  value={restockCoop}
                  onChange={(e) => setRestockCoop(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #D1D5DB',
                    fontSize: 13,
                    color: '#111827',
                  }}
                >
                  {inventoryCooperatives.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Item to Restock
                </label>
                <select
                  value={restockItemName}
                  onChange={(e) => setRestockItemName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #D1D5DB',
                    fontSize: 13,
                    color: '#111827',
                  }}
                >
                  {inventoryItems.slice(0, 15).map((i) => (
                    <option key={i.id} value={i.name}>
                      {i.name} ({i.category})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      fontSize: 13,
                      color: '#111827',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Priority Level
                  </label>
                  <select
                    value={restockPriority}
                    onChange={(e) => setRestockPriority(e.target.value as 'Normal' | 'High' | 'Urgent')}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      fontSize: 13,
                      color: '#111827',
                    }}
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#2563EB',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Submit Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
