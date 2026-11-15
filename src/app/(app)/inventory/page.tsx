'use client';

import React from 'react';
import styles from './page.module.css';
import { inventory } from '@/data/mockData';

export default function InventoryPage() {
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Low Stock':
        return styles.statusLow;
      case 'Optimal':
        return styles.statusOptimal;
      case 'Empty':
        return styles.statusEmpty;
      default:
        return styles.statusOptimal;
    }
  };

  const getStockClass = (status: string) => {
    return status === 'Low Stock' || status === 'Empty' ? styles.low : styles.normal;
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search SKU, Item Name..." 
              className={styles.searchInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <button className={styles.filterButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter
            </button>
            <button className={styles.filterButton}>
              Category
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <button className={styles.filterButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export
            </button>
            <button className={styles.addButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Stock
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
                <th>Item Details</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Unit Price (₱)</th>
                <th>In Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td className={styles.checkboxCell}>
                    <input type="checkbox" className={styles.checkbox} />
                  </td>
                  <td>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                          <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                      </div>
                      <div className={styles.itemDetails}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemPackaging}>{item.packaging}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.sku}>{item.sku}</span>
                  </td>
                  <td>
                    <span className={styles.categoryBadge}>{item.category}</span>
                  </td>
                  <td>
                    <div className={styles.supplierInfo}>
                      <span className={styles.supplierName}>{item.supplier}</span>
                      <span className={styles.supplierDays}>{item.deliveryDays}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.price}>₱{item.price.toFixed(2)}</span>
                  </td>
                  <td>
                    <span className={`${styles.stockInfo} ${getStockClass(item.status)}`}>
                      {item.stock} {item.unit}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusClass(item.status)}`}>
                      <span className={styles.statusDot}></span>
                      {item.status}
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
          <div className={styles.showingText}>Showing 1 to 4 of 128 items</div>
          <div className={styles.pagination}>
            <button className={styles.pageButton}>1</button>
            <button className={`${styles.pageButton} ${styles.active}`}>2</button>
            <button className={styles.pageButton}>3</button>
            <button className={styles.pageButton}>...</button>
            <button className={styles.pageButton}>12</button>
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
