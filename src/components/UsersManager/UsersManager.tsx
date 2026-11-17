'use client';

import React, { useState } from 'react';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { formatManilaDate } from '@/utils/formatters';
import { createUserAction, resetPasswordAction, updateUserAction } from '@/actions/adminActions';
import type { UserRow } from '@/services/userService';

interface Props {
  users: UserRow[];
  currentUserId: string;
  /** Given to an administrator, who assigns users to any cooperative. */
  branches?: { id: number; name: string }[];
}

type Dialog = { kind: 'create' } | { kind: 'edit'; user: UserRow } | { kind: 'password'; user: UserRow } | null;

const STORE_ROLES: Role[] = ['MANAGER', 'CASHIER', 'STOREKEEPER'];

export default function UsersManager({ users, currentUserId, branches }: Props) {
  const isAdmin = Boolean(branches);
  const roles: Role[] = isAdmin ? [...STORE_ROLES, 'ADMIN'] : STORE_ROLES;

  const { run, pending } = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState({ username: '', name: '', role: 'CASHIER', password: '', branchId: '', isActive: true });
  const [password, setPassword] = useState('');

  const close = () => setDialog(null);

  function openCreate() {
    setForm({ username: '', name: '', role: 'CASHIER', password: '', branchId: branches?.[0] ? String(branches[0].id) : '', isActive: true });
    setDialog({ kind: 'create' });
  }

  function openEdit(user: UserRow) {
    setForm({ username: user.username, name: user.name, role: user.role, password: '', branchId: String(user.branchId ?? ''), isActive: user.isActive });
    setDialog({ kind: 'edit', user });
  }

  return (
    <section className={ui.card}>
      <div className={ui.cardHeader}>
        <div>
          <h2 className={ui.cardTitle}>User accounts</h2>
          <span className={ui.muted}>
            {isAdmin ? 'Every account in the system.' : 'Accounts for your cooperative. Each role only sees the screens it needs.'}
          </span>
        </div>
        <button className={`${ui.btn} ${ui.btnPrimary}`} onClick={openCreate}>
          + Add user
        </button>
      </div>

      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              {isAdmin && <th>Cooperative</th>}
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className={ui.strong}>
                  {user.name}
                  {user.id === currentUserId && <span className={ui.muted}> (you)</span>}
                </td>
                <td>{user.username}</td>
                <td>
                  <span className={`${ui.badge} ${user.role === 'ADMIN' || user.role === 'MANAGER' ? ui.badgeBlue : ''}`}>
                    {ROLE_LABEL[user.role]}
                  </span>
                </td>
                {isAdmin && <td>{user.branchName ?? 'All (district)'}</td>}
                <td>
                  <span className={`${ui.badge} ${user.isActive ? ui.badgeGreen : ui.badgeRed}`}>
                    {user.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td>{formatManilaDate(user.createdAt)}</td>
                <td>
                  <div className={ui.row} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                    <button className={`${ui.btn} ${ui.btnSmall}`} onClick={() => openEdit(user)}>
                      Edit
                    </button>
                    <button
                      className={`${ui.btn} ${ui.btnSmall}`}
                      onClick={() => {
                        setPassword('');
                        setDialog({ kind: 'password', user });
                      }}
                    >
                      Reset password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <Modal title={dialog.kind === 'create' ? 'Add user' : `Edit ${dialog.user.name}`} onClose={close}>
          <div className={ui.formGrid}>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Full name</span>
              <input className={ui.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Username</span>
              <input
                className={ui.input}
                value={form.username}
                disabled={dialog.kind === 'edit'}
                autoComplete="off"
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Role</span>
              <select className={ui.select} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </label>
            {dialog.kind === 'create' && isAdmin && form.role !== 'ADMIN' && (
              <label className={`${ui.field} ${ui.span2}`}>
                <span className={ui.label}>Cooperative</span>
                <select className={ui.select} value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}>
                  {branches!.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dialog.kind === 'create' ? (
              <label className={`${ui.field} ${ui.span2}`}>
                <span className={ui.label}>Password (at least 6 characters)</span>
                <input
                  className={ui.input}
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </label>
            ) : (
              <label className={`${ui.field} ${ui.span2}`}>
                <span className={ui.label}>Status</span>
                <select
                  className={ui.select}
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={(event) => setForm({ ...form, isActive: event.target.value === 'active' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Deactivated (cannot sign in)</option>
                </select>
              </label>
            )}
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
                      ? createUserAction({
                          username: form.username,
                          name: form.name,
                          role: form.role,
                          password: form.password,
                          branchId: form.branchId ? Number(form.branchId) : null,
                        })
                      : updateUserAction(dialog.user.id, { name: form.name, role: form.role, isActive: form.isActive }),
                  close
                )
              }
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'password' && (
        <Modal title={`Reset password: ${dialog.user.name}`} hint="Give the new password to the user in person." onClose={close}>
          <label className={ui.field}>
            <span className={ui.label}>New password (at least 6 characters)</span>
            <input className={ui.input} type="password" autoComplete="new-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || password.length < 6}
              onClick={() => run(() => resetPasswordAction(dialog.user.id, password), close)}
            >
              Reset password
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
