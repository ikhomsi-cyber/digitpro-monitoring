"use client";

import { useId, useMemo, useState } from "react";
import { useRootIsDark } from "@/lib/use-root-is-dark";

type MonthPoint = { month: string; bncEur: number };

type Props = {
  monthly: MonthPoint[];
  formatEuro: (value: number) => string;
};

const CHART = {
  left: 40,
  right: 386,
  top: 41,
  bottom: 177,
  labelLeft: 0,
  labelBottom: 198
} as const;

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mars",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sept",
  "Oct",
  "Nov",
  "Déc"
] as const;

function monthAxisLabel(monthKey: string): string {
  const month0 = Number(monthKey.slice(5, 7)) - 1;
  return MONTH_LABELS[month0] ?? monthKey.slice(5, 7);
}

function niceYMax(maxValue: number): number {
  if (maxValue <= 0) return 5000;
  const step = maxValue <= 15000 ? 5000 : 10000;
  return Math.ceil(maxValue / step) * step;
}

function formatYTick(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return Number.isInteger(k) ? `${k}k€` : `${k.toFixed(1).replace(".", ",")}k€`;
  }
  return `${value}€`;
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: number): string {
  if (!points.length) return "";
  const line = buildSmoothLinePath(points);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

export function BncYearAreaChart({ monthly, formatEuro }: Props) {
  const uid = useId().replace(/:/g, "");
  const fillGradId = `bnc-area-fill-${uid}`;
  const isDark = useRootIsDark();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const palette = isDark
    ? {
        line: "#38bdf8",
        axis: "rgba(255,255,255,0.38)",
        tooltipBg: "rgba(6,36,43,0.96)",
        tooltipAmount: "#7ee0ff",
        tooltipMonth: "rgba(255,255,255,0.48)",
        markerFill: "#0b3038",
        markerStroke: "#38bdf8",
        fillTopOpacity: 0.32,
        fillBottomOpacity: 0.02
      }
    : {
        line: "#342863",
        axis: "#8D899D",
        tooltipBg: "#F4F1FF",
        tooltipAmount: "#342863",
        tooltipMonth: "#8D899D",
        markerFill: "#ffffff",
        markerStroke: "#342863",
        fillTopOpacity: 0.305698,
        fillBottomOpacity: 0.01
      };

  const defaultIndex = useMemo(() => {
    for (let i = monthly.length - 1; i >= 0; i--) {
      if (monthly[i]!.bncEur > 0) return i;
    }
    return Math.max(0, monthly.length - 1);
  }, [monthly]);

  const chart = useMemo(() => {
    const maxY = niceYMax(Math.max(1, ...monthly.map((row) => row.bncEur)));
    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxY / tickCount) * i);
    const plotHeight = CHART.bottom - CHART.top;
    const plotWidth = CHART.right - CHART.left;

    const points = monthly.map((row, index) => {
      const x =
        monthly.length <= 1
          ? (CHART.left + CHART.right) / 2
          : CHART.left + (index / Math.max(1, monthly.length - 1)) * plotWidth;
      const y = CHART.bottom - (row.bncEur / maxY) * plotHeight;
      return { x, y, row, index };
    });

    return { maxY, ticks, points, areaPath: buildAreaPath(points, CHART.bottom), linePath: buildSmoothLinePath(points) };
  }, [monthly]);

  const activePoint =
    activeIndex != null ? chart.points[activeIndex] : chart.points[defaultIndex] ?? chart.points[chart.points.length - 1];

  const tooltip = activePoint
    ? {
        amount: formatEuro(activePoint.row.bncEur),
        month: monthAxisLabel(activePoint.row.month),
        width: 112,
        height: 34,
        x: Math.min(
          Math.max(activePoint.x - 56, CHART.left),
          CHART.right - 112
        ),
        y: Math.max(8, activePoint.y - 48)
      }
    : null;

  return (
    <svg
      viewBox="0 0 387 212"
      className="h-auto w-full"
      role="img"
      aria-label={monthly.map((row) => `${monthAxisLabel(row.month)} ${formatEuro(row.bncEur)}`).join(", ")}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <defs>
        <linearGradient id={fillGradId} x1={CHART.left} y1={CHART.top - 29} x2={CHART.left} y2={CHART.bottom} gradientUnits="userSpaceOnUse">
          <stop stopColor={palette.line} stopOpacity={palette.fillTopOpacity} />
          <stop offset={1} stopColor={palette.line} stopOpacity={palette.fillBottomOpacity} />
        </linearGradient>
      </defs>

      {chart.ticks.map((tick) => {
        const y = CHART.bottom - (tick / chart.maxY) * (CHART.bottom - CHART.top);
        return (
          <text
            key={tick}
            x={CHART.labelLeft}
            y={y + 4}
            fill={palette.axis}
            style={{ fontSize: 10 }}
          >
            {formatYTick(tick)}
          </text>
        );
      })}

      {chart.areaPath ? <path d={chart.areaPath} fill={`url(#${fillGradId})`} /> : null}
      {chart.linePath ? (
        <path d={chart.linePath} fill="none" stroke={palette.line} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}

      {tooltip && activePoint ? (
        <g>
          <rect
            x={tooltip.x}
            y={tooltip.y}
            width={tooltip.width}
            height={tooltip.height}
            rx={8}
            fill={palette.tooltipBg}
            stroke={isDark ? "rgba(56,189,248,0.22)" : "rgba(52,40,99,0.08)"}
            strokeWidth={1}
          />
          <text x={tooltip.x + 10} y={tooltip.y + 14} fill={palette.tooltipAmount} style={{ fontSize: 11, fontWeight: 600 }}>
            {tooltip.amount}
          </text>
          <text x={tooltip.x + 10} y={tooltip.y + 27} fill={palette.tooltipMonth} style={{ fontSize: 10 }}>
            {tooltip.month}
          </text>
          <circle cx={activePoint.x} cy={activePoint.y} r={6} fill={palette.markerFill} stroke={palette.markerStroke} strokeWidth={2} />
        </g>
      ) : null}

      {chart.points.map((point) => (
        <rect
          key={point.row.month}
          x={point.x - 18}
          y={CHART.top}
          width={36}
          height={CHART.bottom - CHART.top + 24}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => setActiveIndex(point.index)}
          onFocus={() => setActiveIndex(point.index)}
          tabIndex={0}
          aria-label={`${monthAxisLabel(point.row.month)} ${formatEuro(point.row.bncEur)}`}
        />
      ))}

      {monthly.map((row, index) => {
        const x =
          monthly.length <= 1
            ? (CHART.left + CHART.right) / 2
            : CHART.left + (index / Math.max(1, monthly.length - 1)) * (CHART.right - CHART.left);
        return (
          <text
            key={`${row.month}-axis`}
            x={x}
            y={CHART.labelBottom + 10}
            textAnchor="middle"
            fill={palette.axis}
            style={{ fontSize: 10 }}
          >
            {monthAxisLabel(row.month)}
          </text>
        );
      })}
    </svg>
  );
}
