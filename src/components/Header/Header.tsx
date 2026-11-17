'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CircleCheck, PackageX, TriangleAlert, X } from 'lucide-react';
import { ROLE_LABEL, type SessionUser } from '@/lib/roles';
import styles from './Header.module.css';

export interface HeaderAlert {
  id: number;
  title: string;
  desc: string;
  /** Out of stock is more urgent than low stock. */
  severity?: 'low' | 'empty';
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Header({ user, alerts = [] }: { user?: SessionUser; alerts?: HeaderAlert[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside, like any other menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.rightSection} ref={panelRef}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={alerts.length ? `Stock alerts: ${alerts.length}` : 'Stock alerts: none'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Bell size={20} aria-hidden="true" />
          {alerts.length > 0 && <span className={styles.count}>{alerts.length > 9 ? '9+' : alerts.length}</span>}
        </button>

        {open && (
          <div className={styles.panel} role="dialog" aria-label="Stock alerts">
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Stock alerts</span>
              <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className={styles.emptyState}>
                <CircleCheck size={28} aria-hidden="true" />
                <span>Everything is above its reorder level.</span>
              </div>
            ) : (
              <ul className={styles.alertList}>
                {alerts.map((alert) => (
                  <li key={alert.id} className={styles.alertItem}>
                    <span className={alert.severity === 'empty' ? styles.alertIconDanger : styles.alertIconWarn}>
                      {alert.severity === 'empty' ? (
                        <PackageX size={16} aria-hidden="true" />
                      ) : (
                        <TriangleAlert size={16} aria-hidden="true" />
                      )}
                    </span>
                    <span>
                      <span className={styles.alertTitle}>{alert.title}</span>
                      <span className={styles.alertDesc}>{alert.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {alerts.length > 0 && (
              <Link href="/inventory" onClick={() => setOpen(false)} className={styles.panelLink}>
                Open inventory to restock
              </Link>
            )}
          </div>
        )}

        {user && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>
              {ROLE_LABEL[user.role]}
              {user.branchName ? ` · ${user.branchName}` : ''}
            </span>
          </div>
        )}
        <div className={styles.avatar} aria-hidden="true">
          {user ? initials(user.name) : null}
        </div>
      </div>
    </header>
  );
}
