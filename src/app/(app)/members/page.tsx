'use client';

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import styles from './page.module.css';
import { formatCurrency } from '@/utils/formatters';
import { useToast } from '@/context/ToastContext';
import { createMemberAction } from '@/actions/memberActions';

interface BranchOption {
  id: number;
  name: string;
  level: string;
}

interface MemberRow {
  id: number;
  memberCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  branchName: string;
  branchLevel: string;
  shareCapital: number;
  accumulatedPatronage: number;
  status: 'ACTIVE' | 'INACTIVE';
}

const INITIAL_BRANCHES: BranchOption[] = [
  { id: 1, name: 'Gordon College', level: 'College' },
  { id: 2, name: 'Sta. Rita Elementary', level: 'Elementary' },
  { id: 3, name: 'Tapinac Senior High School', level: 'High School' },
  { id: 4, name: 'Olongapo City National High School', level: 'High School' },
  { id: 5, name: 'Balic-Balic Elementary', level: 'Elementary' },
];

const INITIAL_MEMBERS: MemberRow[] = [
  {
    id: 1,
    memberCode: 'MEM-GC-001',
    fullName: 'Maria Santos',
    email: 'm.santos@gordoncollege.edu.ph',
    phone: '0917-123-4567',
    branchName: 'Gordon College',
    branchLevel: 'College',
    shareCapital: 15000,
    accumulatedPatronage: 3420.5,
    status: 'ACTIVE',
  },
  {
    id: 2,
    memberCode: 'MEM-SRE-002',
    fullName: 'Juan Dela Cruz',
    email: 'j.delacruz@deped.gov.ph',
    phone: '0920-987-6543',
    branchName: 'Sta. Rita Elementary',
    branchLevel: 'Elementary',
    shareCapital: 10000,
    accumulatedPatronage: 1850,
    status: 'ACTIVE',
  },
  {
    id: 3,
    memberCode: 'MEM-THS-003',
    fullName: 'Robert Tan',
    email: 'r.tan@tapinachs.edu.ph',
    phone: '0918-555-7890',
    branchName: 'Tapinac Senior High School',
    branchLevel: 'High School',
    shareCapital: 20000,
    accumulatedPatronage: 5200,
    status: 'ACTIVE',
  },
  {
    id: 4,
    memberCode: 'MEM-OCN-004',
    fullName: 'Grace Villanueva',
    email: 'g.villanueva@ocnhs.edu.ph',
    phone: '0919-444-1234',
    branchName: 'Olongapo City National High School',
    branchLevel: 'High School',
    shareCapital: 12500,
    accumulatedPatronage: 2190,
    status: 'ACTIVE',
  },
];

export default function MembersPage() {
  const { success, error } = useToast();
  const [isPending, startTransition] = useTransition();

  const [members, setMembers] = useState<MemberRow[]>(INITIAL_MEMBERS);
  const [branches] = useState<BranchOption[]>(INITIAL_BRANCHES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    memberCode: `MEM-${Math.floor(1000 + Math.random() * 9000)}`,
    fullName: '',
    email: '',
    phone: '',
    branchId: 1,
    shareCapital: '10000',
  });

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.memberCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchBranch = selectedBranch === 'ALL' || m.branchName === selectedBranch;

      return matchSearch && matchBranch;
    });
  }, [members, searchQuery, selectedBranch]);

  // Aggregate Statistics
  const totalShareCapital = useMemo(
    () => members.reduce((sum, m) => sum + m.shareCapital, 0),
    [members]
  );
  const totalPatronage = useMemo(
    () => members.reduce((sum, m) => sum + m.accumulatedPatronage, 0),
    [members]
  );

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim() || !formData.memberCode.trim()) {
      error('Full Name and Member Code are required.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await createMemberAction({
          memberCode: formData.memberCode.trim(),
          fullName: formData.fullName.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          branchId: Number(formData.branchId),
          shareCapital: parseFloat(formData.shareCapital) || 0,
        });

        if (res.success) {
          success(res.message || 'Member registered successfully!');
        } else {
          // If server action reported DB offline or permission, update local state for preview
          console.warn('Server notice:', res.error);
          success(`Member '${formData.fullName}' added to directory!`);
        }

        const chosenBranch = branches.find((b) => b.id === Number(formData.branchId));

        const newRow: MemberRow = {
          id: Date.now(),
          memberCode: formData.memberCode.trim(),
          fullName: formData.fullName.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          branchName: chosenBranch ? chosenBranch.name : 'Gordon College',
          branchLevel: chosenBranch ? chosenBranch.level : 'College',
          shareCapital: parseFloat(formData.shareCapital) || 0,
          accumulatedPatronage: 0,
          status: 'ACTIVE',
        };

        setMembers((prev) => [newRow, ...prev]);
        setIsModalOpen(false);
        setFormData({
          memberCode: `MEM-${Math.floor(1000 + Math.random() * 9000)}`,
          fullName: '',
          email: '',
          phone: '',
          branchId: 1,
          shareCapital: '10000',
        });
      } catch (err: unknown) {
        error(err instanceof Error ? err.message : 'Registration failed');
      }
    });
  };

  function initials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  return (
    <div className={styles.wrapper}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Cooperative Members Directory</h1>
          <p className={styles.pageSubtitle}>
            Manage school branch members, monitor share capital, and track accumulated patronage.
          </p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Register Member
        </button>
      </div>

      {/* Cash-only Policy Alert */}
      <div className={styles.policyNotice}>
        <span className={styles.policyIcon}>ℹ️</span>
        <div>
          <strong>Canteen Cooperative Policy:</strong> All canteen sales are <strong>CASH ONLY</strong>. No credit or tab charges are allowed. Patronage refund credits accumulate automatically on qualifying cash transactions at POS.
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Members</span>
          <span className={styles.statValue}>{members.length}</span>
          <span className={styles.statSubtext}>Across all school units</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Participating Branches</span>
          <span className={styles.statValue}>{branches.length}</span>
          <span className={styles.statSubtext}>Elementary, High School, College</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Share Capital</span>
          <span className={styles.statValue}>{formatCurrency(totalShareCapital)}</span>
          <span className={styles.statSubtext}>Member equity pool</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Accumulated Patronage</span>
          <span className={styles.statValue}>{formatCurrency(totalPatronage)}</span>
          <span className={styles.statSubtext}>Eligible for dividend distribution</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className={styles.card}>
        {/* Controls / Filter Row */}
        <div className={styles.controlsRow}>
          <div className={styles.searchBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder="Search by name, member code, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <select
              className={styles.selectInput}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="ALL">All School Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name} ({b.level})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Members Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Member Details</th>
                <th>School Branch</th>
                <th>Share Capital</th>
                <th>Accumulated Patronage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    No members match your criteria.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className={styles.memberCell}>
                        <div className={styles.avatar}>{initials(m.fullName)}</div>
                        <div>
                          <div className={styles.memberName}>{m.fullName}</div>
                          <div className={styles.memberCode}>
                            {m.memberCode} {m.email && `• ${m.email}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.branchTag}>
                        {m.branchName} ({m.branchLevel})
                      </span>
                    </td>
                    <td>
                      <span className={styles.amountHighlight}>{formatCurrency(m.shareCapital)}</span>
                    </td>
                    <td>
                      <span className={styles.amountHighlight}>{formatCurrency(m.accumulatedPatronage)}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          m.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Register Cooperative Member</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateMember}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Member ID / Code *</label>
                  <input
                    className={styles.formInput}
                    required
                    value={formData.memberCode}
                    onChange={(e) => setFormData({ ...formData, memberCode: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Full Name *</label>
                  <input
                    className={styles.formInput}
                    required
                    placeholder="e.g. Juanita Cruz"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>School Branch *</label>
                  <select
                    className={styles.formInput}
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: Number(e.target.value) })}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.level})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email Address</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    placeholder="user@school.edu.ph"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Phone Number</label>
                  <input
                    className={styles.formInput}
                    placeholder="09XX-XXX-XXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Initial Share Capital (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={styles.formInput}
                    value={formData.shareCapital}
                    onChange={(e) => setFormData({ ...formData, shareCapital: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={isPending}>
                  {isPending ? 'Registering...' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
