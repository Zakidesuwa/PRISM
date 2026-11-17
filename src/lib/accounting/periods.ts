// src/lib/accounting/periods.ts
//
// Reporting periods for the financial statements, as inclusive Manila
// business-date ranges. Pure and isomorphic.

export interface Period {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
}

export type PresetId = 'this-month' | 'last-month' | 'this-quarter' | 'year-to-date' | 'last-year';

export const PERIOD_PRESETS: { id: PresetId; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'this-quarter', label: 'This quarter' },
  { id: 'year-to-date', label: 'Year to date' },
  { id: 'last-year', label: 'Last year' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** Last day of a 1-based month. */
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function presetPeriod(id: PresetId, today: string): Period {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (id) {
    case 'this-month':
      return { from: key(y, m, 1), to: today };
    case 'last-month': {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return { from: key(ly, lm, 1), to: key(ly, lm, lastDay(ly, lm)) };
    }
    case 'this-quarter':
      return { from: key(y, Math.floor((m - 1) / 3) * 3 + 1, 1), to: today };
    case 'year-to-date':
      return { from: key(y, 1, 1), to: today };
    case 'last-year':
      return { from: key(y - 1, 1, 1), to: key(y - 1, 12, 31) };
  }
}

/** Which preset (if any) a period matches exactly. */
export function matchPreset(period: Period, today: string): PresetId | null {
  for (const p of PERIOD_PRESETS) {
    const candidate = presetPeriod(p.id, today);
    if (candidate.from === period.from && candidate.to === period.to) return p.id;
  }
  return null;
}

/** "Nov 1 – 17, 2026", "Oct 1 – Nov 17, 2026", "Dec 1, 2025 – Jan 31, 2026" */
export function formatPeriod({ from, to }: Period): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(new Date(`${d}T00:00:00Z`));
  if (from === to) return fmt(to, { month: 'long', day: 'numeric', year: 'numeric' });
  if (from.slice(0, 4) !== to.slice(0, 4)) {
    return `${fmt(from, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmt(to, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${fmt(from, { month: 'short', day: 'numeric' })} – ${fmt(to, { day: 'numeric' })}, ${to.slice(0, 4)}`;
  }
  return `${fmt(from, { month: 'short', day: 'numeric' })} – ${fmt(to, { month: 'short', day: 'numeric' })}, ${to.slice(0, 4)}`;
}

/** "November 17, 2026" */
export function formatAsOf(date: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(`${date}T00:00:00Z`)
  );
}
