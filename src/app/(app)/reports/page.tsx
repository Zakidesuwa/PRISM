"use client";

import React, { useMemo, useState } from 'react';
import styles from './page.module.css';

type ReportType = 'sales' | 'inventory' | 'profitability';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [datePreset, setDatePreset] = useState<'today'|'yesterday'|'thisWeek'|'thisMonth' | 'custom'>('thisWeek');
  const [startDate, setStartDate] = useState('2023-10-01');
  const [endDate, setEndDate] = useState('2023-10-07');
  const [category, setCategory] = useState('All Categories');
  const [user, setUser] = useState('All Users');

  const recordCount = useMemo(() => {
    // Mocked number based on selection — realistic static value for prototype
    return 1245;
  }, [reportType, datePreset, startDate, endDate, category, user]);

  function downloadCSV() {
    const csv = 'id,amount\n1,100\n2,200';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPDF() {
    // Stub: in a real app generate PDF server-side or via client library
    alert('Download PDF (stub)');
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.pageTitle}>Generate Reports</h1>
      <p className={styles.pageSubtitle}>Select the report type and date range to export your data.</p>

      <div className={styles.grid}>
        <div className={styles.leftCol}>
          <section className={styles.card}>
            <h3 className={styles.sectionTitle}>1 Select Report Type</h3>
            <div className={styles.typeGrid}>
              <button
                className={`${styles.typeCard} ${reportType === 'sales' ? styles.typeActive : ''}`}
                onClick={() => setReportType('sales')}
              >
                <div className={styles.typeIcon}>📄</div>
                <div className={styles.typeLabel}>Sales Report</div>
                <div className={styles.typeDesc}>Daily transaction details</div>
              </button>

              <button
                className={`${styles.typeCard} ${reportType === 'inventory' ? styles.typeActive : ''}`}
                onClick={() => setReportType('inventory')}
              >
                <div className={styles.typeIcon}>📦</div>
                <div className={styles.typeLabel}>Inventory</div>
                <div className={styles.typeDesc}>Stock levels & movement</div>
              </button>

              <button
                className={`${styles.typeCard} ${reportType === 'profitability' ? styles.typeActive : ''}`}
                onClick={() => setReportType('profitability')}
              >
                <div className={styles.typeIcon}>📈</div>
                <div className={styles.typeLabel}>Profitability</div>
                <div className={styles.typeDesc}>Margins & revenue analysis</div>
              </button>
            </div>
          </section>

          <section className={styles.card}>
            <h3 className={styles.sectionTitle}>Optional Filters</h3>
            <div className={styles.filtersRow}>
              <label className={styles.field}>
                <div className={styles.fieldLabel}>Category</div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={styles.select}>
                  <option>All Categories</option>
                  <option>Hot Meals</option>
                  <option>Beverages</option>
                </select>
              </label>

              <label className={styles.field}>
                <div className={styles.fieldLabel}>Cashier / User</div>
                <select value={user} onChange={(e) => setUser(e.target.value)} className={styles.select}>
                  <option>All Users</option>
                  <option>Jane Doe</option>
                  <option>John Smith</option>
                </select>
              </label>
            </div>
          </section>

          <div className={styles.bottomActionsWrap}>
            <div className={styles.recordInfo}>
              Report will include {recordCount.toLocaleString()} records based on current selection.
            </div>
            <div className={styles.actions}>
              <button className={styles.ghostBtn} onClick={downloadCSV}>CSV</button>
              <button className={styles.primaryBtn} onClick={downloadPDF}>Download PDF</button>
            </div>
          </div>
        </div>

        <aside className={styles.rightCol}>
          <section className={styles.cardSidebar}>
            <h3 className={styles.sectionTitle}>2 Date Range</h3>
            <div className={styles.presetRow}>
              <button className={`${styles.presetBtn} ${datePreset === 'today' ? styles.presetActive : ''}`} onClick={() => setDatePreset('today')}>Today</button>
              <button className={`${styles.presetBtn} ${datePreset === 'yesterday' ? styles.presetActive : ''}`} onClick={() => setDatePreset('yesterday')}>Yesterday</button>
              <button className={`${styles.presetBtn} ${datePreset === 'thisWeek' ? styles.presetActive : ''}`} onClick={() => setDatePreset('thisWeek')}>This Week</button>
              <button className={`${styles.presetBtn} ${datePreset === 'thisMonth' ? styles.presetActive : ''}`} onClick={() => setDatePreset('thisMonth')}>This Month</button>
            </div>

            <label className={styles.field}>
              <div className={styles.fieldLabel}>Start Date</div>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }} className={styles.input} />
            </label>

            <label className={styles.field}>
              <div className={styles.fieldLabel}>End Date</div>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }} className={styles.input} />
            </label>
          </section>
        </aside>
      </div>
    </div>
  );
}
