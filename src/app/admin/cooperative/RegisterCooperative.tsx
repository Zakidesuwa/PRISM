'use client';

import React, { useState } from 'react';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { createBranchAction } from '@/actions/adminActions';

const EMPTY = { name: '', address: '', level: 'Elementary', storeLocation: '', contactEmail: '', phone: '' };

export default function RegisterCooperative() {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const field = (key: keyof typeof EMPTY, label: string, span = false) => (
    <label className={`${ui.field} ${span ? ui.span2 : ''}`}>
      <span className={ui.label}>{label}</span>
      <input className={ui.input} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
    </label>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
      <button
        className={`${ui.btn} ${ui.btnPrimary}`}
        onClick={() => {
          setForm(EMPTY);
          setOpen(true);
        }}
      >
        + Register cooperative
      </button>

      {open && (
        <Modal
          title="Register a school cooperative"
          hint="It starts with the standard chart of accounts. Add its manager under Users afterwards."
          onClose={() => setOpen(false)}
        >
          <div className={ui.formGrid}>
            {field('name', 'School / cooperative name', true)}
            {field('address', 'Address', true)}
            <label className={ui.field}>
              <span className={ui.label}>School level</span>
              <select className={ui.select} value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
                {['Elementary', 'High School', 'College'].map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            {field('storeLocation', 'Store location on campus')}
            {field('contactEmail', 'Contact email')}
            {field('phone', 'Phone')}
          </div>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending} onClick={() => run(() => createBranchAction(form), () => setOpen(false))}>
              Register
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
