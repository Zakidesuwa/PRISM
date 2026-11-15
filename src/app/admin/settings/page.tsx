'use client';

import React, { useState } from 'react';
import {
  CURRENCY_OPTIONS,
  PAPER_SIZES,
  PRINTER_OPTIONS,
  SCANNER_OPTIONS,
  defaultSettings,
  type SystemSettings,
} from '@/data/settingsMockData';
import styles from './page.module.css';

const TABS = ['General', 'Taxes & Fees', 'Hardware', 'Receipts'] as const;
type Tab = (typeof TABS)[number];

function Toggle({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <span className={styles.toggleText}>
        <label htmlFor={id} className={styles.toggleTitle}>{title}</label>
        <span className={styles.toggleDesc}>{description}</span>
      </span>

      <span className={styles.switch}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className={styles.switchInput}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchKnob} />
        </span>
      </span>
    </div>
  );
}

export default function AdminSettingsPage() {
  // `saved` is the committed baseline; `draft` is what the form is editing.
  const [saved, setSaved] = useState<SystemSettings>(defaultSettings);
  const [draft, setDraft] = useState<SystemSettings>(defaultSettings);
  const [tab, setTab] = useState<Tab>('General');
  const [justSaved, setJustSaved] = useState(false);

  const isDirty = JSON.stringify(saved) !== JSON.stringify(draft);

  /** Patches one section of the draft without touching the others. */
  function update<K extends keyof SystemSettings>(
    section: K,
    patch: Partial<SystemSettings[K]>
  ) {
    setDraft((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
    setJustSaved(false);
  }

  function handleSave() {
    setSaved(draft);
    setJustSaved(true);
  }

  function handleCancel() {
    setDraft(saved);
    setJustSaved(false);
  }

  return (
    <div className={styles.page}>
      <p className={styles.subtitle}>Manage system configurations and general preferences.</p>

      <div className={styles.layout}>
        <div className={styles.tabs} role="tablist" aria-label="Settings sections">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              className={`${styles.tab} ${tab === name ? styles.tabActive : ''}`}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className={styles.panel}>
          {tab === 'General' && (
            <>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>General Information</h2>

                <div className={styles.fieldGrid}>
                  <div className={`${styles.field} ${styles.fieldFull}`}>
                    <label className={styles.label} htmlFor="canteenName">Canteen Name</label>
                    <input
                      id="canteenName"
                      className={styles.input}
                      value={draft.general.canteenName}
                      onChange={(event) => update('general', { canteenName: event.target.value })}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="contactEmail">Contact Email</label>
                    <input
                      id="contactEmail"
                      type="email"
                      className={styles.input}
                      value={draft.general.contactEmail}
                      onChange={(event) => update('general', { contactEmail: event.target.value })}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="phoneNumber">Phone Number</label>
                    <input
                      id="phoneNumber"
                      type="tel"
                      className={styles.input}
                      value={draft.general.phoneNumber}
                      onChange={(event) => update('general', { phoneNumber: event.target.value })}
                    />
                  </div>

                  <div className={`${styles.field} ${styles.fieldFull}`}>
                    <label className={styles.label} htmlFor="currency">Currency</label>
                    <select
                      id="currency"
                      className={styles.select}
                      value={draft.general.currency}
                      onChange={(event) => update('general', { currency: event.target.value })}
                    >
                      {CURRENCY_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>System Preferences</h2>

                <div className={styles.toggleList}>
                  <Toggle
                    id="lowStockAlerts"
                    title="Enable Low Stock Alerts"
                    description="Receive notifications when items fall below threshold."
                    checked={draft.preferences.lowStockAlerts}
                    onChange={(value) => update('preferences', { lowStockAlerts: value })}
                  />
                  <Toggle
                    id="managerOverride"
                    title="Require Manager Override for Voids"
                    description="PIN required to void items in POS mode."
                    checked={draft.preferences.managerOverrideVoids}
                    onChange={(value) => update('preferences', { managerOverrideVoids: value })}
                  />
                  <Toggle
                    id="autoPrint"
                    title="Auto-Print Receipts"
                    description="Automatically print upon transaction completion."
                    checked={draft.preferences.autoPrintReceipts}
                    onChange={(value) => update('preferences', { autoPrintReceipts: value })}
                  />
                </div>
              </section>
            </>
          )}

          {tab === 'Taxes & Fees' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Taxes &amp; Fees</h2>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="taxRate">Tax Rate</label>
                  <span className={styles.suffixField}>
                    <input
                      id="taxRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className={styles.input}
                      value={draft.taxes.taxRate}
                      onChange={(event) => update('taxes', { taxRate: Number(event.target.value) })}
                    />
                    <span className={styles.suffix}>%</span>
                  </span>
                  <span className={styles.hint}>Applied to every POS transaction.</span>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="serviceCharge">Service Charge</label>
                  <span className={styles.suffixField}>
                    <input
                      id="serviceCharge"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className={styles.input}
                      value={draft.taxes.serviceCharge}
                      onChange={(event) => update('taxes', { serviceCharge: Number(event.target.value) })}
                    />
                    <span className={styles.suffix}>%</span>
                  </span>
                  <span className={styles.hint}>Leave at 0 to disable.</span>
                </div>
              </div>

              <div className={styles.toggleList} style={{ marginTop: 18 }}>
                <Toggle
                  id="pricesIncludeTax"
                  title="Prices Include Tax"
                  description="Menu prices are shown tax-inclusive rather than adding it at checkout."
                  checked={draft.taxes.pricesIncludeTax}
                  onChange={(value) => update('taxes', { pricesIncludeTax: value })}
                />
              </div>
            </section>
          )}

          {tab === 'Hardware' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Hardware</h2>

              <div className={styles.fieldGrid}>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label} htmlFor="printer">Receipt Printer</label>
                  <select
                    id="printer"
                    className={styles.select}
                    value={draft.hardware.receiptPrinter}
                    onChange={(event) => update('hardware', { receiptPrinter: event.target.value })}
                  >
                    {PRINTER_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label} htmlFor="scanner">Barcode Scanner</label>
                  <select
                    id="scanner"
                    className={styles.select}
                    value={draft.hardware.barcodeScanner}
                    onChange={(event) => update('hardware', { barcodeScanner: event.target.value })}
                  >
                    {SCANNER_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.toggleList} style={{ marginTop: 18 }}>
                <Toggle
                  id="cashDrawer"
                  title="Cash Drawer Linked to Printer"
                  description="Drawer opens automatically when a cash sale is completed."
                  checked={draft.hardware.cashDrawerLinked}
                  onChange={(value) => update('hardware', { cashDrawerLinked: value })}
                />
              </div>
            </section>
          )}

          {tab === 'Receipts' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Receipts</h2>

              <div className={styles.fieldGrid}>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label} htmlFor="headerText">Header Text</label>
                  <input
                    id="headerText"
                    className={styles.input}
                    value={draft.receipts.headerText}
                    onChange={(event) => update('receipts', { headerText: event.target.value })}
                  />
                </div>

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label} htmlFor="footerText">Footer Text</label>
                  <textarea
                    id="footerText"
                    className={styles.textarea}
                    value={draft.receipts.footerText}
                    onChange={(event) => update('receipts', { footerText: event.target.value })}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="paperSize">Paper Size</label>
                  <select
                    id="paperSize"
                    className={styles.select}
                    value={draft.receipts.paperSize}
                    onChange={(event) => update('receipts', { paperSize: event.target.value })}
                  >
                    {PAPER_SIZES.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.toggleList} style={{ marginTop: 18 }}>
                <Toggle
                  id="showLogo"
                  title="Show Logo on Receipt"
                  description="Prints the city seal at the top of every receipt."
                  checked={draft.receipts.showLogo}
                  onChange={(value) => update('receipts', { showLogo: value })}
                />
              </div>
            </section>
          )}

          <div className={styles.actions}>
            {justSaved && !isDirty && (
              <span className={styles.savedNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                All changes saved
              </span>
            )}
            {isDirty && <span className={styles.dirtyNote}>You have unsaved changes</span>}

            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={!isDirty}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!isDirty}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
