"use client";

import { useMemo } from "react";
import type { YearEndProjectionMonth } from "@/lib/year-end-projection";

const STROKE_ACTUAL = "#34d399";
const STROKE_FORECAST = "rgba(52, 211, 153, 0.42)";

function sparklineCoords(values: number[], w: number, h: number): Array<{ x: number; y: number }> {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) {
    const y = h - ((values[0]! - min) / span) * (h - 8) - 4;
    return [{ x: 0, y }];
  }
  return values.map((v, i) => ({
    x: (i / (n - 1)) * w,
    y: h - ((v - min) / span) * (h - 8) - 4
  }));
}

function polylinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return "";
  return coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
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

  const splitIndex = useMemo(() => {
    const idx = series.findIndex((row) => row.monthKey === currentMonthKey);
    if (idx >= 0) return idx + 1;
    const lastActual = series.findLastIndex((row) => row.kind === "actual");
    return lastActual >= 0 ? lastActual + 1 : 0;
  }, [series, currentMonthKey]);

  /** Point d’origine (0 €) + cumul fin de chaque mois → pente = CA du mois. */
  const cumulativeValues = useMemo(() => [0, ...series.map((row) => row.cumulativeHt)], [series]);
  const coords = sparklineCoords(cumulativeValues, w, h);

  const pivotIndex = splitIndex;
  const actualCoords = coords.slice(0, Math.max(pivotIndex + 1, 2));
  const forecastCoords =
    pivotIndex >= 0 && pivotIndex < coords.length - 1 ? coords.slice(pivotIndex) : [];

  const actualPath = polylinePath(actualCoords);
  const forecastPath = polylinePath(forecastCoords);
  const pivotX = coords[pivotIndex]?.x;

  const monthDotCoords = coords.slice(1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      <line x1="0" y1={h - 4} x2={w} y2={h - 4} className="stroke-ink-300/60 dark:stroke-white/15" strokeWidth="1" />
      {pivotX != null ? (
        <line
          x1={pivotX}
          y1={4}
          x2={pivotX}
          y2={h - 4}
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
      {monthDotCoords.map((p, i) => {
        const row = series[i];
        if (!row) return null;
        const isForecast = row.kind === "forecast";
        return (
          <circle
            key={row.monthKey}
            cx={p.x}
            cy={p.y}
            r={2.2}
            fill={isForecast ? STROKE_FORECAST : STROKE_ACTUAL}
            className="opacity-90"
          />
        );
      })}
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
        {firstMonth} — {lastMonth} {year} · cumul mensuel (réel puis estimé)
      </p>
    </div>
  );
}
