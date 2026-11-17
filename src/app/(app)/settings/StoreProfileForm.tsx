'use client';

import React, { useState } from 'react';
import ui from '@/styles/ui.module.css';
import { useAction } from '@/lib/useAction';
import { updateStoreProfileAction } from '@/actions/adminActions';

interface Branch {
  name: string;
  address: string;
  level: string;
  storeLocation: string;
  contactEmail: string;
  phone: string;
  defaultCreditLimit: number;
}

export default function StoreProfileForm({ branch }: { branch: Branch }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({ ...branch, defaultCreditLimit: String(branch.defaultCreditLimit) });

  const field = (key: keyof typeof form, label: string, span = false) => (
    <label className={`${ui.field} ${span ? ui.span2 : ''}`}>
      <span className={ui.label}>{label}</span>
      <input className={ui.input} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
    </label>
  );

  return (
    <section className={ui.card}>
      <div className={ui.cardHeader}>
        <h2 className={ui.cardTitle}>Store profile</h2>
      </div>
      <div className={ui.formGrid}>
        {field('name', 'Cooperative name', true)}
        {field('address', 'Address', true)}
        <label className={ui.field}>
          <span className={ui.label}>School level</span>
          <select className={ui.select} value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
            {['Elementary', 'High School', 'College'].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        {field('storeLocation', 'Store location on campus')}
        {field('contactEmail', 'Contact email')}
        {field('phone', 'Phone')}
        {field('defaultCreditLimit', 'Default credit limit for new members (₱)', true)}
      </div>
      <div className={ui.modalActions}>
        <button className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending} onClick={() => run(() => updateStoreProfileAction(form))}>
          Save profile
        </button>
      </div>
    </section>
  );
}
