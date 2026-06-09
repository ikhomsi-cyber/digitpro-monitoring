"use client";

import { useMemo } from "react";
import { Waves } from "lucide-react";
import { clsx } from "clsx";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import {
  buildFinancialWaterfall,
  type FinancialWaterfallStep
} from "@/lib/financial-waterfall";
import type { KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";

type Props = {
  stats: DashboardHeroStats;
  statsReady: boolean;
  formatEuro: (n: number) => string;
  trend?: KpiTrend | null;
};

const STEP_COLORS: Record<string, { fill: string; stroke: string }> = {
  revenue: { fill: "#34d399", stroke: "#10b981" },
  vat: { fill: "#38bdf8", stroke: "#0ea5e9" },
  expenses: { fill: "#fb7185", stroke: "#f43f5e" },
  csg: { fill: "#fb923c", stroke: "#f97316" },
  personal: { fill: "#a78bfa", stroke: "#8b5cf6" },
  remaining: { fill: "#2dd4bf", stroke: "#14b8a6" }
};

function barGeometry(
  step: FinancialWaterfallStep,
  prevCumulative: number,
  index: number,
  maxValue: number,
  chartW: number,
  chartH: number,
  gap: number,
  barW: number
) {
  const scale = (v: number) => (v / maxValue) * chartH;
  const x = index * (barW + gap) + gap;
  const topValue =
    step.kind === "start" || step.kind === "total" ? step.cumulativeEur : prevCumulative;
  const bottomValue = step.kind === "start" || step.kind === "total" ? 0 : step.cumulativeEur;
  const yTop = chartH - scale(topValue);
  const yBottom = chartH - scale(bottomValue);
  const height = Math.max(2, yBottom - yTop);
  return { x, y: yTop, width: barW, height, connectorY: chartH - scale(prevCumulative) };
}

export function FinancialWaterfallChart({ stats, statsReady, formatEuro, trend }: Props) {
  const model = useMemo(() => buildFinancialWaterfall(stats), [stats]);

  const maxValue = useMemo(
    () => Math.max(1, model.steps[0]?.cumulativeEur ?? 1),
    [model.steps]
  );

  const chartW = 520;
  const chartH = 168;
  const gap = 10;
  const barW = (chartW - gap * (model.steps.length + 1)) / model.steps.length;

  const geometries = useMemo(
    () =>
      model.steps.map((step, index) => {
        const prevCumulative =
          index === 0 ? 0 : (model.steps[index - 1]?.cumulativeEur ?? 0);
        return {
          step,
          geom: barGeometry(step, prevCumulative, index, maxValue, chartW, chartH, gap, barW),
          prevCumulative
        };
      }),
    [model.steps, maxValue, barW]
  );

  return (
    <div className="flex h-full min-h-[8.75rem] flex-col rounded-2xl border border-ink-200/80 bg-white/75 px-4 py-4 shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
              Waterfall financier
            </p>
            <KpiTrendBadge trend={trend} />
          </div>
          <p className="mt-0.5 text-[10px] font-medium capitalize text-ink-400 dark:text-white/35">
            {model.periodLabel}
          </p>
        </div>
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50 text-sky-600 dark:border-sky-300/20 dark:bg-sky-500/12 dark:text-sky-300"
          aria-hidden
        >
          <Waves className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>

      {statsReady ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH + 36}`}
              className="w-full min-w-[320px]"
              role="img"
              aria-label="Waterfall financier du mois"
            >
              <line
                x1={gap}
                x2={chartW - gap}
                y1={chartH}
                y2={chartH}
                className="stroke-ink-300/50 dark:stroke-white/20"
                strokeWidth="1"
              />
              {geometries.map(({ step, geom }, index) => {
                const colors = STEP_COLORS[step.id] ?? STEP_COLORS.remaining;
                const prevGeom = index > 0 ? geometries[index - 1] : null;
                const connectorY =
                  index > 0 && step.kind === "decrease"
                    ? chartH - (geometries[index - 1].prevCumulative / maxValue) * chartH
                    : null;

                return (
                  <g key={step.id}>
                    {connectorY != null ? (
                      <line
                        x1={(prevGeom?.geom.x ?? 0) + (prevGeom?.geom.width ?? 0)}
                        x2={geom.x + geom.width / 2}
                        y1={connectorY}
                        y2={connectorY}
                        className="stroke-ink-300/40 dark:stroke-white/20"
                        strokeWidth="1"
                        strokeDasharray="4 3"
                      />
                    ) : null}
                    <rect
                      x={geom.x}
                      y={geom.y}
                      width={geom.width}
                      height={geom.height}
                      rx="6"
                      fill={colors.fill}
                      fillOpacity={step.kind === "total" ? 0.92 : 0.82}
                      stroke={colors.stroke}
                      strokeWidth="1.2"
                    />
                    <text
                      x={geom.x + geom.width / 2}
                      y={chartH + 14}
                      textAnchor="middle"
                      className="fill-ink-500 text-[8px] font-bold dark:fill-white/45"
                    >
                      {step.label}
                    </text>
                    <text
                      x={geom.x + geom.width / 2}
                      y={chartH + 26}
                      textAnchor="middle"
                      className="fill-ink-800 text-[8.5px] font-bold tabular-nums dark:fill-white/80"
                    >
                      {step.deltaEur >= 0
                        ? formatEuro(step.deltaEur)
                        : `−${formatEuro(Math.abs(step.deltaEur))}`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200/70 bg-white/55 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
              = Remaining cash
            </span>
            <span className="font-display text-base font-bold tabular-nums text-teal-700 dark:text-teal-300">
              {formatEuro(model.remainingCashEur)}
            </span>
          </div>

          <ol className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-ink-500 dark:text-white/45">
            {model.steps.map((step, index) => (
              <li key={`flow-${step.id}`} className="inline-flex items-center gap-1">
                {index > 0 ? <span className="opacity-40">→</span> : null}
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5",
                    step.kind === "total"
                      ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200"
                      : "bg-ink-50 text-ink-600 dark:bg-white/[0.06] dark:text-white/65"
                  )}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-3 text-[11px] font-medium text-ink-500 dark:text-white/40">
          Calcul de la cascade financière en cours…
        </p>
      )}
    </div>
  );
}
