"use client";

import React, { useState } from 'react';
import styles from './page.module.css';

export default function SettingsPage() {
  const [canteenName, setCanteenName] = useState('Main Campus Cafeteria');
  const [contactEmail, setContactEmail] = useState('admin@campuscafe.edu');
  const [phone, setPhone] = useState('+1 (555) 123-4567');
  const [currency, setCurrency] = useState('USD ($) - US Dollar');

  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [requireManagerOverride, setRequireManagerOverride] = useState(true);
  const [autoPrintReceipts, setAutoPrintReceipts] = useState(false);

  function saveChanges() {
    // Stub: persist to server or local storage in a real app
    alert('Settings saved (stub)');
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav className={styles.tabs}>
            <button className={`${styles.tab} ${styles.tabActive}`}>General</button>
            <button className={styles.tab}>Taxes & Fees</button>
            <button className={styles.tab}>Hardware</button>
            <button className={styles.tab}>Receipts</button>
          </nav>
        </aside>

        <main className={styles.main}>
          <header className={styles.headerRow}>
            <div>
              <h1 className={styles.pageTitle}>Settings</h1>
              <p className={styles.pageSubtitle}>Manage system configurations and general preferences.</p>
            </div>
          </header>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>General Information</h2>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <div className={styles.fieldLabel}>Canteen Name</div>
                <input className={styles.input} value={canteenName} onChange={(e) => setCanteenName(e.target.value)} />
              </label>

              <label className={styles.field}>
                <div className={styles.fieldLabel}>Phone Number</div>
                <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <div className={styles.fieldLabel}>Contact Email</div>
                <input className={styles.input} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </label>

              <label className={styles.field}>
                <div className={styles.fieldLabel}>Currency</div>
                <select className={styles.select} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option>USD ($) - US Dollar</option>
                  <option>PHP (₱) - Philippine Peso</option>
                  <option>EUR (€) - Euro</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>System Preferences</h2>

            <div className={styles.prefList}>
              <label className={styles.prefItem}>
                <div>
                  <div className={styles.prefTitle}>Enable Low Stock Alerts</div>
                  <div className={styles.prefDesc}>Receive notifications when items fall below threshold.</div>
                </div>
                <input type="checkbox" checked={lowStockAlerts} onChange={(e) => setLowStockAlerts(e.target.checked)} className={styles.toggle} />
              </label>

              <label className={styles.prefItem}>
                <div>
                  <div className={styles.prefTitle}>Require Manager Override for Voids</div>
                  <div className={styles.prefDesc}>PIN required to void items in POS mode.</div>
                </div>
                <input type="checkbox" checked={requireManagerOverride} onChange={(e) => setRequireManagerOverride(e.target.checked)} className={styles.toggle} />
              </label>

              <label className={styles.prefItem}>
                <div>
                  <div className={styles.prefTitle}>Auto-Print Receipts</div>
                  <div className={styles.prefDesc}>Automatically print upon transaction completion.</div>
                </div>
                <input type="checkbox" checked={autoPrintReceipts} onChange={(e) => setAutoPrintReceipts(e.target.checked)} className={styles.toggle} />
              </label>
            </div>
          </section>

          <div className={styles.actionsRow}>
            <button className={styles.ghostBtn}>Cancel</button>
            <button className={styles.primaryBtn} onClick={saveChanges}>Save Changes</button>
          </div>
        </main>
      </div>
    </div>
  );
}
