"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import type { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { ValeurReelleRetainedValueExplainer } from "@/components/dashboard/ValeurReelleRetainedValueExplainer";
import type { GainPerWorkDayEstimate } from "@/lib/valeur-reelle-gain-per-day";
import {
  computeValeurReelleDailyBreakdown,
  type ValeurReelleDailyBreakdown
} from "@/lib/valeur-reelle-daily-value";
import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";
import {
  ValeurReelleWaterfallSvg,
  type ValeurReelleWaterfallSvgStep
} from "@/components/dashboard/ValeurReelleWaterfallSvg";

type Fmt = ReturnType<typeof useDashboardDisplayFormat>;

function pctOfDaily(amount: number, caHt: number): number {
  if (caHt <= 0) return 0;
  return Math.round((Math.abs(amount) / caHt) * 1000) / 10;
}

function buildDailyWaterfallSteps(b: ValeurReelleDailyBreakdown): ValeurReelleWaterfallSvgStep[] {
  const afterCsg = b.caHtPerDay - b.csgPerDay;
  const afterImpots = afterCsg - b.impotPerDay;
  const afterIk = afterImpots - b.ikPerDay;
  const afterBusiness = afterIk - b.mandatoryFeesPerDay;
  const afterPersonal = afterBusiness - b.personalChargesPerDay;
  const ca = b.caHtPerDay;

  const steps: ValeurReelleWaterfallSvgStep[] = [
    {
      id: "revenue",
      label: "CA HT",
      deltaEur: ca,
      cumulativeEur: ca,
      kind: "start",
      pctOfCaHt: ca > 0 ? 100 : 0
    },
    {
      id: "csg",
      label: "CSG",
      deltaEur: -b.csgPerDay,
      cumulativeEur: afterCsg,
      kind: "decrease",
      pctOfCaHt: pctOfDaily(b.csgPerDay, ca)
    }
  ];

  if (b.impotPerDay > 0.01) {
    steps.push({
      id: "impots",
      label: "Impôts",
      deltaEur: -b.impotPerDay,
      cumulativeEur: afterImpots,
      kind: "decrease",
      pctOfCaHt: pctOfDaily(b.impotPerDay, ca)
    });
  }

  if (b.ikPerDay > 0.01) {
    steps.push({
      id: "ik",
      label: "IK",
      deltaEur: -b.ikPerDay,
      cumulativeEur: afterIk,
      kind: "decrease",
      pctOfCaHt: pctOfDaily(b.ikPerDay, ca)
    });
  }

  steps.push(
    {
      id: "business",
      label: "Frais DigitPro",
      deltaEur: -b.mandatoryFeesPerDay,
      cumulativeEur: afterBusiness,
      kind: "decrease",
      pctOfCaHt: pctOfDaily(b.mandatoryFeesPerDay, ca)
    },
    {
      id: "personal",
      label: "Frais perso",
      deltaEur: -b.personalChargesPerDay,
      cumulativeEur: afterPersonal,
      kind: "decrease",
      pctOfCaHt: pctOfDaily(b.personalChargesPerDay, ca)
    },
    {
      id: "retained",
      label: "Valeur retenue",
      deltaEur: b.netPerDay,
      cumulativeEur: b.netPerDay,
      kind: "total",
      pctOfCaHt: pctOfDaily(b.netPerDay, ca)
    }
  );

  return steps;
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
      label: "Impôts imputés",
      sub: "Impôt sur le revenu payé ou estimé sur le BNC",
      value: -breakdown.impotPerDay
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

  const steps = useMemo(() => buildDailyWaterfallSteps(breakdown), [breakdown]);
  const basisLabel = formatWorkedDaysLabel(breakdown, isCurrentMonthEstimate);
  const retainedPct =
    breakdown.caHtPerDay > 0
      ? Math.round((breakdown.netPerDay / breakdown.caHtPerDay) * 1000) / 10
      : null;

  if (breakdown.caHtPerDay <= 0 && breakdown.netPerDay <= 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-3"
      aria-label="Décomposition journalière"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
          Par jour facturé
        </p>
        <p className="mt-0.5 text-[10px] font-medium text-ink-400 dark:text-white/35">
          CA HT → déductions → valeur retenue · {basisLabel}
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <ValeurReelleWaterfallSvg
          steps={steps}
          formatDelta={(delta) =>
            delta >= 0 ? fmt.euro(delta) : `−${fmt.euro(Math.abs(delta))}`
          }
          ariaLabel="Waterfall journalier par jour facturé"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-200/40 pt-3 dark:border-cyan-100/[0.07]">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
          = Valeur retenue
          <ValeurReelleRetainedValueExplainer
            breakdown={breakdown}
            fmt={fmt}
            isCurrentMonthEstimate={isCurrentMonthEstimate}
          />
        </span>
        <div className="text-right">
          <span className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-white">
            {fmt.euro(breakdown.netPerDay)}
          </span>
          <span className="ml-2 text-[10px] font-semibold tabular-nums text-ink-500 dark:text-white/40">
            {retainedPct != null ? `${retainedPct} % du CA HT · / jour` : "/ jour"}
          </span>
        </div>
      </div>

      {breakdown.netExceedsTjm ? (
        <ValeurReelleRetainedValueExplainer
          breakdown={breakdown}
          fmt={fmt}
          isCurrentMonthEstimate={isCurrentMonthEstimate}
          variant="inline-banner"
        />
      ) : null}

      <ol className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-ink-500 dark:text-white/45">
        {steps.map((step, index) => (
          <li key={`flow-${step.id}`} className="inline-flex items-center gap-1">
            {index > 0 ? <span className="opacity-40">→</span> : null}
            <span
              className={clsx(
                "rounded-full px-2 py-0.5",
                step.kind === "total"
                  ? "bg-ink-100 text-ink-800 dark:bg-white/[0.10] dark:text-white"
                  : "bg-ink-50 text-ink-600 dark:bg-white/[0.06] dark:text-white/65"
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>

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
