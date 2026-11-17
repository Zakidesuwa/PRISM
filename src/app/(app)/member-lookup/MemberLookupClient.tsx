'use client';

import React, { useState } from 'react';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import MemberProfileView from '@/components/MemberProfile/MemberProfileView';
import { useAction } from '@/lib/useAction';
import { formatCurrency } from '@/utils/formatters';
import { getMemberProfileAction, recordMemberPaymentAction } from '@/actions/memberActions';
import { searchMembersAction } from '@/actions/posActions';
import type { MemberProfile, MemberRow } from '@/services/memberService';

/**
 * Member self-service: scan the ID (a barcode scanner types the code and
 * presses Enter) to check the balance and view patronage.
 */
export default function MemberLookupClient() {
  const { run, pending } = useAction();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<MemberRow[] | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');

  const load = (memberId: number) =>
    run(
      () => getMemberProfileAction(memberId),
      (found) => {
        setProfile(found);
        setMatches(null);
        setQuery('');
      }
    );

  function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    run(
      () => searchMembersAction(query),
      (found) => {
        if (found.length === 1) load(found[0].id);
        else {
          setProfile(null);
          setMatches(found);
        }
      }
    );
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>Member Lookup</h1>
          <p className={ui.subtitle}>Scan a member ID or type a name to check the balance and view patronage.</p>
        </div>
      </div>

      <form onSubmit={search} className={ui.card}>
        <div className={ui.row} style={{ flexWrap: 'nowrap' }}>
          <input
            className={ui.input}
            style={{ fontSize: '1rem', padding: '12px 14px' }}
            placeholder="Scan ID or type member code / name, then press Enter"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} style={{ padding: '12px 20px' }} disabled={pending}>
            {pending ? 'Searching…' : 'Look up'}
          </button>
        </div>

        {matches && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {matches.length === 0 && <div className={ui.warning}>No member found for that code or name.</div>}
            {matches.map((member) => (
              <button key={member.id} type="button" className={ui.btn} style={{ justifyContent: 'space-between' }} onClick={() => load(member.id)}>
                <span>{member.fullName}</span>
                <span className={ui.muted}>{member.memberCode}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {profile && (
        <section className={ui.card}>
          <MemberProfileView profile={profile} />
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={() => setProfile(null)}>
              Clear
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={profile.chargeBalance <= 0}
              onClick={() => {
                setAmount(profile.chargeBalance.toFixed(2));
                setPaying(true);
              }}
            >
              Record payment
            </button>
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
            <input className={ui.input} inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={() => setPaying(false)}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || !amount}
              onClick={() =>
                run(
                  () => recordMemberPaymentAction(profile.id, amount),
                  () => {
                    setPaying(false);
                    load(profile.id);
                  }
                )
              }
            >
              Record payment
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
