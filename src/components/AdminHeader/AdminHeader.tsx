'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { SessionUser } from '@/lib/auth';
import { logout } from '@/app/actions/auth';
import styles from './AdminHeader.module.css';

const TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/cooperative': 'Cooperative Directory',
  '/admin/inventory': 'District Inventory',
  '/admin/settings': 'System Settings',
};

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function titleFor(pathname: string) {
  const match = Object.keys(TITLES)
    .filter((path) =>
      path === '/admin' ? pathname === '/admin' : pathname === path || pathname.startsWith(`${path}/`)
    )
    .sort((a, b) => b.length - a.length)[0];

  return match ? TITLES[match] : 'Dashboard';
}

export default function AdminHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className={styles.header} style={{ position: 'relative' }}>
      <h1 className={styles.title}>{titleFor(pathname)}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          className={styles.avatar}
          title={user.name}
          onClick={() => setShowMenu(!showMenu)}
          style={{ border: 'none', cursor: 'pointer', background: 'transparent', padding: 0 }}
        >
          {initials(user.name)}
        </button>

        {showMenu && (
          <div
            style={{
              position: 'absolute',
              top: 52,
              right: 0,
              width: 220,
              backgroundColor: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
              border: '1px solid #E5E7EB',
              zIndex: 99,
              padding: 12,
            }}
          >
            <div style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>
                Role: {user.role}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Link
                href="/admin/settings"
                onClick={() => setShowMenu(false)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151',
                  textDecoration: 'none',
                }}
              >
                Admin Settings
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#EF4444',
                  backgroundColor: '#FEF2F2',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
