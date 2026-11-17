// src/lib/dailySales/businessDate.ts
//
// A "business date" is a calendar day in Asia/Manila (UTC+8, no DST), written
// as a YYYY-MM-DD key. Every daily figure in PRISM is bucketed by this key, so
// a sale at 7:30 AM Manila time (23:30 UTC the previous day) still lands on the
// correct day. Isomorphic: safe to import from server and client code.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a well-formed, real calendar date such as "2026-11-17". */
export function isValidDateKey(key: unknown): key is string {
  if (typeof key !== 'string' || !DATE_KEY_RE.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

/** The Manila business date that `instant` falls on. */
export function toDateKey(instant: Date): string {
  return new Date(instant.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's Manila business date. */
export function todayDateKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/** Half-open UTC instant range [start, end) covering the whole Manila day. */
export function dayRange(key: string): { start: Date; end: Date } {
  const start = new Date(`${key}T00:00:00+08:00`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Value to store in / compare against a Postgres `@db.Date` column. */
export function dateKeyToDbDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** Inverse of dateKeyToDbDate. */
export function dbDateToDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDateKey(key: string, days: number): string {
  return new Date(dateKeyToDbDate(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Hour of day (0–23) in Manila. */
export function manilaHour(instant: Date): number {
  return new Date(instant.getTime() + MANILA_OFFSET_MS).getUTCHours();
}

/** "Tuesday, November 17, 2026" */
export function formatDateKeyLong(key: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateKeyToDbDate(key));
}
