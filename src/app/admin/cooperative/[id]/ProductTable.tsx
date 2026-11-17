'use client';

import React, { useMemo, useState } from 'react';
import type { ProductCategory, ProductLine, ProductStatus } from '@/lib/adminTypes';
import styles from './page.module.css';

const INITIAL_ROWS = 5;
const LOAD_STEP = 5;

type CategoryFilter = 'All Categories' | ProductCategory;

const STATUS_CLASS: Record<ProductStatus, string> = {
  'In Stock': styles.inStock,
  'Low Stock': styles.lowStock,
  'Out of Stock': styles.outOfStock,
};

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ProductTable({ products }: { products: ProductLine[] }) {
  const [category, setCategory] = useState<CategoryFilter>('All Categories');
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort(),
    [products]
  );

  const filtered = useMemo(
    () =>
      category === 'All Categories'
        ? products
        : products.filter((product) => product.category === category),
    [products, category]
  );

  const rows = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Product Profitability</h2>

        <label className={styles.selectWrap}>
          <span className={styles.srOnly}>Filter by category</span>
          <select
            className={styles.select}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as CategoryFilter);
              setVisibleCount(INITIAL_ROWS);
            }}
          >
            <option>All Categories</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Product Name</th>
              <th scope="col">Category</th>
              <th scope="col" className={styles.alignRight}>Cost Price</th>
              <th scope="col" className={styles.alignRight}>Selling Price</th>
              <th scope="col" className={styles.alignRight}>Net Profit / Unit</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyRow}>
                  No products in this category.
                </td>
              </tr>
            )}

            {rows.map((product) => (
              <tr key={product.id}>
                <td className={styles.productName}>{product.name}</td>
                <td>{product.category}</td>
                <td className={`${styles.money} ${styles.alignRight}`}>
                  {formatPeso(product.costPrice)}
                </td>
                <td className={`${styles.money} ${styles.alignRight}`}>
                  {formatPeso(product.sellingPrice)}
                </td>
                <td className={`${styles.money} ${styles.alignRight} ${styles.netProfit}`}>
                  {formatPeso(product.sellingPrice - product.costPrice)}
                </td>
                <td>
                  <span className={`${styles.statusPill} ${STATUS_CLASS[product.status]}`}>
                    {product.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableFooter}>
        {hasMore ? (
          <button
            type="button"
            className={styles.loadMore}
            onClick={() => setVisibleCount((count) => count + LOAD_STEP)}
          >
            Load More Inventory Data
          </button>
        ) : (
          <span className={styles.footerNote}>
            Showing all {filtered.length} products
          </span>
        )}
      </div>
    </section>
  );
}
