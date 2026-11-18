'use client';

import React, { useState, useMemo } from 'react';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import MemberProfileView from '@/components/MemberProfile/MemberProfileView';
import { useAction } from '@/lib/useAction';
import { formatCurrency } from '@/utils/formatters';
import { getMemberProfileAction, recordMemberPaymentAction } from '@/actions/memberActions';
import { searchMembersAction } from '@/actions/posActions';
import {
  searchHardcodedMembers,
  getHardcodedMemberProfile,
  GORDON_COLLEGE_STUDENTS,
  toHardcodedMemberRow,
} from '@/lib/hardcodedMembers';
import type { MemberProfile, MemberRow } from '@/services/memberService';

/**
 * Member self-service & kiosk lookup:
 * Front-end user role: Coop Member (Teacher/Staff/Student)
 * Requirements fulfilled:
 * 1. Scans ID (Barcode scanner or manual ID input)
 * 2. Checks Balance (Balance owed, available credit, credit limit)
 * 3. View Patronage (Accumulated patronage dividend & transaction log)
 */
export default function MemberLookupClient() {
  const { run, pending } = useAction();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<MemberRow[] | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');

  // Initial list of all 30 Gordon College cooperative members
  const allMembers = useMemo(() => GORDON_COLLEGE_STUDENTS.map(toHardcodedMemberRow), []);

  // Filtered members based on active search input
  const filteredRoster = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allMembers;
    return allMembers.filter(
      (m) =>
        m.memberCode.toLowerCase().includes(q) ||
        m.fullName.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q))
    );
  }, [query, allMembers]);

  const load = (memberId: number) => {
    const local = getHardcodedMemberProfile(memberId);
    if (local) {
      setProfile(local);
      setMatches(null);
      setQuery('');
      return;
    }
    run(
      () => getMemberProfileAction(memberId),
      (found) => {
        setProfile(found);
        setMatches(null);
        setQuery('');
      }
    );
  };

  function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;

    const localMatches = searchHardcodedMembers(q);
    if (localMatches.length === 1) {
      load(localMatches[0].id);
      return;
    }

    if (localMatches.length > 1) {
      setProfile(null);
      setMatches(localMatches);
      return;
    }

    run(
      () => searchMembersAction(q),
      (found) => {
        if (found.length === 1) load(found[0].id);
        else {
          setProfile(null);
          setMatches(found);
        }
      }
    );
  }

  // Sample quick scan members for one-click verification
  const quickPickMembers = [
    { id: 118, name: 'DIOSOMITO, MARKUZ', code: '202312278' },
    { id: 101, name: 'AGAPAY, AIKO', code: '202310457' },
    { id: 102, name: 'ALIPIO, CRISTINA', code: '202311208' },
    { id: 115, name: 'DE OCAMPO, RICHARD', code: '202312277' },
    { id: 125, name: 'REYES, ZOIE', code: '202311237' },
  ];

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>Member Lookup</h1>
          <p className={ui.subtitle}>
            Coop Member Self-Service Kiosk: Scan ID card or enter student number to check balance and view patronage.
          </p>
        </div>
        <div className={ui.row}>
          <span className={`${ui.badge} ${ui.badgeBlue}`}>Front-End Role: Coop Member</span>
          <span className={`${ui.badge} ${ui.badgeGreen}`}>Gordon College Chapter</span>
        </div>
      </div>

      {/* Role Requirement Indicator */}
      <div
        className={ui.card}
        style={{
          background: '#f8fafc',
          borderColor: '#cbd5e1',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
            BOCDO Module Requirements:
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`${ui.badge} ${ui.badgeBlue}`}>1. Scans ID Barcode</span>
            <span className={`${ui.badge} ${ui.badgeGreen}`}>2. Checks Balance & Credit</span>
            <span className={`${ui.badge} ${ui.badgeYellow}`}>3. View Patronage Refund</span>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Hardware scanners input directly to the search box below
        </div>
      </div>

      {/* Scan / Search Input Card */}
      <form onSubmit={search} className={ui.card}>
        <div className={ui.row} style={{ flexWrap: 'nowrap', gap: 8 }}>
          <input
            className={ui.input}
            style={{ fontSize: '1rem', padding: '12px 14px', flex: 1 }}
            placeholder="Scan ID card barcode or type member code / name (e.g. 202312278, Markuz)"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className={`${ui.btn} ${ui.btnPrimary}`}
            style={{ padding: '12px 24px', whiteSpace: 'nowrap' }}
            disabled={pending}
          >
            {pending ? 'Searching…' : 'Look up'}
          </button>
        </div>

        {/* Quick-test scan shortcuts */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Quick Scan Test:</span>
          {quickPickMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              className={`${ui.btn} ${ui.btnSmall}`}
              style={{ fontSize: '0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1' }}
              onClick={() => load(member.id)}
            >
              Scan {member.name} ({member.code})
            </button>
          ))}
        </div>

        {matches && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {matches.length === 0 && <div className={ui.warning}>No member found for that code or name.</div>}
            {matches.map((member) => (
              <button
                key={member.id}
                type="button"
                className={ui.btn}
                style={{ justifyContent: 'space-between' }}
                onClick={() => load(member.id)}
              >
                <span className={ui.strong}>{member.fullName}</span>
                <span className={ui.muted}>{member.memberCode}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Active Member Profile: Balance Check, Patronage & Ledger */}
      {profile && (
        <section className={ui.card}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className={ui.btn}
              onClick={() => {
                setProfile(null);
                setMatches(null);
                setQuery('');
              }}
            >
              ← Back to Member Directory
            </button>
            <div style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
              ✓ ID Scanned & Verified: {profile.memberCode} ({profile.fullName})
            </div>
          </div>

          <MemberProfileView profile={profile} />

          <div className={ui.modalActions} style={{ marginTop: 20 }}>
            <button
              type="button"
              className={ui.btn}
              onClick={() => {
                setProfile(null);
                setMatches(null);
                setQuery('');
              }}
            >
              Close / Scan Another
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={profile.chargeBalance <= 0}
              onClick={() => {
                setAmount(profile.chargeBalance.toFixed(2));
                setPaying(true);
              }}
            >
              {profile.chargeBalance > 0 ? `Record Payment (${formatCurrency(profile.chargeBalance)})` : 'No Balance Owed'}
            </button>
          </div>
        </section>
      )}

      {/* When no profile is loaded, show the complete Gordon College Member Directory */}
      {!profile && !matches && (
        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <div className={ui.cardTitle}>Gordon College Coop Member Directory ({filteredRoster.length} Members)</div>
              <div className={ui.subtitle}>
                Click any student below to simulate an ID scan, check their balance, and view patronage history.
              </div>
            </div>
          </div>

          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th>Institutional Email</th>
                  <th className={ui.num}>Balance Owed</th>
                  <th className={ui.num}>Credit Limit</th>
                  <th className={ui.num}>Patronage</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className={`${ui.badge} ${ui.badgeBlue}`}>{member.memberCode}</span>
                    </td>
                    <td className={ui.strong}>{member.fullName}</td>
                    <td className={ui.muted}>{member.email}</td>
                    <td className={ui.num}>
                      {member.chargeBalance > 0 ? (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                          {formatCurrency(member.chargeBalance)}
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>₱0.00</span>
                      )}
                    </td>
                    <td className={ui.num}>{formatCurrency(member.creditLimit)}</td>
                    <td className={ui.num} style={{ fontWeight: 600, color: '#0369a1' }}>
                      {formatCurrency(member.accumulatedPatronage)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={`${ui.btn} ${ui.btnSmall} ${ui.btnPrimary}`}
                        onClick={() => load(member.id)}
                      >
                        Check Balance & Patronage
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRoster.length === 0 && (
                  <tr>
                    <td colSpan={7} className={ui.empty}>
                      No member matches the search query &quot;{query}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {paying && profile && (
        <Modal
          title={`Record payment: ${profile.fullName}`}
          hint={`Owes ${formatCurrency(profile.chargeBalance)}. Received in cash.`}
          onClose={() => setPaying(false)}
        >
          <label className={ui.field}>
            <span className={ui.label}>Amount (₱)</span>
            <input
              className={ui.input}
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <div className={ui.modalActions}>
            <button type="button" className={ui.btn} onClick={() => setPaying(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || !amount}
              onClick={() => {
                const isHardcoded = profile.id >= 100 && profile.id <= 130;
                if (isHardcoded) {
                  const payNum = parseFloat(amount) || 0;
                  const newBalance = Math.max(0, profile.chargeBalance - payNum);
                  const newAvailable = Math.min(profile.creditLimit, profile.availableCredit + payNum);
                  setProfile({
                    ...profile,
                    chargeBalance: newBalance,
                    availableCredit: newAvailable,
                    ledger: [
                      {
                        id: Date.now(),
                        type: 'PAYMENT',
                        amount: payNum,
                        chargeBalanceAfter: newBalance,
                        shareCapitalAfter: profile.shareCapital,
                        reference: `OR-${Math.floor(1000 + Math.random() * 9000)}`,
                        note: 'Payment received (cash)',
                        createdAt: new Date().toISOString(),
                      },
                      ...profile.ledger,
                    ],
                  });
                  setPaying(false);
                  return;
                }
                run(
                  () => recordMemberPaymentAction(profile.id, amount),
                  () => {
                    setPaying(false);
                    load(profile.id);
                  }
                );
              }}
            >
              Record payment
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
