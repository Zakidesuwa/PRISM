'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

interface StoreOverviewProps {
  schoolName: string;
  storeLocation: string;
  skuCount: number;
  categoryCount: number;
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
  maxWidth: 640,
  backgroundColor: '#ffffff',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

export default function StoreOverviewSection({
  schoolName,
  storeLocation,
  skuCount,
  categoryCount,
}: StoreOverviewProps) {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  return (
    <>
      <section className={styles.storeCard}>
        <div
          className={styles.storePhoto}
          role="img"
          aria-label={`Photo of ${schoolName} store`}
        >
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M9 21v-6h6v6" />
          </svg>
        </div>

        <div className={styles.storeBody}>
          <h2 className={styles.cardTitle}>School Store Overview</h2>
          <p className={styles.storeText}>
            Located at the {storeLocation}. Managing {skuCount}+ SKU counts across{' '}
            {categoryCount} categories.
          </p>
          <button
            type="button"
            className={styles.storeBtn}
            onClick={() => setIsPhotoModalOpen(true)}
          >
            View Store Photos
          </button>
        </div>
      </section>

      {/* Store Photos Gallery Modal */}
      {isPhotoModalOpen && (
        <div
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPhotoModalOpen(false);
          }}
        >
          <div style={modalStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #E5E7EB',
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>
                  {schoolName} — Canteen Facility
                </h3>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                  {storeLocation} · Operating Hours: 7:00 AM - 5:00 PM
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Grid of Store Photo Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
                <div
                  style={{
                    height: 160,
                    borderRadius: 12,
                    backgroundColor: '#EBF5FF',
                    border: '1px dashed #2563EB',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563EB',
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>Main POS &amp; Counter</span>
                  <span style={{ fontSize: 10, color: '#6B7280' }}>Front Entrance</span>
                </div>

                <div
                  style={{
                    height: 160,
                    borderRadius: 12,
                    backgroundColor: '#F3F4F6',
                    border: '1px dashed #9CA3AF',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4B5563',
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>Inventory Storage Area</span>
                  <span style={{ fontSize: 10, color: '#6B7280' }}>Back Room</span>
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                  color: '#374151',
                }}
              >
                <strong>Facility Note:</strong> Equipped with barcode scanners, thermal receipt printers, and digital stock monitoring linked directly to the district BEAM admin portal.
              </div>
            </div>

            <div style={{ padding: '16px 24px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #D1D5DB',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Close Gallery
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
