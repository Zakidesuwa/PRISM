'use client';

import React from 'react';
import styles from './page.module.css';
import { products } from '@/data/mockData';

export default function ProductsPage() {
  const getStockBadgeClass = (stock: number) => {
    if (stock >= 100) return styles.stockHigh;
    if (stock < 10) return styles.stockLow;
    return styles.stockMedium;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleContainer}>
          <h1>Products</h1>
          <p>Manage canteen inventory, pricing, and categories.</p>
        </div>
        <button className={styles.addButton}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add New Product
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search products by name or SKU..." 
              className={styles.searchInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <button className={styles.filterButton}>
              Category
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <button className={styles.filterButton}>
              Sort
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <input type="checkbox" className={styles.checkbox} />
                </th>
                <th>Product Info</th>
                <th>Category</th>
                <th>Price (₱)</th>
                <th>Stock Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className={styles.checkboxCell}>
                    <input type="checkbox" className={styles.checkbox} />
                  </td>
                  <td>
                    <div className={styles.productInfo}>
                      <div className={styles.productImage}>{product.image}</div>
                      <div className={styles.productDetails}>
                        <span className={styles.productName}>{product.name}</span>
                        <span className={styles.productSku}>SKU: {product.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.category}>{product.category}</span>
                  </td>
                  <td>
                    <span className={styles.price}>₱{product.price.toFixed(2)}</span>
                  </td>
                  <td>
                    <span className={`${styles.stockBadge} ${getStockBadgeClass(product.stock)}`}>
                      {product.stock} Units
                    </span>
                  </td>
                  <td>
                    <button className={styles.actionButton}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <div className={styles.showingText}>Showing 1 to 4 of 24 entries</div>
          <div className={styles.pagination}>
            <button className={styles.pageButton}>1</button>
            <button className={`${styles.pageButton} ${styles.active}`}>2</button>
            <button className={styles.pageButton}>3</button>
            <button className={styles.pageButton}>...</button>
            <button className={styles.pageButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
