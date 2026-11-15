"use client";

import React, { useMemo, useState } from 'react';
import styles from './page.module.css';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Offline';
  lastActive: string;
};

const MOCK_USERS: User[] = [
  { id: 1, name: 'Sarah Jenkins', email: 'sarah.j@prism.app', role: 'Administrator', status: 'Active', lastActive: 'Just now' },
  { id: 2, name: 'Mike Ross', email: 'm.ross@prism.app', role: 'Cashier', status: 'Active', lastActive: '2 hours ago' },
  { id: 3, name: 'Elena Gomez', email: 'elena.g@prism.app', role: 'Inventory Manager', status: 'Offline', lastActive: '2 days ago' },
  { id: 4, name: 'Carlos Reyes', email: 'c.reyes@prism.app', role: 'Storekeeper', status: 'Active', lastActive: '1 hour ago' },
  { id: 5, name: 'Ana Lopez', email: 'ana.l@prism.app', role: 'Accountant', status: 'Offline', lastActive: '3 days ago' },
];

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 5;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_USERS;
    return MOCK_USERS.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page-1)*perPage, page*perPage);

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>Manage staff accounts, roles, and access permissions.</p>
        </div>
        <div>
          <button className={styles.primaryBtn}>+ Add New User</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.controlsRow}>
          <input
            className={styles.searchInput}
            placeholder="Search users..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
          <button className={styles.filterBtn}>Filter</button>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>User Details</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(u => (
              <tr key={u.id}>
                <td className={styles.nameCell}>
                  <div className={styles.avatar}>{initials(u.name)}</div>
                  <div>
                    <div className={styles.name}>{u.name}</div>
                    <div className={styles.email}>{u.email}</div>
                  </div>
                </td>
                <td><span className={styles.roleBadge}>{u.role}</span></td>
                <td>{u.status === 'Active' ? <span className={styles.statusActive}>Active</span> : <span className={styles.statusOffline}>Offline</span>}</td>
                <td>{u.lastActive}</td>
                <td><button className={styles.actionBtn}>⋯</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.tableFooter}>
          <div>Showing {Math.min(filtered.length, (page-1)*perPage + 1)} to {Math.min(filtered.length, page*perPage)} of {filtered.length} users</div>
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>&lt;</button>
            <button className={`${styles.pageNumber} ${page===1 ? styles.pageActive : ''}`} onClick={() => setPage(1)}>1</button>
            <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>&gt;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
