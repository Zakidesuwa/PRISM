'use client';

import React, { useState } from 'react';
import type { SessionUser } from '@/lib/auth';
import styles from './Header.module.css';

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Header({ user }: { user?: SessionUser }) {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Low Stock Alert', desc: 'San Miguel Water 500ml is running low (12 left)', time: '10m ago' },
    { id: 2, title: 'Daily Report Ready', desc: 'Yesterday sales report generated successfully', time: '1h ago' },
    { id: 3, title: 'System Notice', desc: 'BEAM system sync completed at 06:00 AM', time: '3h ago' },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.rightSection} style={{ position: 'relative' }}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Notifications"
          onClick={() => setShowNotifications(!showNotifications)}
          style={{ position: 'relative' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#EF4444',
            }}
          />
        </button>

        {showNotifications && (
          <div
            style={{
              position: 'absolute',
              top: 48,
              right: 0,
              width: 320,
              backgroundColor: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
              border: '1px solid #E5E7EB',
              zIndex: 99,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Notifications</span>
              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                style={{ border: 'none', background: 'none', fontSize: 12, color: '#6B7280', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #F3F4F6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#111827' }}>
                    <span>{n.title}</span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>{n.time}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{n.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {user && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        )}
        <div className={styles.avatar}>{user ? initials(user.name) : null}</div>
      </div>
    </header>
  );
}
