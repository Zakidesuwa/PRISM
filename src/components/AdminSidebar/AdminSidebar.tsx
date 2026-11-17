'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, House, Layers, LogOut, School, Settings, UserCog, type LucideIcon } from 'lucide-react';
import { logout } from '@/app/actions/auth';
// Shares the store sidebar's look so both halves of the system feel like one product.
import styles from '../Sidebar/Sidebar.module.css';
import own from './AdminSidebar.module.css';

const NAV_GROUPS: { title: string | null; items: { label: string; href: string; icon: LucideIcon }[] }[] = [
  { title: null, items: [{ label: 'Dashboard', href: '/admin', icon: House }] },
  {
    title: 'District',
    items: [
      { label: 'Cooperatives', href: '/admin/cooperative', icon: School },
      { label: 'Inventory', href: '/admin/inventory', icon: Boxes },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Users', href: '/admin/users', icon: UserCog },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

/** Sub-routes keep their section highlighted (/admin/cooperative/12 -> Cooperatives). */
function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <div className={styles.sealPlaceholder}>
          <Layers size={22} aria-hidden="true" />
        </div>
        <div className={styles.logoText}>
          <span className={own.wordmark}>BEAM</span>
          <span className={styles.subText}>ADMIN PANEL</span>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Admin">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? 'top'} className={styles.group}>
            {group.title && <div className={styles.groupTitle}>{group.title}</div>}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} aria-hidden="true" className={styles.icon} />
                  <span className={styles.label}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.bottomArea}>
        <form action={logout}>
          <button type="submit" className={styles.logoutBtn}>
            <LogOut size={18} aria-hidden="true" />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
