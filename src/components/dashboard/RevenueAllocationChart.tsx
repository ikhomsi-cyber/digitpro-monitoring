"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import type { KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { dashboardFlatKpi } from "@/lib/dashboard-surfaces";

export type RevenueAllocationInput = {
  caHtEur: number;
  bncEur: number;
  fraisPersoEur: number;
  csgEur: number;
  fraisDigitProEur: number;
};

type AllocationSegment = {
  id: string;
  label: string;
  flowLabel: string;
  valueEur: number;
  colorClass: string;
  textClass: string;
  tooltip: string;
};

type Props = {
  allocation: RevenueAllocationInput;
  formatEuro: (n: number) => string;
  formatInt: (n: number) => number;
  trend?: KpiTrend | null;
};

function buildSegments(allocation: RevenueAllocationInput): AllocationSegment[] {
  return [
    {
      id: "bnc",
      label: "BNC",
      flowLabel: "BNC",
      valueEur: Math.max(0, allocation.bncEur),
      colorClass: "bg-teal-600 dark:bg-teal-400",
      textClass: "text-ink-700 dark:text-white/75",
      tooltip:
        "Honoraires versés en BNC (rémunération dirigeant), estimés à partir de la répartition Valeur réelle du mois."
    },
    {
      id: "personal",
      label: "Perso",
      flowLabel: "Personal",
      valueEur: Math.max(0, allocation.fraisPersoEur),
      colorClass: "bg-teal-500 dark:bg-teal-400/80",
      textClass: "text-ink-700 dark:text-white/75",
      tooltip:
        "Charges personnelles couvertes sur l'activité : repas, indemnités kilométriques et frais perso refacturés."
    },
    {
      id: "csg",
      label: "CSG",
      flowLabel: "CSG",
      valueEur: Math.max(0, allocation.csgEur),
      colorClass: "bg-teal-400/80 dark:bg-teal-400/55",
      textClass: "text-ink-600 dark:text-white/65",
      tooltip:
        "Cotisations sociales (CSG) provisionnées sur le chiffre d'affaires du mois en cours."
    },
    {
      id: "expenses",
      label: "Dépenses",
      flowLabel: "Expenses",
      valueEur: Math.max(0, allocation.fraisDigitProEur),
      colorClass: "bg-ink-400 dark:bg-white/30",
      textClass: "text-ink-600 dark:text-white/65",
      tooltip:
        "Frais obligatoires DigitPro (compta, assurances, outils) imputés au TJM et déduits du revenu disponible."
    }
  ];
}

function AllocationTooltip({
  segment,
  pct,
  formatEuro
}: {
  segment: AllocationSegment;
  pct: number;
  formatEuro: (n: number) => string;
}) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-left text-[10px] font-medium leading-snug text-ink-700 shadow-[0_18px_60px_-24px_rgba(0,0,0,0.35)] group-focus-within/segment:block group-hover/segment:block dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:text-white/80"
    >
      <span className="block font-bold text-ink-900 dark:text-white">{segment.label}</span>
      <span className="mt-1 block tabular-nums">
        {formatEuro(segment.valueEur)} · {pct.toFixed(1)} % du mois
      </span>
      <span className="mt-1.5 block text-ink-500 dark:text-white/50">{segment.tooltip}</span>
    </span>
  );
}

export function RevenueAllocationChart({ allocation, formatEuro, formatInt, trend }: Props) {
  const revenueEur = Math.max(0, allocation.caHtEur);
  const segments = useMemo(() => buildSegments(allocation), [allocation]);
  const allocatedTotal = segments.reduce((sum, s) => sum + s.valueEur, 0);
  const barDenominator = Math.max(revenueEur, allocatedTotal, 1);

  const flowSteps = [
    { label: "Revenue", valueEur: revenueEur, emphasized: true },
    ...segments.map((s) => ({ label: s.flowLabel, valueEur: s.valueEur, emphasized: false }))
  ];

  return (
    <div className={dashboardFlatKpi}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
              Allocation du revenu
            </p>
            <KpiTrendBadge trend={trend} />
          </div>
          <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-ink-900 dark:text-white sm:text-2xl">
            {formatEuro(revenueEur)}
            <span className="ml-1.5 align-baseline text-xs font-semibold text-ink-500 dark:text-white/45">
              HT · mois
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px] font-bold text-ink-500 dark:text-white/45">
        {flowSteps.map((step, index) => (
          <span key={step.label} className="inline-flex items-center gap-1">
            {index > 0 ? <ArrowRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden /> : null}
            <span
              className={clsx(
                "rounded-full px-2 py-0.5",
                step.emphasized
                  ? "bg-ink-100 text-ink-800 dark:bg-white/[0.10] dark:text-white"
                  : "bg-white/70 text-ink-600 dark:bg-white/[0.05] dark:text-white/65"
              )}
            >
              {step.label}
            </span>
          </span>
        ))}
      </div>

      <div
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-ink-200/70 dark:bg-[#06242b]/70"
        role="img"
        aria-label="Répartition du revenu mensuel entre BNC, charges perso, CSG et dépenses"
      >
        {segments.map((segment) => {
          const pct = (segment.valueEur / barDenominator) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={segment.id}
              className={clsx("group/segment relative h-full min-w-[4px] focus-within:z-10 hover:z-10", segment.colorClass)}
              style={{ width: `${pct}%` }}
              tabIndex={0}
              aria-label={`${segment.label} : ${formatEuro(segment.valueEur)} sur le mois, ${pct.toFixed(1)} pour cent`}
            >
              <AllocationTooltip segment={segment} pct={pct} formatEuro={formatEuro} />
            </div>
          );
        })}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map((segment) => {
          const pct = (segment.valueEur / barDenominator) * 100;
          return (
            <li
              key={`legend-${segment.id}`}
              className="group/segment relative min-w-0 rounded-xl border border-ink-200/70 bg-white/55 px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]"
              tabIndex={0}
            >
              <AllocationTooltip segment={segment} pct={pct} formatEuro={formatEuro} />
              <div className="flex items-center gap-1.5">
                <span className={clsx("h-2 w-2 shrink-0 rounded-full", segment.colorClass)} aria-hidden />
                <span className={clsx("truncate text-[10px] font-bold", segment.textClass)}>{segment.label}</span>
              </div>
              <p className="mt-1 font-display text-sm font-bold tabular-nums text-ink-900 dark:text-white">
                {formatEuro(segment.valueEur)}
              </p>
              <p className="text-[10px] font-semibold tabular-nums text-ink-500 dark:text-white/40">
                {formatInt(pct)} %
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
