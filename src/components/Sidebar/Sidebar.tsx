'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ChartNoAxesColumn,
  ClipboardList,
  FileText,
  HandCoins,
  IdCard,
  Layers,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { ROUTE_ROLES, type Role } from '@/lib/roles';
import styles from './Sidebar.module.css';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Links are grouped by the job they belong to (Hick's law: a few labelled
 * groups are scanned faster than one long list). Each role only sees the
 * links it may open, and a group with nothing left in it disappears.
 */
const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ label: 'Dashboard', href: '/', icon: LayoutDashboard }] },
  {
    title: 'Sell',
    items: [
      { label: 'Point of Sale', href: '/pos', icon: ShoppingCart },
      { label: 'Member Lookup', href: '/member-lookup', icon: IdCard },
      { label: 'Daily Sales', href: '/daily-sales', icon: CalendarDays },
    ],
  },
  {
    title: 'Stock',
    items: [
      { label: 'Inventory', href: '/inventory', icon: ClipboardList },
      { label: 'Products', href: '/products', icon: Package },
    ],
  },
  {
    title: 'Cooperative',
    items: [
      { label: 'Members', href: '/members', icon: Users },
      { label: 'Dividends', href: '/dividends', icon: HandCoins },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Profit Analytics', href: '/analytics', icon: ChartNoAxesColumn },
      { label: 'Financial Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Users', href: '/users', icon: UserCog },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

interface SidebarProps {
  userRole: Role;
  /** Small counters next to a link, e.g. { '/inventory': 3 } for items needing reorder. */
  badges?: Record<string, number>;
}

export default function Sidebar({ userRole, badges = {} }: SidebarProps) {
  const pathname = usePathname();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => ROUTE_ROLES[item.href]?.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <div className={styles.sealPlaceholder}>
          <Layers size={22} aria-hidden="true" />
        </div>
        <div className={styles.logoText}>
          <span className={styles.prismText}>PRISM</span>
          <span className={styles.subText}>MANAGEMENT SYSTEM</span>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Main">
        {groups.map((group) => (
          <div key={group.title ?? 'top'} className={styles.group}>
            {group.title && <div className={styles.groupTitle}>{group.title}</div>}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              const badge = badges[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} aria-hidden="true" className={styles.icon} />
                  <span className={styles.label}>{item.label}</span>
                  {badge > 0 && (
                    <span className={styles.badge} aria-label={`${badge} need attention`}>
                      {badge}
                    </span>
                  )}
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
