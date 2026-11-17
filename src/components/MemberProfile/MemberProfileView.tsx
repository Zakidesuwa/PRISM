'use client';

import React from 'react';
import ui from '@/styles/ui.module.css';
import { formatCurrency, formatManilaDate, formatManilaDateTime } from '@/utils/formatters';
import type { MemberProfile } from '@/services/memberService';

const LEDGER_LABEL: Record<string, string> = {
  CHARGE: 'Charge sale',
  PAYMENT: 'Payment received',
  SHARE_CAPITAL: 'Share capital paid in',
  VOID: 'Charge sale voided',
};

/** A member's balances, purchases and ledger. Used on Members and Member Lookup. */
export default function MemberProfileView({ profile }: { profile: MemberProfile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={ui.row} style={{ justifyContent: 'space-between' }}>
        <div>
          <div className={ui.title}>{profile.fullName}</div>
          <div className={ui.subtitle}>
            {profile.memberCode} · member since {formatManilaDate(profile.joinedAt)}
            {profile.phone ? ` · ${profile.phone}` : ''}
          </div>
        </div>
        <span className={`${ui.badge} ${profile.status === 'ACTIVE' ? ui.badgeGreen : ui.badgeRed}`}>
          {profile.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className={ui.statGrid}>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Balance owed</div>
          <div className={`${ui.statValue} ${profile.chargeBalance > 0 ? ui.negative : ''}`}>
            {formatCurrency(profile.chargeBalance)}
          </div>
          <div className={ui.statHint}>From charge sales</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Credit left</div>
          <div className={ui.statValue}>{formatCurrency(profile.availableCredit)}</div>
          <div className={ui.statHint}>Limit {formatCurrency(profile.creditLimit)}</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Patronage</div>
          <div className={ui.statValue}>{formatCurrency(profile.accumulatedPatronage)}</div>
          <div className={ui.statHint}>Total purchases to date</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Share capital</div>
          <div className={ui.statValue}>{formatCurrency(profile.shareCapital)}</div>
        </div>
      </div>

      <div className={ui.grid2}>
        <div>
          <div className={ui.cardTitle} style={{ marginBottom: 8 }}>
            Recent purchases
          </div>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Sale</th>
                  <th>When</th>
                  <th>Paid by</th>
                  <th className={ui.num}>Total</th>
                </tr>
              </thead>
              <tbody>
                {profile.purchases.map((sale) => (
                  <tr key={sale.id} style={sale.status === 'VOIDED' ? { opacity: 0.5 } : undefined}>
                    <td className={ui.strong}>{sale.transactionNumber}</td>
                    <td>{formatManilaDateTime(sale.createdAt)}</td>
                    <td>{sale.status === 'VOIDED' ? 'Voided' : sale.paymentMethod}</td>
                    <td className={ui.num}>{formatCurrency(sale.totalAmount)}</td>
                  </tr>
                ))}
                {profile.purchases.length === 0 && (
                  <tr>
                    <td colSpan={4} className={ui.empty}>
                      No purchases yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className={ui.cardTitle} style={{ marginBottom: 8 }}>
            Member ledger
          </div>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Entry</th>
                  <th className={ui.num}>Amount</th>
                  <th className={ui.num}>Owed after</th>
                </tr>
              </thead>
              <tbody>
                {profile.ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatManilaDateTime(entry.createdAt)}</td>
                    <td>
                      {LEDGER_LABEL[entry.type] ?? entry.type}
                      {entry.reference ? ` ${entry.reference}` : ''}
                    </td>
                    <td className={ui.num}>{formatCurrency(entry.amount)}</td>
                    <td className={ui.num}>{formatCurrency(entry.chargeBalanceAfter)}</td>
                  </tr>
                ))}
                {profile.ledger.length === 0 && (
                  <tr>
                    <td colSpan={4} className={ui.empty}>
                      No ledger entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
