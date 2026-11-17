'use client';

import React, { useState } from 'react';
import { Plus, Printer, Trash2, Undo2 } from 'lucide-react';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { formatCurrency } from '@/utils/formatters';
import { CODE_RANGES_HELP, SUBTYPES_BY_TYPE, SUBTYPE_LABELS, type AccountType } from '@/lib/accounting/chartOfAccounts';
import {
  createAccountAction,
  postManualEntryAction,
  reverseJournalEntryAction,
  setAccountActiveAction,
} from '@/actions/accountingActions';

export function PrintButton() {
  return (
    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" />
      Print / Save PDF
    </button>
  );
}

interface AccountOption {
  code: string;
  name: string;
}

interface Line {
  code: string;
  debit: string;
  credit: string;
}

const EMPTY_LINE: Line = { code: '', debit: '', credit: '' };
const cents = (value: string) => Math.round((Number(value) || 0) * 100);

/** "Add account" on the chart of accounts, "New journal entry" on the journal. */
export function LedgerForms({ mode, accounts, today }: { mode: string; accounts: AccountOption[]; today: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState({ code: '', name: '', subtype: 'OPERATING_EXPENSE', description: '' });
  const [entry, setEntry] = useState({ description: '', date: today });
  const [lines, setLines] = useState<Line[]>([EMPTY_LINE, EMPTY_LINE]);

  const close = () => setOpen(false);

  const debitCents = lines.reduce((sum, line) => sum + cents(line.debit), 0);
  const creditCents = lines.reduce((sum, line) => sum + cents(line.credit), 0);
  const difference = debitCents - creditCents;

  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((previous) => previous.map((line, position) => (position === index ? { ...line, ...patch } : line)));

  function resetEntry() {
    setEntry({ description: '', date: today });
    setLines([EMPTY_LINE, EMPTY_LINE]);
  }

  return (
    <div className={ui.noPrint}>
      <button className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        {mode === 'accounts' ? 'Add account' : 'New journal entry'}
      </button>

      {open && mode === 'accounts' && (
        <Modal title="Add account" hint={`Standard accounts are created for you. Codes: ${CODE_RANGES_HELP}.`} onClose={close}>
          <div className={ui.formGrid}>
            <label className={ui.field}>
              <span className={ui.label}>Code (4 digits)</span>
              <input className={ui.input} inputMode="numeric" value={account.code} onChange={(event) => setAccount({ ...account, code: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Group</span>
              <select className={ui.select} value={account.subtype} onChange={(event) => setAccount({ ...account, subtype: event.target.value })}>
                {(Object.keys(SUBTYPES_BY_TYPE) as AccountType[]).map((type) => (
                  <optgroup key={type} label={type.charAt(0) + type.slice(1).toLowerCase()}>
                    {SUBTYPES_BY_TYPE[type].map((subtype) => (
                      <option key={subtype} value={subtype}>
                        {SUBTYPE_LABELS[subtype]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Account name</span>
              <input className={ui.input} value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} />
            </label>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Description (optional)</span>
              <input className={ui.input} value={account.description} onChange={(event) => setAccount({ ...account, description: event.target.value })} />
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
          hint="For anything the system does not post itself: expenses, paying a supplier, bank deposits, equipment. Each line is a debit or a credit; the totals must match."
          wide
          onClose={close}
        >
          <div className={ui.formGrid}>
            <label className={ui.field}>
              <span className={ui.label}>Description</span>
              <input
                className={ui.input}
                placeholder="e.g. Electricity bill for March"
                value={entry.description}
                onChange={(event) => setEntry({ ...entry, description: event.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Date</span>
              <input type="date" className={ui.input} max={today} value={entry.date} onChange={(event) => setEntry({ ...entry, date: event.target.value })} />
            </label>
          </div>

          <table className={ui.table} style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Account</th>
                <th className={ui.num} style={{ width: 140 }}>
                  Debit
                </th>
                <th className={ui.num} style={{ width: 140 }}>
                  Credit
                </th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td>
                    <select
                      className={ui.select}
                      aria-label={`Line ${index + 1} account`}
                      value={line.code}
                      onChange={(event) => setLine(index, { code: event.target.value })}
                    >
                      <option value="">Choose account…</option>
                      {accounts.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.code} {option.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      inputMode="decimal"
                      aria-label={`Line ${index + 1} debit`}
                      value={line.debit}
                      onChange={(event) => setLine(index, { debit: event.target.value, credit: event.target.value ? '' : line.credit })}
                    />
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      inputMode="decimal"
                      aria-label={`Line ${index + 1} credit`}
                      value={line.credit}
                      onChange={(event) => setLine(index, { credit: event.target.value, debit: event.target.value ? '' : line.debit })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.btnSmall}`}
                      disabled={lines.length <= 2}
                      onClick={() => setLines(lines.filter((_, position) => position !== index))}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => setLines([...lines, EMPTY_LINE])}>
                    <Plus size={14} aria-hidden="true" />
                    Add line
                  </button>
                </td>
                <td className={ui.num}>{formatCurrency(debitCents / 100)}</td>
                <td className={ui.num}>{formatCurrency(creditCents / 100)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <div className={difference === 0 && debitCents > 0 ? ui.notice : ui.warning} style={{ marginTop: 12 }} aria-live="polite">
            {debitCents === 0
              ? 'Enter the amounts.'
              : difference === 0
                ? 'Balanced: debits equal credits.'
                : `Not balanced: debits are ${formatCurrency(Math.abs(difference) / 100)} ${difference > 0 ? 'more' : 'less'} than credits.`}
          </div>

          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || difference !== 0 || debitCents === 0 || !entry.description.trim()}
              onClick={() =>
                run(
                  () => postManualEntryAction({ description: entry.description, date: entry.date, lines }),
                  () => {
                    resetEntry();
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

/** Reverse a manual entry (entries are never edited or deleted). */
export function JournalReverseButton({ entryId }: { entryId: number }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <>
      <button type="button" className={`${ui.btn} ${ui.btnSmall} ${ui.noPrint}`} style={{ marginTop: 4 }} onClick={() => setOpen(true)}>
        <Undo2 size={14} aria-hidden="true" />
        Reverse
      </button>
      {open && (
        <Modal
          title={`Reverse JE-${entryId}`}
          hint="A mirror-image entry is posted today. The original stays in the journal, so the history is never lost."
          onClose={() => setOpen(false)}
        >
          <label className={ui.field}>
            <span className={ui.label}>Reason</span>
            <input className={ui.input} autoFocus value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnDanger}`}
              disabled={pending || !reason.trim()}
              onClick={() => run(() => reverseJournalEntryAction(entryId, reason), () => setOpen(false))}
            >
              Post reversal
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AccountRowActions({ accountId, isActive, hasBalance }: { accountId: number; isActive: boolean; hasBalance: boolean }) {
  const { run, pending } = useAction();
  return (
    <button
      type="button"
      className={`${ui.btn} ${ui.btnSmall}`}
      disabled={pending || (isActive && hasBalance)}
      title={isActive && hasBalance ? 'Only accounts with a zero balance can be deactivated.' : undefined}
      onClick={() => run(() => setAccountActiveAction(accountId, !isActive))}
    >
      {isActive ? 'Deactivate' : 'Reactivate'}
    </button>
  );
}
