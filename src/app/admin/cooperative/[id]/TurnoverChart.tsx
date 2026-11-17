'use client';

import React, { useRef, useState } from 'react';
import type { DayTurnover } from '@/lib/adminTypes';
import styles from './page.module.css';

const W = 640;
const H = 300;
const PAD = { top: 12, right: 12, bottom: 32, left: 42 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const Y_TICKS = [0, 25, 50, 75, 100];

const FULL_DAY: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

/** Straight-segment stacked areas, matching the angular look of the design. */
export default function TurnoverChart({ data }: { data: DayTurnover[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const x = (index: number) => PAD.left + (index / (data.length - 1)) * PLOT_W;
  const y = (percent: number) => PAD.top + PLOT_H - (percent / 100) * PLOT_H;
  const baseline = PAD.top + PLOT_H;

  const lower = data.map((entry, index) => ({ x: x(index), y: y(entry.inventory) }));
  const upper = data.map((entry, index) => ({
    x: x(index),
    y: y(entry.inventory + entry.sales),
  }));

  const toLine = (points: { x: number; y: number }[]) =>
    points.map((point) => `${point.x} ${Math.round(point.y * 100) / 100}`).join(' L ');

  // Inventory sits on the baseline; sales stack directly on top of it.
  const inventoryArea = `M ${lower[0].x} ${baseline} L ${toLine(lower)} L ${lower[lower.length - 1].x} ${baseline} Z`;
  const salesArea = `M ${toLine(upper)} L ${toLine([...lower].reverse())} Z`;

  /** Maps the pointer's position to the nearest day, in viewBox space. */
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
      : { entry: data[activeIndex], lower: lower[activeIndex], upper: upper[activeIndex] };

  // Keep the tooltip inside the card at the first and last days.
  let tooltipShift = '-50%';
  if (activeIndex !== null) {
    const ratio = activeIndex / (data.length - 1);
    if (ratio < 0.12) tooltipShift = '-10%';
    else if (ratio > 0.88) tooltipShift = '-90%';
  }

  return (
    <div className={styles.chartWrap}>
      <svg
        ref={svgRef}
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setActiveIndex(null)}
        role="img"
        aria-label="Sales versus inventory turnover across the week"
      >
        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} y1={y(tick)} x2={W - PAD.right} y2={y(tick)} className={styles.gridLine} />
            <text x={PAD.left - 8} y={y(tick) + 4} className={styles.axisLabel} textAnchor="end">
              {tick}%
            </text>
          </g>
        ))}

        <path d={inventoryArea} className={styles.inventoryArea} />
        <path d={salesArea} className={styles.salesArea} />

        {/* Data point circles rendered for all days on both curves */}
        {lower.map((pt, idx) => (
          <g key={`data-points-${idx}`}>
            {/* Inventory point circle */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={idx === activeIndex ? 5.5 : 4}
              className={styles.markerInventory}
              style={{
                cursor: 'pointer',
                filter: idx === activeIndex ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : 'none',
              }}
            />
            {/* Sales point circle */}
            <circle
              cx={upper[idx].x}
              cy={upper[idx].y}
              r={idx === activeIndex ? 5.5 : 4}
              className={styles.markerSales}
              style={{
                cursor: 'pointer',
                filter: idx === activeIndex ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : 'none',
              }}
            />
          </g>
        ))}

        {active && (
          <g className={styles.hoverGroup}>
            <line
              x1={active.upper.x}
              y1={PAD.top}
              x2={active.upper.x}
              y2={baseline}
              className={styles.guideLine}
            />
            {/* Active highlight outer rings */}
            <circle cx={active.lower.x} cy={active.lower.y} r="8" fill="none" stroke="#60A5FA" strokeWidth="1.5" opacity="0.8" />
            <circle cx={active.upper.x} cy={active.upper.y} r="8" fill="none" stroke="#2563EB" strokeWidth="1.5" opacity="0.8" />
          </g>
        )}

        {data.map((entry, index) => (
          <text
            key={entry.day}
            x={x(index)}
            y={H - 10}
            className={`${styles.axisLabel} ${index === activeIndex ? styles.axisLabelActive : ''}`}
            textAnchor="middle"
          >
            {entry.day}
          </text>
        ))}

        {/* Transparent capture layer so the pointer is tracked across the
            whole chart, including above the stacked areas. */}
        <rect x="0" y="0" width={W} height={H} fill="transparent" style={{ pointerEvents: 'all' }} />
      </svg>

      {active && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(active.upper.x / W) * 100}%`,
            top: `${(active.upper.y / H) * 100}%`,
            transform: `translate(${tooltipShift}, calc(-100% - 12px))`,
          }}
        >
          <p className={styles.tooltipDay}>{FULL_DAY[active.entry.day] ?? active.entry.day}</p>
          <p className={styles.tooltipRow}>
            <span className={`${styles.tooltipDot} ${styles.dotSales}`} />
            Sales
            <span className={styles.tooltipValue}>{active.entry.sales}%</span>
          </p>
          <p className={styles.tooltipRow}>
            <span className={`${styles.tooltipDot} ${styles.dotInventory}`} />
            Inventory
            <span className={styles.tooltipValue}>{active.entry.inventory}%</span>
          </p>
          <p className={styles.tooltipTotal}>
            Total turnover
            <span className={styles.tooltipValue}>
              {active.entry.sales + active.entry.inventory}%
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
