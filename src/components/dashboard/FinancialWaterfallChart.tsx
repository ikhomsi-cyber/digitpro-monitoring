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
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";

type Props = {
  stats: DashboardHeroStats;
  statsReady: boolean;
  formatEuro: (n: number) => string;
  trend?: KpiTrend | null;
};

const STEP_META: Record<string, { fill: string; stroke: string; labelFr: string }> = {
  revenue: { fill: "#34d399", stroke: "#10b981", labelFr: "Revenu TTC" },
  vat: { fill: "#38bdf8", stroke: "#0ea5e9", labelFr: "TVA" },
  expenses: { fill: "#fb7185", stroke: "#f43f5e", labelFr: "Frais pro" },
  csg: { fill: "#fb923c", stroke: "#f97316", labelFr: "CSG" },
  personal: { fill: "#a78bfa", stroke: "#8b5cf6", labelFr: "Retraits perso" },
  remaining: { fill: "#2dd4bf", stroke: "#14b8a6", labelFr: "Trésorerie restante" }
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
  const minH = step.kind === "total" ? 10 : 3;
  const height = Math.max(minH, yBottom - yTop);
  return { x, y: yTop, width: barW, height };
}

function formatDelta(step: FinancialWaterfallStep, formatEuro: (n: number) => string): string {
  if (step.deltaEur >= 0) return formatEuro(step.deltaEur);
  return `−${formatEuro(Math.abs(step.deltaEur))}`;
}

export function FinancialWaterfallChart({ stats, statsReady, formatEuro, trend }: Props) {
  const model = useMemo(() => buildFinancialWaterfall(stats), [stats]);

  const revenueTtc = Math.max(1, model.steps[0]?.cumulativeEur ?? 1);

  const maxValue = useMemo(
    () => Math.max(1, model.steps[0]?.cumulativeEur ?? 1),
    [model.steps]
  );

  const chartW = 520;
  const chartH = 148;
  const gap = 8;
  const barW = (chartW - gap * (model.steps.length + 1)) / model.steps.length;

  const geometries = useMemo(
    () =>
      model.steps.map((step, index) => {
        const prevCumulative = index === 0 ? 0 : (model.steps[index - 1]?.cumulativeEur ?? 0);
        return {
          step,
          meta: STEP_META[step.id] ?? STEP_META.remaining,
          geom: barGeometry(step, prevCumulative, index, maxValue, chartW, chartH, gap, barW),
          prevCumulative
        };
      }),
    [model.steps, maxValue, barW]
  );

  return (
    <div className="flex h-full min-h-[8.75rem] flex-col rounded-2xl border border-ink-200/80 bg-white/75 px-4 py-4 shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none sm:px-5 sm:py-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
              Waterfall financier
            </p>
            <KpiTrendBadge trend={trend} />
          </div>
          <p className="mt-0.5 text-xs font-medium capitalize text-ink-500 dark:text-white/50">
            {model.periodLabel}
          </p>
        </div>
        <PremiumIconBadge icon={Waves} tone="sky" size="md" />
      </div>

      {statsReady ? (
        <>
          {/* Graphique — barres uniquement, sans texte SVG */}
          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH + 4}`}
              className="w-full min-w-[300px]"
              role="img"
              aria-label="Cascade financière du mois"
            >
              <line
                x1={gap}
                x2={chartW - gap}
                y1={chartH}
                y2={chartH}
                className="stroke-ink-300/50 dark:stroke-white/20"
                strokeWidth="1"
              />
              {geometries.map(({ step, meta, geom }, index) => {
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
                        className="stroke-ink-300/40 dark:stroke-white/25"
                        strokeWidth="1.5"
                        strokeDasharray="5 4"
                      />
                    ) : null}
                    <rect
                      x={geom.x}
                      y={geom.y}
                      width={geom.width}
                      height={geom.height}
                      rx="5"
                      fill={meta.fill}
                      fillOpacity={step.kind === "total" ? 0.95 : 0.88}
                      stroke={meta.stroke}
                      strokeWidth="1.2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Détail ligne par ligne — montants lisibles */}
          <ul className="mt-4 space-y-1.5">
            {geometries
              .filter(({ step }) => step.kind !== "total")
              .map(({ step, meta }) => {
                const pct =
                  step.kind === "decrease" && revenueTtc > 0
                    ? (Math.abs(step.deltaEur) / revenueTtc) * 100
                    : null;

                return (
                  <li
                    key={`row-${step.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-ink-50/60 px-3 py-2.5 dark:bg-white/[0.04]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.fill }}
                        aria-hidden
                      />
                      <span className="truncate text-sm font-semibold text-ink-700 dark:text-white/80">
                        {meta.labelFr}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={clsx(
                          "block text-base font-bold tabular-nums",
                          step.kind === "start"
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-ink-900 dark:text-white"
                        )}
                      >
                        {formatDelta(step, formatEuro)}
                      </span>
                      {pct != null && pct >= 0.5 ? (
                        <span className="text-[11px] font-medium tabular-nums text-ink-400 dark:text-white/45">
                          {pct.toFixed(1)} % du revenu
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 to-emerald-50/50 px-4 py-3.5 dark:border-teal-300/25 dark:from-teal-500/12 dark:to-emerald-500/8">
            <span className="text-sm font-bold text-ink-700 dark:text-white/80">
              Trésorerie restante
            </span>
            <span className="font-display text-xl font-bold tabular-nums text-teal-700 dark:text-teal-300 sm:text-2xl">
              {formatEuro(model.remainingCashEur)}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm font-medium text-ink-500 dark:text-white/40">
          Calcul de la cascade financière en cours…
        </p>
      )}
    </div>
  );
}
