'use client';

import React, { useState } from 'react';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { createAccountAction, postManualEntryAction } from '@/actions/accountingActions';

export function PrintButton() {
  return (
    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}

interface AccountOption {
  code: string;
  name: string;
}

/** "Add account" on the chart of accounts, "New journal entry" on the journal. */
export function LedgerForms({ mode, accounts }: { mode: string; accounts: AccountOption[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState({ code: '', name: '', type: 'EXPENSE', cashFlowGroup: 'OPERATING' });
  const [entry, setEntry] = useState({ description: '', debitCode: '', creditCode: '1010', amount: '' });

  const close = () => setOpen(false);

  const accountSelect = (value: string, onChange: (code: string) => void) => (
    <select className={ui.select} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose account…</option>
      {accounts.map((option) => (
        <option key={option.code} value={option.code}>
          {option.code} {option.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className={ui.noPrint}>
      <button className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => setOpen(true)}>
        {mode === 'accounts' ? '+ Add account' : '+ New journal entry'}
      </button>

      {open && mode === 'accounts' && (
        <Modal title="Add account" hint="Standard accounts are created for you. Add one for anything else you need to track." onClose={close}>
          <div className={ui.formGrid}>
            <label className={ui.field}>
              <span className={ui.label}>Code (4 digits)</span>
              <input className={ui.input} inputMode="numeric" value={account.code} onChange={(event) => setAccount({ ...account, code: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Type</span>
              <select className={ui.select} value={account.type} onChange={(event) => setAccount({ ...account, type: event.target.value })}>
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </label>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Account name</span>
              <input className={ui.input} value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} />
            </label>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Cash flow group</span>
              <select className={ui.select} value={account.cashFlowGroup} onChange={(event) => setAccount({ ...account, cashFlowGroup: event.target.value })}>
                <option value="OPERATING">Operating</option>
                <option value="INVESTING">Investing</option>
                <option value="FINANCING">Financing</option>
                <option value="CASH">Cash account (asset only)</option>
              </select>
            </label>
          </div>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending} onClick={() => run(() => createAccountAction(account), close)}>
              Add account
            </button>
          </div>
        </Modal>
      )}

      {open && mode === 'journal' && (
        <Modal
          title="New journal entry"
          hint="For anything the system does not post itself: expenses, paying a supplier, bank deposits, equipment."
          onClose={close}
        >
          <div className={ui.formGrid}>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Description</span>
              <input className={ui.input} placeholder="e.g. Electricity bill for March" value={entry.description} onChange={(event) => setEntry({ ...entry, description: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Debit (what was received or spent on)</span>
              {accountSelect(entry.debitCode, (debitCode) => setEntry({ ...entry, debitCode }))}
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Credit (where it came from)</span>
              {accountSelect(entry.creditCode, (creditCode) => setEntry({ ...entry, creditCode }))}
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Amount (₱)</span>
              <input className={ui.input} inputMode="decimal" value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} />
            </label>
          </div>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || !entry.amount || !entry.debitCode || !entry.creditCode}
              onClick={() =>
                run(
                  () => postManualEntryAction(entry),
                  () => {
                    setEntry({ description: '', debitCode: '', creditCode: '1010', amount: '' });
                    close();
                  }
                )
              }
            >
              Post entry
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
