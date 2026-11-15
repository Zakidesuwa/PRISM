'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

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
  maxWidth: 420,
  backgroundColor: '#ffffff',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

export default function HeaderActions() {
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('This Week');
  const [notification, setNotification] = useState<string | null>(null);

  function handleSelectPeriod(period: string) {
    setSelectedPeriod(period);
    setIsPeriodModalOpen(false);
    setNotification(`Period updated to: ${period}`);
    setTimeout(() => setNotification(null), 3000);
  }

  return (
    <>
      <div className={styles.headerActions}>
        <button type="button" className={styles.ghostBtn} onClick={() => window.print()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export PDF
        </button>

        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => setIsPeriodModalOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Period: {selectedPeriod}
        </button>
      </div>

      {notification && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            padding: '12px 18px',
            backgroundColor: '#111827',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          }}
        >
          ✓ {notification}
        </div>
      )}

      {isPeriodModalOpen && (
        <div
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPeriodModalOpen(false);
          }}
        >
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Select Performance Period</h3>
              <button
                type="button"
                onClick={() => setIsPeriodModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {['Today', 'This Week', 'Last 30 Days', 'This Quarter', 'Year to Date'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPeriod(preset)}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    backgroundColor: selectedPeriod === preset ? '#EBF5FF' : '#ffffff',
                    color: selectedPeriod === preset ? '#2563EB' : '#374151',
                    fontWeight: selectedPeriod === preset ? 600 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {preset} {selectedPeriod === preset ? '✓' : ''}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsPeriodModalOpen(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#F3F4F6',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
