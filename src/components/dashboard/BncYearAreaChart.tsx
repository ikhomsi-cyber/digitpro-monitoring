"use client";

import { useId, useMemo, useState } from "react";
import { useRootIsDark } from "@/lib/use-root-is-dark";

type MonthPoint = { month: string; bncEur: number; ikEur: number; ndfEur: number };
type SeriesKey = "bncEur" | "ikEur" | "ndfEur";

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

const SERIES: Array<{
  key: SeriesKey;
  label: string;
  light: string;
  dark: string;
}> = [
  { key: "bncEur", label: "BNC", light: "#10b981", dark: "#34d399" },
  { key: "ikEur", label: "IK", light: "#0ea5e9", dark: "#38bdf8" },
  { key: "ndfEur", label: "NDF", light: "#f59e0b", dark: "#fbbf24" }
];

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
  const isDark = useRootIsDark();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const palette = isDark
    ? {
        axis: "rgba(255,255,255,0.38)",
        tooltipBg: "rgba(6,36,43,0.96)",
        tooltipMonth: "rgba(255,255,255,0.48)",
        markerFill: "#0b3038",
        fillTopOpacity: 0.32,
        fillBottomOpacity: 0.02
      }
    : {
        axis: "#8D899D",
        tooltipBg: "#F4F1FF",
        tooltipMonth: "#8D899D",
        markerFill: "#ffffff",
        fillTopOpacity: 0.305698,
        fillBottomOpacity: 0.01
      };

  const defaultIndex = useMemo(() => {
    for (let i = monthly.length - 1; i >= 0; i--) {
      if (SERIES.some((series) => monthly[i]![series.key] > 0)) return i;
    }
    return Math.max(0, monthly.length - 1);
  }, [monthly]);

  const chart = useMemo(() => {
    const maxY = niceYMax(Math.max(1, ...monthly.flatMap((row) => SERIES.map((series) => row[series.key]))));
    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxY / tickCount) * i);
    const plotHeight = CHART.bottom - CHART.top;
    const plotWidth = CHART.right - CHART.left;

    const xForIndex = (index: number) =>
      monthly.length <= 1
        ? (CHART.left + CHART.right) / 2
        : CHART.left + (index / Math.max(1, monthly.length - 1)) * plotWidth;

    const pointsBySeries = SERIES.map((series) => {
      const points = monthly.map((row, index) => {
        const x = xForIndex(index);
        const y = CHART.bottom - (row[series.key] / maxY) * plotHeight;
        return { x, y, row, index, value: row[series.key] };
      });
      return {
        ...series,
        points,
        areaPath: buildAreaPath(points, CHART.bottom),
        linePath: buildSmoothLinePath(points),
        color: isDark ? series.dark : series.light
      };
    });

    return { maxY, ticks, pointsBySeries, xForIndex };
  }, [isDark, monthly]);

  const activePoint =
    activeIndex != null ? monthly[activeIndex] : monthly[defaultIndex] ?? monthly[monthly.length - 1];
  const activeX = activeIndex != null ? chart.xForIndex(activeIndex) : chart.xForIndex(defaultIndex);

  const tooltip = activePoint
    ? {
        rows: SERIES.map((series) => ({
          ...series,
          amount: formatEuro(activePoint[series.key]),
          value: activePoint[series.key],
          color: isDark ? series.dark : series.light
        })),
        month: monthAxisLabel(activePoint.month),
        width: 132,
        height: 70,
        x: Math.min(
          Math.max(activeX - 66, CHART.left),
          CHART.right - 132
        ),
        y: 10
      }
    : null;

  return (
    <svg
      viewBox="0 0 387 212"
      className="h-auto w-full"
      role="img"
      aria-label={monthly
        .map((row) =>
          `${monthAxisLabel(row.month)} BNC ${formatEuro(row.bncEur)}, IK ${formatEuro(row.ikEur)}, NDF ${formatEuro(row.ndfEur)}`
        )
        .join(", ")}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <defs>
        {chart.pointsBySeries.map((series) => (
          <linearGradient
            key={`grad-${series.key}`}
            id={`${series.key}-area-fill-${uid}`}
            x1={CHART.left}
            y1={CHART.top - 29}
            x2={CHART.left}
            y2={CHART.bottom}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={series.color} stopOpacity={palette.fillTopOpacity} />
            <stop offset={1} stopColor={series.color} stopOpacity={palette.fillBottomOpacity} />
          </linearGradient>
        ))}
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

      {chart.pointsBySeries.map((series) =>
        series.areaPath ? (
          <path key={`area-${series.key}`} d={series.areaPath} fill={`url(#${series.key}-area-fill-${uid})`} />
        ) : null
      )}
      {chart.pointsBySeries.map((series) =>
        series.linePath ? (
          <path
            key={`line-${series.key}`}
            d={series.linePath}
            fill="none"
            stroke={series.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null
      )}

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
          <text x={tooltip.x + 10} y={tooltip.y + 14} fill={palette.tooltipMonth} style={{ fontSize: 10, fontWeight: 600 }}>
            {tooltip.month}
          </text>
          {tooltip.rows.map((row, index) => (
            <g key={`tooltip-${row.key}`}>
              <circle cx={tooltip.x + 12} cy={tooltip.y + 30 + index * 14} r={3} fill={row.color} />
              <text x={tooltip.x + 20} y={tooltip.y + 33 + index * 14} fill={row.color} style={{ fontSize: 10, fontWeight: 700 }}>
                {row.label}
              </text>
              <text
                x={tooltip.x + tooltip.width - 10}
                y={tooltip.y + 33 + index * 14}
                textAnchor="end"
                fill={isDark ? "rgba(255,255,255,0.88)" : "#342863"}
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {row.amount}
              </text>
            </g>
          ))}
          {chart.pointsBySeries.map((series) => {
            const point = series.points[activeIndex ?? defaultIndex];
            if (!point || point.value <= 0) return null;
            return (
              <circle
                key={`marker-${series.key}`}
                cx={point.x}
                cy={point.y}
                r={5}
                fill={palette.markerFill}
                stroke={series.color}
                strokeWidth={2}
              />
            );
          })}
        </g>
      ) : null}

      {monthly.map((row, index) => {
        const x = chart.xForIndex(index);
        return (
          <rect
            key={row.month}
            x={x - 18}
            y={CHART.top}
            width={36}
            height={CHART.bottom - CHART.top + 24}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            tabIndex={0}
            aria-label={`${monthAxisLabel(row.month)} BNC ${formatEuro(row.bncEur)}, IK ${formatEuro(row.ikEur)}, NDF ${formatEuro(row.ndfEur)}`}
          />
        );
      })}

      {monthly.map((row, index) => {
        const x = chart.xForIndex(index);
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
