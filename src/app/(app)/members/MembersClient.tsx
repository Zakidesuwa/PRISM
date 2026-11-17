'use client';

import React, { useState } from 'react';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import MemberProfileView from '@/components/MemberProfile/MemberProfileView';
import { useAction } from '@/lib/useAction';
import { formatCurrency } from '@/utils/formatters';
import {
  addShareCapitalAction,
  createMemberAction,
  getMemberProfileAction,
  recordMemberPaymentAction,
  updateMemberAction,
} from '@/actions/memberActions';
import type { MemberProfile, MemberRow } from '@/services/memberService';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; member: MemberRow }
  | { kind: 'capital'; member: MemberRow }
  | { kind: 'payment'; member: MemberRow }
  | { kind: 'profile'; profile: MemberProfile }
  | null;

export default function MembersClient({ members, defaultCreditLimit }: { members: MemberRow[]; defaultCreditLimit: number }) {
  const { run, pending } = useAction();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState({ memberCode: '', fullName: '', email: '', phone: '', shareCapital: '', creditLimit: '', status: 'ACTIVE' });
  const [amount, setAmount] = useState('');

  const close = () => setDialog(null);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const filtered = members.filter((member) => {
    const q = query.trim().toLowerCase();
    return !q || member.fullName.toLowerCase().includes(q) || member.memberCode.toLowerCase().includes(q);
  });

  const totalCapital = members.reduce((sum, member) => sum + member.shareCapital, 0);
  const totalOwed = members.reduce((sum, member) => sum + member.chargeBalance, 0);
  const totalPatronage = members.reduce((sum, member) => sum + member.accumulatedPatronage, 0);

  function openCreate() {
    setForm({ memberCode: '', fullName: '', email: '', phone: '', shareCapital: '', creditLimit: String(defaultCreditLimit), status: 'ACTIVE' });
    setDialog({ kind: 'create' });
  }

  function openEdit(member: MemberRow) {
    setForm({
      memberCode: member.memberCode,
      fullName: member.fullName,
      email: member.email ?? '',
      phone: member.phone ?? '',
      shareCapital: '',
      creditLimit: String(member.creditLimit),
      status: member.status,
    });
    setDialog({ kind: 'edit', member });
  }

  function openAmount(kind: 'capital' | 'payment', member: MemberRow) {
    setAmount(kind === 'payment' ? member.chargeBalance.toFixed(2) : '');
    setDialog({ kind, member });
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>Coop Members</h1>
          <p className={ui.subtitle}>Member records, share capital, patronage and charge balances.</p>
        </div>
        <button className={`${ui.btn} ${ui.btnPrimary}`} onClick={openCreate}>
          + Register member
        </button>
      </div>

      <div className={ui.statGrid}>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Members</div>
          <div className={ui.statValue}>{members.length}</div>
          <div className={ui.statHint}>{members.filter((member) => member.status === 'ACTIVE').length} active</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Total share capital</div>
          <div className={ui.statValue}>{formatCurrency(totalCapital)}</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Total patronage</div>
          <div className={ui.statValue}>{formatCurrency(totalPatronage)}</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Owed by members</div>
          <div className={ui.statValue}>{formatCurrency(totalOwed)}</div>
          <div className={ui.statHint}>Unpaid charge sales</div>
        </div>
      </div>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>Member list</h2>
          <input
            className={ui.input}
            style={{ width: 260 }}
            placeholder="Search name or member code..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th className={ui.num}>Share capital</th>
                <th className={ui.num}>Patronage</th>
                <th className={ui.num}>Owes</th>
                <th className={ui.num}>Credit limit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className={ui.strong}>{member.fullName}</div>
                    <div className={ui.muted}>{member.memberCode}</div>
                  </td>
                  <td>
                    <span className={`${ui.badge} ${member.status === 'ACTIVE' ? ui.badgeGreen : ui.badgeRed}`}>
                      {member.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className={ui.num}>{formatCurrency(member.shareCapital)}</td>
                  <td className={ui.num}>{formatCurrency(member.accumulatedPatronage)}</td>
                  <td className={`${ui.num} ${member.chargeBalance > 0 ? ui.negative : ''}`}>
                    {formatCurrency(member.chargeBalance)}
                  </td>
                  <td className={ui.num}>{formatCurrency(member.creditLimit)}</td>
                  <td>
                    <div className={ui.row} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <button
                        className={`${ui.btn} ${ui.btnSmall}`}
                        disabled={pending}
                        onClick={() => run(() => getMemberProfileAction(member.id), (profile) => setDialog({ kind: 'profile', profile }))}
                      >
                        View
                      </button>
                      <button className={`${ui.btn} ${ui.btnSmall}`} onClick={() => openAmount('capital', member)}>
                        + Capital
                      </button>
                      <button
                        className={`${ui.btn} ${ui.btnSmall}`}
                        disabled={member.chargeBalance <= 0}
                        onClick={() => openAmount('payment', member)}
                      >
                        Payment
                      </button>
                      <button className={`${ui.btn} ${ui.btnSmall}`} onClick={() => openEdit(member)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
                    No members match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <Modal title={dialog.kind === 'create' ? 'Register member' : `Edit ${dialog.member.fullName}`} onClose={close}>
          <div className={ui.formGrid}>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Full name</span>
              <input className={ui.input} value={form.fullName} onChange={set('fullName')} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Member code (printed on the ID)</span>
              <input className={ui.input} value={form.memberCode} onChange={set('memberCode')} disabled={dialog.kind === 'edit'} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Phone</span>
              <input className={ui.input} value={form.phone} onChange={set('phone')} />
            </label>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Email</span>
              <input className={ui.input} value={form.email} onChange={set('email')} />
            </label>
            {dialog.kind === 'create' ? (
              <label className={ui.field}>
                <span className={ui.label}>Initial share capital (₱, paid in cash)</span>
                <input className={ui.input} inputMode="decimal" value={form.shareCapital} onChange={set('shareCapital')} />
              </label>
            ) : (
              <label className={ui.field}>
                <span className={ui.label}>Status</span>
                <select className={ui.select} value={form.status} onChange={set('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            )}
            <label className={ui.field}>
              <span className={ui.label}>Credit limit (₱)</span>
              <input className={ui.input} inputMode="decimal" value={form.creditLimit} onChange={set('creditLimit')} />
            </label>
          </div>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    dialog.kind === 'create'
                      ? createMemberAction({ ...form, shareCapital: form.shareCapital || '0' })
                      : updateMemberAction(dialog.member.id, form),
                  close
                )
              }
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {(dialog?.kind === 'capital' || dialog?.kind === 'payment') && (
        <Modal
          title={dialog.kind === 'capital' ? `Add share capital: ${dialog.member.fullName}` : `Record payment: ${dialog.member.fullName}`}
          hint={
            dialog.kind === 'capital'
              ? `Current share capital ${formatCurrency(dialog.member.shareCapital)}. Received in cash.`
              : `Owes ${formatCurrency(dialog.member.chargeBalance)}. Received in cash.`
          }
          onClose={close}
        >
          <label className={ui.field}>
            <span className={ui.label}>Amount (₱)</span>
            <input className={ui.input} inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || !amount}
              onClick={() =>
                run(
                  () =>
                    dialog.kind === 'capital'
                      ? addShareCapitalAction(dialog.member.id, amount)
                      : recordMemberPaymentAction(dialog.member.id, amount),
                  close
                )
              }
            >
              Record
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'profile' && (
        <Modal title="Member record" wide onClose={close}>
          <MemberProfileView profile={dialog.profile} />
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
