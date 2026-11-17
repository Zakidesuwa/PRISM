// src/lib/dates.ts
// Business dates are Asia/Manila (UTC+8, no daylight saving). A business date
// is a 'YYYY-MM-DD' string; ranges are [from, to) in UTC instants.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface DateRange {
  from: Date;
  to: Date;
}

export function manilaDateOf(instant: Date): string {
  return new Date(instant.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function manilaToday(): string {
  return manilaDateOf(new Date());
}

export function isDateString(value: unknown): value is string {
  return (
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
  );
}

/** Midnight in Manila at the start of the given business date. */
export function startOfDay(date: string): Date {
  return new Date(`${date}T00:00:00+08:00`);
}

export function addDays(date: string, days: number): string {
  return manilaDateOf(new Date(startOfDay(date).getTime() + days * 86400000));
}

export function dayRange(date: string): DateRange {
  return { from: startOfDay(date), to: startOfDay(addDays(date, 1)) };
}

/** Inclusive business dates -> [from, to) instants. */
export function rangeOf(fromDate: string, toDate: string): DateRange {
  return { from: startOfDay(fromDate), to: startOfDay(addDays(toDate, 1)) };
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** First day of the month `offset` months away from the month containing `date`. */
export function shiftMonth(date: string, offset: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + offset;
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export function monthRange(date: string): DateRange {
  return { from: startOfDay(monthStart(date)), to: startOfDay(shiftMonth(date, 1)) };
}

export function yearRange(year: number): DateRange {
  return { from: startOfDay(`${year}-01-01`), to: startOfDay(`${year + 1}-01-01`) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthLabel(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1];
}

export function weekdayLabel(date: string): string {
  return DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function longDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;
}
