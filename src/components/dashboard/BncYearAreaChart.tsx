"use client";

import { useId, useMemo, useState } from "react";

type MonthPoint = { month: string; bncEur: number; ikEur: number; ndfEur: number };

type Props = {
  monthly: MonthPoint[];
  formatEuro: (value: number) => string;
};

const W = 387;
const H = 268;

const MARGIN = { left: 40, right: 6, top: 8 } as const;

/** Panneau BNC (zone principale). */
const BNC_PANEL = { top: 28, bottom: 138 } as const;
/** Panneau IK / NDF (barres groupées, échelle indépendante). */
const PERKS_PANEL = { top: 158, bottom: 228 } as const;
const MONTH_LABEL_Y = 248;

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

const SERIES = {
  bnc: { label: "BNC", color: "var(--bnc-chart-bnc)" },
  ik: { label: "IK", color: "var(--bnc-chart-ik)" },
  ndf: { label: "NDF", color: "var(--bnc-chart-ndf)" }
} as const;

function monthAxisLabel(monthKey: string): string {
  const month0 = Number(monthKey.slice(5, 7)) - 1;
  return MONTH_LABELS[month0] ?? monthKey.slice(5, 7);
}

function niceYMax(maxValue: number, stepHint: number): number {
  if (maxValue <= 0) return stepHint;
  const step = maxValue <= stepHint * 3 ? stepHint : stepHint * 2;
  return Math.ceil(maxValue / step) * step;
}

function formatYTick(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return Number.isInteger(k) ? `${k}k€` : `${k.toFixed(1).replace(".", ",")}k€`;
  }
  return `${Math.round(value)}€`;
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const palette = {
    axis: "var(--bnc-chart-axis)",
    grid: "var(--bnc-chart-grid)",
    divider: "var(--bnc-chart-divider)",
    tooltipBg: "var(--bnc-chart-tooltip-bg)",
    tooltipStroke: "var(--bnc-chart-tooltip-stroke)",
    tooltipMonth: "var(--bnc-chart-tooltip-muted)",
    tooltipValue: "var(--bnc-chart-tooltip-value)",
    markerFill: "var(--bnc-chart-marker-fill)"
  };

  const chart = useMemo(() => {
    const plotRight = W - MARGIN.right;
    const plotWidth = plotRight - MARGIN.left;

    const xForIndex = (index: number) =>
      monthly.length <= 1
        ? (MARGIN.left + plotRight) / 2
        : MARGIN.left + (index / Math.max(1, monthly.length - 1)) * plotWidth;

    const bncMax = niceYMax(Math.max(1, ...monthly.map((row) => row.bncEur)), 5000);
    const bncHeight = BNC_PANEL.bottom - BNC_PANEL.top;
    const bncY = (value: number) => BNC_PANEL.bottom - (value / bncMax) * bncHeight;
    const bncTicks = Array.from({ length: 4 }, (_, i) => (bncMax / 3) * i);

    const bncPoints = monthly.map((row, index) => ({
      x: xForIndex(index),
      y: bncY(row.bncEur),
      value: row.bncEur,
      index
    }));

    const perksMax = niceYMax(
      Math.max(1, ...monthly.flatMap((row) => [row.ikEur, row.ndfEur])),
      500
    );
    const perksHeight = PERKS_PANEL.bottom - PERKS_PANEL.top;
    const perksY = (value: number) => PERKS_PANEL.bottom - (value / perksMax) * perksHeight;
    const perksTicks = Array.from({ length: 3 }, (_, i) => (perksMax / 2) * i);

    const slotWidth = monthly.length > 0 ? plotWidth / monthly.length : plotWidth;
    const barWidth = Math.min(14, Math.max(6, slotWidth * 0.28));
    const barGap = 3;

    const perkBars = monthly.map((row, index) => {
      const cx = xForIndex(index);
      const ikH = perksHeight * (row.ikEur / perksMax);
      const ndfH = perksHeight * (row.ndfEur / perksMax);
      return {
        index,
        cx,
        ik: {
          x: cx - barWidth - barGap / 2,
          y: PERKS_PANEL.bottom - ikH,
          width: barWidth,
          height: ikH,
          value: row.ikEur
        },
        ndf: {
          x: cx + barGap / 2,
          y: PERKS_PANEL.bottom - ndfH,
          width: barWidth,
          height: ndfH,
          value: row.ndfEur
        }
      };
    });

    return {
      plotRight,
      plotWidth,
      xForIndex,
      bncMax,
      bncTicks,
      bncY,
      bncPoints,
      bncAreaPath: buildAreaPath(bncPoints, BNC_PANEL.bottom),
      bncLinePath: buildSmoothLinePath(bncPoints),
      perksMax,
      perksTicks,
      perksY,
      perkBars
    };
  }, [monthly]);

  const hoverPoint = activeIndex != null ? monthly[activeIndex] : null;
  const hoverX = activeIndex != null ? chart.xForIndex(activeIndex) : 0;

  const tooltip =
    hoverPoint && activeIndex != null
      ? {
          month: monthAxisLabel(hoverPoint.month),
          rows: [
            { label: SERIES.bnc.label, color: SERIES.bnc.color, amount: formatEuro(hoverPoint.bncEur) },
            { label: SERIES.ik.label, color: SERIES.ik.color, amount: formatEuro(hoverPoint.ikEur) },
            { label: SERIES.ndf.label, color: SERIES.ndf.color, amount: formatEuro(hoverPoint.ndfEur) }
          ],
          width: 138,
          height: 78,
          x: Math.min(Math.max(hoverX - 69, MARGIN.left), chart.plotRight - 138),
          y: 2
        }
      : null;

  const cssVars =
    "[--bnc-chart-axis:#8D899D] [--bnc-chart-grid:rgba(52,40,99,0.07)] [--bnc-chart-divider:rgba(52,40,99,0.1)] [--bnc-chart-bnc:#10b981] [--bnc-chart-ik:#0ea5e9] [--bnc-chart-ndf:#f59e0b] [--bnc-chart-marker-fill:#ffffff] [--bnc-chart-tooltip-bg:#F4F1FF] [--bnc-chart-tooltip-muted:#8D899D] [--bnc-chart-tooltip-stroke:rgba(52,40,99,0.08)] [--bnc-chart-tooltip-value:#342863] dark:[--bnc-chart-axis:rgba(255,255,255,0.38)] dark:[--bnc-chart-grid:rgba(255,255,255,0.06)] dark:[--bnc-chart-divider:rgba(255,255,255,0.1)] dark:[--bnc-chart-bnc:#34d399] dark:[--bnc-chart-ik:#38bdf8] dark:[--bnc-chart-marker-fill:#0b3038] dark:[--bnc-chart-ndf:#fbbf24] dark:[--bnc-chart-tooltip-bg:rgba(6,36,43,0.96)] dark:[--bnc-chart-tooltip-muted:rgba(255,255,255,0.48)] dark:[--bnc-chart-tooltip-stroke:rgba(56,189,248,0.22)] dark:[--bnc-chart-tooltip-value:rgba(255,255,255,0.88)]";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${cssVars}`}
      role="img"
      aria-label={monthly
        .map(
          (row) =>
            `${monthAxisLabel(row.month)} BNC ${formatEuro(row.bncEur)}, IK ${formatEuro(row.ikEur)}, NDF ${formatEuro(row.ndfEur)}`
        )
        .join(", ")}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <defs>
        <linearGradient
          id={`bnc-area-fill-${uid}`}
          x1={MARGIN.left}
          y1={BNC_PANEL.top}
          x2={MARGIN.left}
          y2={BNC_PANEL.bottom}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={SERIES.bnc.color} stopOpacity={0.32} />
          <stop offset={1} stopColor={SERIES.bnc.color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grille BNC */}
      {chart.bncTicks.map((tick) => {
        const y = chart.bncY(tick);
        return (
          <g key={`bnc-tick-${tick}`}>
            <line
              x1={MARGIN.left}
              y1={y}
              x2={chart.plotRight}
              y2={y}
              stroke={palette.grid}
              strokeWidth={1}
            />
            <text x={0} y={y + 4} fill={palette.axis} style={{ fontSize: 10 }}>
              {formatYTick(tick)}
            </text>
          </g>
        );
      })}

      <text x={MARGIN.left} y={BNC_PANEL.top - 6} fill={palette.axis} style={{ fontSize: 9, fontWeight: 700 }}>
        BNC
      </text>

      {/* Zone BNC */}
      {chart.bncAreaPath ? (
        <path d={chart.bncAreaPath} fill={`url(#bnc-area-fill-${uid})`} />
      ) : null}
      {chart.bncLinePath ? (
        <path
          d={chart.bncLinePath}
          fill="none"
          stroke={SERIES.bnc.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* Séparateur */}
      <line
        x1={MARGIN.left}
        y1={PERKS_PANEL.top - 10}
        x2={chart.plotRight}
        y2={PERKS_PANEL.top - 10}
        stroke={palette.divider}
        strokeWidth={1}
      />

      {/* Grille IK / NDF */}
      {chart.perksTicks.map((tick) => {
        const y = chart.perksY(tick);
        return (
          <g key={`perks-tick-${tick}`}>
            <line
              x1={MARGIN.left}
              y1={y}
              x2={chart.plotRight}
              y2={y}
              stroke={palette.grid}
              strokeWidth={1}
              strokeDasharray={tick === 0 ? undefined : "3 4"}
            />
            <text x={0} y={y + 4} fill={palette.axis} style={{ fontSize: 9, opacity: 0.85 }}>
              {formatYTick(tick)}
            </text>
          </g>
        );
      })}

      <text x={MARGIN.left} y={PERKS_PANEL.top - 2} fill={palette.axis} style={{ fontSize: 9, fontWeight: 700 }}>
        IK · NDF
      </text>

      {/* Barres groupées IK / NDF */}
      {chart.perkBars.map((bar) => (
        <g key={`bars-${bar.index}`}>
          {bar.ik.value > 0 ? (
            <rect
              x={bar.ik.x}
              y={bar.ik.y}
              width={bar.ik.width}
              height={Math.max(bar.ik.height, 2)}
              rx={3}
              fill={SERIES.ik.color}
              opacity={0.85}
            />
          ) : null}
          {bar.ndf.value > 0 ? (
            <rect
              x={bar.ndf.x}
              y={bar.ndf.y}
              width={bar.ndf.width}
              height={Math.max(bar.ndf.height, 2)}
              rx={3}
              fill={SERIES.ndf.color}
              opacity={0.85}
            />
          ) : null}
        </g>
      ))}

      {/* Marqueur BNC */}
      {hoverPoint && activeIndex != null && hoverPoint.bncEur > 0 ? (
        <circle
          cx={hoverX}
          cy={chart.bncY(hoverPoint.bncEur)}
          r={5}
          fill={palette.markerFill}
          stroke={SERIES.bnc.color}
          strokeWidth={2}
        />
      ) : null}

      {/* Tooltip */}
      {tooltip && hoverPoint ? (
        <g>
          <rect
            x={tooltip.x}
            y={tooltip.y}
            width={tooltip.width}
            height={tooltip.height}
            rx={10}
            fill={palette.tooltipBg}
            stroke={palette.tooltipStroke}
            strokeWidth={1}
          />
          <text
            x={tooltip.x + 12}
            y={tooltip.y + 16}
            fill={palette.tooltipMonth}
            style={{ fontSize: 10, fontWeight: 600 }}
          >
            {tooltip.month}
          </text>
          {tooltip.rows.map((row, index) => (
            <g key={row.label}>
              <circle cx={tooltip.x + 14} cy={tooltip.y + 32 + index * 15} r={3.5} fill={row.color} />
              <text
                x={tooltip.x + 22}
                y={tooltip.y + 35 + index * 15}
                fill={row.color}
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {row.label}
              </text>
              <text
                x={tooltip.x + tooltip.width - 12}
                y={tooltip.y + 35 + index * 15}
                textAnchor="end"
                fill={palette.tooltipValue}
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {row.amount}
              </text>
            </g>
          ))}
        </g>
      ) : null}

      {/* Zones interactives */}
      {monthly.map((row, index) => {
        const x = chart.xForIndex(index);
        return (
          <rect
            key={row.month}
            x={x - 20}
            y={BNC_PANEL.top}
            width={40}
            height={PERKS_PANEL.bottom - BNC_PANEL.top + 28}
            fill="transparent"
            className="cursor-pointer outline-none"
            onMouseEnter={() => setActiveIndex(index)}
            aria-hidden
            tabIndex={-1}
          />
        );
      })}

      {monthly.map((row, index) => {
        const x = chart.xForIndex(index);
        return (
          <text
            key={`${row.month}-axis`}
            x={x}
            y={MONTH_LABEL_Y}
            textAnchor="middle"
            fill={palette.axis}
            style={{ fontSize: 10, fontWeight: 500 }}
          >
            {monthAxisLabel(row.month)}
          </text>
        );
      })}
    </svg>
  );
}
