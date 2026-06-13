"use client";

import { useMemo } from "react";
import type { YearEndProjectionMonth } from "@/lib/year-end-projection";

const STROKE_ACTUAL = "#34d399";
const STROKE_FORECAST = "rgba(52, 211, 153, 0.42)";

function sparklineCoords(values: number[], w: number, h: number): Array<{ x: number; y: number }> {
  const max = Math.max(1, ...values);
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) {
    const y = h - (values[0]! / max) * (h - 6) - 3;
    return [
      { x: 0, y },
      { x: w, y }
    ];
  }
  return values.map((v, i) => ({
    x: (i / (n - 1)) * w,
    y: h - (v / max) * (h - 6) - 3
  }));
}

function smoothSparklinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) {
    const p = coords[0]!;
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }

  let d = `M ${coords[0]!.x.toFixed(1)} ${coords[0]!.y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[Math.min(i + 2, coords.length - 1)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function ProjectionSparkline({
  series,
  currentMonthKey
}: {
  series: YearEndProjectionMonth[];
  currentMonthKey: string;
}) {
  const w = 280;
  const h = 64;
  const values = series.map((row) => row.cumulativeHt);
  const coords = sparklineCoords(values, w, h);

  const splitIndex = useMemo(() => {
    const idx = series.findIndex((row) => row.monthKey === currentMonthKey);
    return idx >= 0 ? idx : series.findLastIndex((row) => row.kind === "actual");
  }, [series, currentMonthKey]);

  const actualCoords = coords.slice(0, Math.max(splitIndex + 1, 1));
  const forecastCoords =
    splitIndex >= 0 && splitIndex < coords.length - 1
      ? coords.slice(splitIndex)
      : [];

  const actualPath = smoothSparklinePath(actualCoords);
  const forecastPath = smoothSparklinePath(forecastCoords);
  const pivotX = coords[splitIndex]?.x;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      <line x1="0" y1={h - 3} x2={w} y2={h - 3} className="stroke-ink-300/60 dark:stroke-white/15" strokeWidth="1" />
      {pivotX != null ? (
        <line
          x1={pivotX}
          y1={4}
          x2={pivotX}
          y2={h - 3}
          className="stroke-ink-300/50 dark:stroke-white/12"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      ) : null}
      {actualPath ? (
        <path
          d={actualPath}
          fill="none"
          stroke={STROKE_ACTUAL}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {forecastPath ? (
        <path
          d={forecastPath}
          fill="none"
          stroke={STROKE_FORECAST}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />
      ) : null}
    </svg>
  );
}

export function YearEndProjectionChart({
  series,
  currentMonthKey,
  year,
  ariaLabel
}: {
  series: YearEndProjectionMonth[];
  currentMonthKey: string;
  year: number;
  ariaLabel: string;
}) {
  if (!series.length) return null;

  const firstMonth = series[0]?.monthLabel ?? "";
  const lastMonth = series[series.length - 1]?.monthLabel ?? "";

  return (
    <div className="mt-3 w-full" data-private role="img" aria-label={ariaLabel}>
      <ProjectionSparkline series={series} currentMonthKey={currentMonthKey} />
      <p className="mt-2 text-xs text-ink-400 dark:text-white/35">
        {firstMonth} — {lastMonth} {year} · réel puis estimé
      </p>
    </div>
  );
}
