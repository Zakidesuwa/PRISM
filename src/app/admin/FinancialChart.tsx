'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { MonthlyFlow } from '@/lib/adminTypes';
import styles from './page.module.css';

type View = 'Monthly View' | 'Quarterly View';

// Chart geometry, in viewBox units. The SVG scales to its container width.
const W = 800;
const H = 320;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

interface Point {
  x: number;
  y: number;
}

/**
 * A y-axis that fits the data: the top is the largest value rounded up to a
 * "nice" step (1, 2, 2.5 or 5 × a power of ten), with about five gridlines.
 */
function niceAxis(maxValue: number): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: 5000, ticks: [0, 1000, 2000, 3000, 4000, 5000] };

  const rough = maxValue / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;

  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max + step / 2; tick += step) ticks.push(tick);
  return { max, ticks };
}

function formatTick(value: number) {
  if (value === 0) return '0';
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${+(value / 1000).toFixed(1)}k`;
  return String(value);
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson) as cubic beziers. Unlike a
 * Catmull-Rom spline it never overshoots: between two points the curve stays
 * within their values, so it cannot dip below zero or rise above the axis.
 */
function smoothPath(points: Point[]): string {
  if (points.length < 2) return '';

  const round = (n: number) => Math.round(n * 100) / 100;
  const n = points.length;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push((points[i + 1].y - points[i].y) / dx[i]);
  }

  const tangent: number[] = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = dx[i] / 3;
    const p1 = points[i];
    const p2 = points[i + 1];
    d += ` C ${round(p1.x + third)} ${round(p1.y + tangent[i] * third)}, ${round(p2.x - third)} ${round(
      p2.y - tangent[i + 1] * third
    )}, ${round(p2.x)} ${round(p2.y)}`;
  }

  return d;
}

/**
 * Rolls the 12 months up into four 3-month periods, totalled. The months are
 * the last twelve, not a calendar year, so each period is labelled by its
 * months (e.g. "Dec–Feb") rather than Q1–Q4.
 */
function toQuarters(months: MonthlyFlow[]): MonthlyFlow[] {
  const quarters: MonthlyFlow[] = [];

  for (let i = 0; i < months.length; i += 3) {
    const chunk = months.slice(i, i + 3);
    quarters.push({
      month: chunk.length > 1 ? `${chunk[0].month}–${chunk[chunk.length - 1].month}` : chunk[0].month,
      income: Math.round(chunk.reduce((sum, m) => sum + m.income, 0) * 100) / 100,
      expenses: Math.round(chunk.reduce((sum, m) => sum + m.expenses, 0) * 100) / 100,
    });
  }

  return quarters;
}

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function FinancialChart({ data: financialOverview }: { data: MonthlyFlow[] }) {
  const [view, setView] = useState<View>('Monthly View');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(
    () => (view === 'Monthly View' ? financialOverview : toQuarters(financialOverview)),
    [view, financialOverview]
  );

  const axis = useMemo(
    () => niceAxis(Math.max(0, ...data.map((entry) => Math.max(entry.income, entry.expenses)))),
    [data]
  );

  const { incomeLine, expenseLine, incomeArea, incomePoints, expensePoints } = useMemo(() => {
    const toPoints = (key: 'income' | 'expenses'): Point[] =>
      data.map((entry, index) => ({
        x: PAD.left + (index / (data.length - 1)) * PLOT_W,
        y: PAD.top + PLOT_H - (Math.max(0, entry[key]) / axis.max) * PLOT_H,
      }));

    const income = toPoints('income');
    const expenses = toPoints('expenses');

    const baseline = PAD.top + PLOT_H;
    const area = `${smoothPath(income)} L ${income[income.length - 1].x} ${baseline} L ${income[0].x} ${baseline} Z`;

    return {
      incomeLine: smoothPath(income),
      expenseLine: smoothPath(expenses),
      incomeArea: area,
      incomePoints: income,
      expensePoints: expenses,
    };
  }, [data, axis]);

  /** Maps the pointer's position to the nearest month, in viewBox space. */
  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;

    const bounds = svg.getBoundingClientRect();
    if (bounds.width === 0) return;

    // The viewBox scales uniformly to the rendered width, so this is a
    // straight ratio — no need for getScreenCTM.
    const xInViewBox = ((event.clientX - bounds.left) / bounds.width) * W;
    const ratio = (xInViewBox - PAD.left) / PLOT_W;
    const index = Math.round(ratio * (data.length - 1));

    setActiveIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const active =
    activeIndex === null
      ? null
      : {
          entry: data[activeIndex],
          income: incomePoints[activeIndex],
          expenses: expensePoints[activeIndex],
        };

  // Keep the tooltip inside the card at the first and last data points.
  let tooltipShift = '-50%';
  if (activeIndex !== null) {
    const ratio = activeIndex / (data.length - 1);
    if (ratio < 0.12) tooltipShift = '-12%';
    else if (ratio > 0.88) tooltipShift = '-88%';
  }

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2 className={styles.cardTitle}>Financial Overview</h2>

        <div className={styles.chartControls}>
          <span className={styles.legendItem}>
            Income <span className={`${styles.legendSwatch} ${styles.swatchIncome}`} />
          </span>
          <span className={styles.legendItem}>
            Expenses <span className={`${styles.legendSwatch} ${styles.swatchExpenses}`} />
          </span>

          <label className={styles.selectWrapper}>
            <span className={styles.srOnly}>Chart range</span>
            <select
              className={styles.select}
              value={view}
              onChange={(event) => {
                setView(event.target.value as View);
                setActiveIndex(null);
              }}
            >
              <option>Monthly View</option>
              <option>Quarterly View</option>
            </select>
          </label>
        </div>
      </div>

      <div className={styles.chartWrap}>
        <svg
          ref={svgRef}
          className={styles.chart}
          viewBox={`0 0 ${W} ${H}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(null)}
          role="img"
          aria-label={`Income and expenses, ${view.toLowerCase()}, from ${data[0].month} to ${data[data.length - 1].month}.`}
        >
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>

          {axis.ticks.map((tick) => {
            const y = PAD.top + PLOT_H - (tick / axis.max) * PLOT_H;
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className={styles.gridLine} />
                <text x={PAD.left - 10} y={y + 4} className={styles.axisLabel} textAnchor="end">
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}

          <path d={incomeArea} fill="url(#incomeFill)" />
          <path d={expenseLine} className={styles.expenseLine} />
          <path d={incomeLine} className={styles.incomeLine} />

          {active && (
            <g className={styles.hoverGroup}>
              <line
                x1={active.income.x}
                y1={PAD.top}
                x2={active.income.x}
                y2={PAD.top + PLOT_H}
                className={styles.guideLine}
              />
              <circle cx={active.expenses.x} cy={active.expenses.y} r="5" className={styles.markerExpenses} />
              <circle cx={active.income.x} cy={active.income.y} r="5" className={styles.markerIncome} />
            </g>
          )}

          {data.map((entry, index) => (
            <text
              key={entry.month}
              x={PAD.left + (index / (data.length - 1)) * PLOT_W}
              y={H - 8}
              className={`${styles.axisLabel} ${index === activeIndex ? styles.axisLabelActive : ''}`}
              textAnchor="middle"
            >
              {entry.month}
            </text>
          ))}

          {/* Transparent capture layer so the pointer is tracked across the
              whole card, including the gaps between lines. */}
          <rect x="0" y="0" width={W} height={H} fill="transparent" style={{ pointerEvents: 'all' }} />
        </svg>

        {active && (
          <div
            className={styles.tooltip}
            style={{
              left: `${(active.income.x / W) * 100}%`,
              top: `${(Math.min(active.income.y, active.expenses.y) / H) * 100}%`,
              transform: `translate(${tooltipShift}, calc(-100% - 12px))`,
            }}
          >
            <p className={styles.tooltipMonth}>{active.entry.month}</p>
            <p className={styles.tooltipRow}>
              <span className={`${styles.tooltipDot} ${styles.swatchIncome}`} />
              Income
              <span className={styles.tooltipValue}>{formatPeso(active.entry.income)}</span>
            </p>
            <p className={styles.tooltipRow}>
              <span className={`${styles.tooltipDot} ${styles.swatchExpenses}`} />
              Expenses
              <span className={styles.tooltipValue}>{formatPeso(active.entry.expenses)}</span>
            </p>
            <p className={styles.tooltipNet}>
              Net
              <span className={styles.tooltipValue}>
                {formatPeso(active.entry.income - active.entry.expenses)}
              </span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
