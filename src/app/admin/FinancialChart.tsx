'use client';

import React, { useMemo, useRef, useState } from 'react';
import { financialOverview, type MonthlyFlow } from '@/data/adminMockData';
import styles from './page.module.css';

type View = 'Monthly View' | 'Quarterly View';

// Chart geometry, in viewBox units. The SVG scales to its container width.
const W = 800;
const H = 320;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const Y_MAX = 5000;
const Y_TICKS = [0, 1000, 2000, 3000, 4000, 5000];

interface Point {
  x: number;
  y: number;
}

/**
 * Catmull-Rom spline converted to cubic beziers — gives the mockup's soft
 * curve without pulling in a charting dependency.
 */
function smoothPath(points: Point[]): string {
  if (points.length < 2) return '';

  const tension = 0.2;
  const round = (n: number) => Math.round(n * 100) / 100;

  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }

  return d;
}

/** Rolls the 12 months up into Q1–Q4 for the quarterly view. */
function toQuarters(months: MonthlyFlow[]): MonthlyFlow[] {
  const quarters: MonthlyFlow[] = [];

  for (let i = 0; i < months.length; i += 3) {
    const chunk = months.slice(i, i + 3);
    quarters.push({
      month: `Q${i / 3 + 1}`,
      // Averaged, not summed, so both views share the same 0–5k axis.
      income: Math.round(chunk.reduce((sum, m) => sum + m.income, 0) / chunk.length),
      expenses: Math.round(chunk.reduce((sum, m) => sum + m.expenses, 0) / chunk.length),
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

export default function FinancialChart() {
  const [view, setView] = useState<View>('Monthly View');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(
    () => (view === 'Monthly View' ? financialOverview : toQuarters(financialOverview)),
    [view]
  );

  const { incomeLine, expenseLine, incomeArea, incomePoints, expensePoints } = useMemo(() => {
    const toPoints = (key: 'income' | 'expenses'): Point[] =>
      data.map((entry, index) => ({
        x: PAD.left + (index / (data.length - 1)) * PLOT_W,
        y: PAD.top + PLOT_H - (entry[key] / Y_MAX) * PLOT_H,
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
  }, [data]);

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

          {Y_TICKS.map((tick) => {
            const y = PAD.top + PLOT_H - (tick / Y_MAX) * PLOT_H;
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className={styles.gridLine} />
                <text x={PAD.left - 10} y={y + 4} className={styles.axisLabel} textAnchor="end">
                  {tick === 0 ? '0' : `${tick / 1000}k`}
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
