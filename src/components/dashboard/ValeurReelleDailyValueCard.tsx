"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import type { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { ValeurReelleRetainedValueExplainer } from "@/components/dashboard/ValeurReelleRetainedValueExplainer";
import type { GainPerWorkDayEstimate } from "@/lib/valeur-reelle-gain-per-day";
import {
  computeValeurReelleDailyBreakdown,
  type ValeurReelleDailyBreakdown
} from "@/lib/valeur-reelle-daily-value";
import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";
import {
  WATERFALL_AXIS_STYLES,
  WATERFALL_AXIS_SVG_CLASS
} from "@/components/dashboard/waterfall-axis-styles";

type Fmt = ReturnType<typeof useDashboardDisplayFormat>;

type MiniStep = {
  id: string;
  label: string;
  shortLabel: string;
  delta: number;
  cumulative: number;
  kind: "start" | "decrease" | "total";
  fill: string;
  stroke: string;
};

const STEP_COLORS: Record<string, { fill: string; stroke: string }> = {
  revenue: { fill: "#34d399", stroke: "#10b981" },
  csg: { fill: "#fb923c", stroke: "#f97316" },
  business: { fill: "#fb7185", stroke: "#f43f5e" },
  personal: { fill: "#2dd4bf", stroke: "#14b8a6" },
  retained: { fill: "#38bdf8", stroke: "#0ea5e9" }
};

function buildMiniSteps(b: ValeurReelleDailyBreakdown): MiniStep[] {
  const afterCsg = b.caHtPerDay - b.csgPerDay;
  const afterBusiness = afterCsg - b.mandatoryFeesPerDay;
  const afterPersonal = afterBusiness - b.personalChargesPerDay;

  return [
    {
      id: "revenue",
      label: "Revenu généré",
      shortLabel: "Revenu",
      delta: b.caHtPerDay,
      cumulative: b.caHtPerDay,
      kind: "start",
      ...STEP_COLORS.revenue
    },
    {
      id: "csg",
      label: "CSG",
      shortLabel: "CSG",
      delta: -b.csgPerDay,
      cumulative: afterCsg,
      kind: "decrease",
      ...STEP_COLORS.csg
    },
    {
      id: "business",
      label: "Frais société",
      shortLabel: "Frais pro",
      delta: -b.mandatoryFeesPerDay,
      cumulative: afterBusiness,
      kind: "decrease",
      ...STEP_COLORS.business
    },
    {
      id: "personal",
      label: "Frais perso",
      shortLabel: "Frais perso",
      delta: -b.personalChargesPerDay,
      cumulative: afterPersonal,
      kind: "decrease",
      ...STEP_COLORS.personal
    },
    {
      id: "retained",
      label: "Valeur retenue",
      shortLabel: "Retenu",
      delta: b.netPerDay,
      cumulative: b.netPerDay,
      kind: "total",
      ...STEP_COLORS.retained
    }
  ];
}

function formatDelta(delta: number, fmt: Fmt): string {
  if (delta >= 0) return fmt.euro(delta);
  return `−${fmt.euro(Math.abs(delta))}`;
}

function formatWorkedDaysLabel(
  breakdown: ValeurReelleDailyBreakdown,
  isCurrentMonthEstimate: boolean
): string {
  const days = breakdown.workedDays;
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: isCurrentMonthEstimate ? 0 : 1
  }).format(days);

  if (days <= 0) {
    return breakdown.estimateNote ?? "Estimation TJM";
  }

  if (isCurrentMonthEstimate) {
    return `${formatted} jour${days > 1 ? "s" : ""} travaillé${days > 1 ? "s" : ""}${breakdown.estimateNote ? ` · ${breakdown.estimateNote}` : ""}`;
  }

  return `${formatted} jour${days > 1 ? "s" : ""} facturé${days > 1 ? "s" : ""}`;
}

/** Typo axe X — alignée sur ValeurReelleWaterfallChart */
const MINI_WATERFALL_AXIS = {
  labelAreaH: 54,
  connectorY: 14,
  labelY: 30,
  valueY: 46,
  label: { fontSize: 12, fontWeight: 600 },
  value: { fontSize: 13, fontWeight: 700 },
  connector: { fontSize: 11, fontWeight: 700 }
} as const;

function MiniWaterfallSvg({ steps, fmt }: { steps: MiniStep[]; fmt: Fmt }) {
  const maxVal = Math.max(steps[0]?.cumulative ?? 1, steps[steps.length - 1]?.cumulative ?? 1, 1);
  const chartW = 480;
  const chartH = 68;
  const gap = 8;
  const barW = (chartW - gap * (steps.length + 1)) / steps.length;
  const axis = MINI_WATERFALL_AXIS;

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH + axis.labelAreaH}`}
      className={clsx("w-full min-w-[300px]", WATERFALL_AXIS_SVG_CLASS)}
      role="img"
      aria-label="Mini waterfall journalier"
    >
      <rect
        x={0}
        y={chartH + 1}
        width={chartW}
        height={axis.labelAreaH - 1}
        rx="6"
        className={WATERFALL_AXIS_STYLES.band}
        aria-hidden
      />
      <line
        x1={gap}
        x2={chartW - gap}
        y1={chartH}
        y2={chartH}
        className={WATERFALL_AXIS_STYLES.baseline}
        strokeWidth="1"
      />
      {steps.map((step, index) => {
        const scale = (v: number) => (v / maxVal) * chartH;
        const x = index * (barW + gap) + gap;
        const prevCumulative = index === 0 ? 0 : (steps[index - 1]?.cumulative ?? 0);

        let yTop: number;
        let height: number;

        if (step.kind === "start") {
          yTop = chartH - scale(step.cumulative);
          height = scale(step.cumulative);
        } else if (step.kind === "decrease") {
          const topVal = prevCumulative;
          const bottomVal = step.cumulative;
          yTop = chartH - scale(topVal);
          height = Math.max(2, scale(topVal) - scale(bottomVal));
        } else {
          yTop = chartH - scale(step.cumulative);
          height = Math.max(2, scale(step.cumulative));
        }

        const connectorY = chartH - scale(prevCumulative);

        return (
          <g key={step.id}>
            {index > 0 && step.kind === "decrease" ? (
              <line
                x1={x - gap}
                x2={x + barW / 2}
                y1={connectorY}
                y2={connectorY}
                className={WATERFALL_AXIS_STYLES.connectorLine}
                strokeWidth="1"
                strokeDasharray="3 2"
              />
            ) : null}
            {index > 0 && step.kind === "total" ? (
              <text
                x={x - gap / 2}
                y={chartH + axis.connectorY}
                textAnchor="middle"
                fontSize={axis.connector.fontSize}
                fontWeight={axis.connector.fontWeight}
                className={WATERFALL_AXIS_STYLES.connector}
              >
                =
              </text>
            ) : index > 0 ? (
              <text
                x={x - gap / 2}
                y={chartH + axis.connectorY}
                textAnchor="middle"
                fontSize={axis.connector.fontSize}
                fontWeight={axis.connector.fontWeight}
                className={WATERFALL_AXIS_STYLES.connector}
              >
                →
              </text>
            ) : null}
            <rect
              x={x}
              y={yTop}
              width={barW}
              height={Math.max(2, height)}
              rx="4"
              fill={step.fill}
              fillOpacity={step.kind === "total" ? 0.92 : 0.82}
              stroke={step.stroke}
              strokeWidth="1"
            />
            <text
              x={x + barW / 2}
              y={chartH + axis.labelY}
              textAnchor="middle"
              fontSize={axis.label.fontSize}
              fontWeight={axis.label.fontWeight}
              className={WATERFALL_AXIS_STYLES.label}
            >
              {step.shortLabel}
            </text>
            <text
              x={x + barW / 2}
              y={chartH + axis.valueY}
              textAnchor="middle"
              fontSize={axis.value.fontSize}
              fontWeight={axis.value.fontWeight}
              className={WATERFALL_AXIS_STYLES.value}
            >
              {formatDelta(step.kind === "start" || step.kind === "total" ? step.delta : step.delta, fmt)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DetailPanel({
  breakdown,
  fmt,
  isCurrentMonthEstimate
}: {
  breakdown: ValeurReelleDailyBreakdown;
  fmt: Fmt;
  isCurrentMonthEstimate: boolean;
}) {
  const deductionRows = [
    {
      label: "CSG imputée",
      sub: "Part journalière de la CSG sur la période",
      value: -breakdown.csgPerDay
    },
    {
      label: "Frais société imputés",
      sub: "DigitPro / jour (compta, outils, assurances…)",
      value: -breakdown.mandatoryFeesPerDay
    },
    {
      label: "Frais perso imputés",
      sub: "Allocation journalière avant récupération",
      value: -breakdown.personalChargesPerDay
    }
  ];

  return (
    <div className="space-y-3 border-t border-ink-200/60 pt-3 dark:border-white/[0.06]">
      <ValeurReelleRetainedValueExplainer
        breakdown={breakdown}
        fmt={fmt}
        isCurrentMonthEstimate={isCurrentMonthEstimate}
        variant="panel"
      />

      <div>
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-white/40">
          Charges imputées au CA (waterfall)
        </p>
        <dl className="space-y-1">
          {deductionRows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 rounded-lg bg-ink-50/50 px-2 py-1.5 text-[11px] dark:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <dt className="font-semibold text-ink-800 dark:text-white/85">{row.label}</dt>
                <dd className="text-[10px] font-medium text-ink-500 dark:text-white/40">{row.sub}</dd>
              </div>
              <dd className="shrink-0 font-bold tabular-nums text-rose-700 dark:text-rose-300">
                −{fmt.euro(Math.abs(row.value))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

type Props = {
  tree: ValeurReelleCashTree;
  fmt: Fmt;
  tjmHt: number;
  billableDays: number;
  gainPerWorkDayEstimate: GainPerWorkDayEstimate | null;
};

export function ValeurReelleDailyValueCard({
  tree,
  fmt,
  tjmHt,
  billableDays,
  gainPerWorkDayEstimate
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isCurrentMonthEstimate = gainPerWorkDayEstimate != null;

  const breakdown = useMemo(
    () =>
      computeValeurReelleDailyBreakdown({
        tree,
        tjmHt,
        billableDays,
        gainPerWorkDayEstimate
      }),
    [billableDays, gainPerWorkDayEstimate, tjmHt, tree]
  );

  const steps = useMemo(() => buildMiniSteps(breakdown), [breakdown]);
  const basisLabel = formatWorkedDaysLabel(breakdown, isCurrentMonthEstimate);

  if (breakdown.caHtPerDay <= 0 && breakdown.netPerDay <= 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-4 rounded-2xl border border-ink-200/80 bg-white/75 px-4 py-3.5 dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.04] sm:px-5 sm:py-4"
      aria-label="Décomposition journalière"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-white/42">
            Par jour facturé
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/38">{basisLabel}</p>
        </div>
        <PremiumIconBadge icon={TrendingUp} tone="emerald" size="md" />
      </div>

      <div className="mt-3 overflow-x-auto">
        <MiniWaterfallSvg steps={steps} fmt={fmt} />
      </div>

      <div className="mt-2 rounded-xl border border-emerald-500/12 bg-emerald-500/[0.06] px-3 py-2 dark:border-emerald-400/18 dark:bg-emerald-500/08">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/42">
              Valeur retenue
            </span>
            <ValeurReelleRetainedValueExplainer
              breakdown={breakdown}
              fmt={fmt}
              isCurrentMonthEstimate={isCurrentMonthEstimate}
            />
          </div>
          <span className="font-display text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
            {fmt.euro(breakdown.netPerDay)}
            <span className="ml-1 text-[10px] font-semibold text-ink-500 dark:text-white/40">/ jour</span>
          </span>
        </div>
        {breakdown.netExceedsTjm ? (
          <ValeurReelleRetainedValueExplainer
            breakdown={breakdown}
            fmt={fmt}
            isCurrentMonthEstimate={isCurrentMonthEstimate}
            variant="inline-banner"
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((o) => !o)}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-semibold text-ink-500 transition hover:bg-ink-50 hover:text-ink-800 dark:text-white/42 dark:hover:bg-white/[0.04] dark:hover:text-white/75"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? "Masquer le détail" : "Comprendre le calcul"}
        <ChevronDown
          className={clsx("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {detailsOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <DetailPanel
              breakdown={breakdown}
              fmt={fmt}
              isCurrentMonthEstimate={isCurrentMonthEstimate}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
