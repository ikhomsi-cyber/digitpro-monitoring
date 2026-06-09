"use client";

import { useMemo } from "react";
import { BarChart3, BriefcaseBusiness, CalendarDays, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import { computeActivityProductivitySummary } from "@/lib/activity-productivity";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";

type Props = {
  selected: ReadonlySet<string>;
  viewYear: number;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  persistToSupabase: boolean;
};

function MetricCell({
  label,
  value,
  sublabel,
  icon: Icon,
  iconClassName,
  emphasized = false
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: typeof BriefcaseBusiness;
  iconClassName: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-3 py-2.5",
        emphasized
          ? "border-emerald-200/80 bg-emerald-50/55 dark:border-emerald-400/20 dark:bg-emerald-500/10"
          : "border-white/80 bg-white/70 shadow-sm backdrop-blur-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.07] dark:shadow-none"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium text-ink-500 dark:text-ink-400">{label}</p>
        <span
          className={clsx(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
            iconClassName
          )}
          aria-hidden
        >
          <Icon className="h-3 w-3" strokeWidth={2} />
        </span>
      </div>
      <p
        className={clsx(
          "mt-1 font-display font-bold tabular-nums",
          emphasized
            ? "text-base text-emerald-900 dark:text-emerald-200 sm:text-lg"
            : "text-base text-ink-900 dark:text-ink-50"
        )}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-0.5 text-[10px] font-medium text-ink-400 dark:text-white/35">{sublabel}</p>
      ) : null}
    </div>
  );
}

export function ActivityProductivitySummary({
  selected,
  viewYear,
  billableRatePeriods,
  fallbackTjmHt,
  currentTjmHt,
  persistToSupabase
}: Props) {
  const fmt = useDashboardDisplayFormat();

  const summary = useMemo(
    () =>
      computeActivityProductivitySummary({
        selected,
        viewYear,
        billableRatePeriods,
        fallbackTjmHt,
        currentTjmHt
      }),
    [billableRatePeriods, currentTjmHt, fallbackTjmHt, selected, viewYear]
  );

  const isCurrentYear = viewYear === new Date().getFullYear();

  return (
    <div className="flex h-full flex-col justify-center rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 via-white to-emerald-50/30 p-3.5 dark:border-cyan-100/[0.10] dark:bg-[#0b3038]/86 dark:bg-none sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-800/75 dark:text-indigo-300/80">
            Synthèse productivité
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">
            Année {viewYear}
            {isCurrentYear ? " · projection au rythme actuel" : " · réalisé"}
          </p>
        </div>
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-indigo-50 text-indigo-600 dark:border-indigo-300/20 dark:bg-indigo-500/12 dark:text-indigo-300"
          aria-hidden
        >
          <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MetricCell
          label="TJM actuel"
          value={fmt.euro(summary.currentTjmHt)}
          sublabel="HT · mois en cours"
          icon={BriefcaseBusiness}
          iconClassName="text-emerald-600 bg-emerald-50 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/12 dark:border-emerald-300/20"
        />
        <MetricCell
          label="Jours travaillés"
          value={`${fmt.int(summary.workedDays)} j.`}
          sublabel={`Cochés en ${viewYear}`}
          icon={CalendarDays}
          iconClassName="text-violet-600 bg-violet-50 border-violet-200/80 dark:text-violet-300 dark:bg-violet-500/12 dark:border-violet-300/20"
        />
        <MetricCell
          label="Moyenne jours/mois"
          value={`${summary.averageDaysPerMonth.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j.`}
          sublabel={isCurrentYear ? "Sur les mois écoulés" : "Sur 12 mois"}
          icon={BarChart3}
          iconClassName="text-sky-600 bg-sky-50 border-sky-200/80 dark:text-sky-300 dark:bg-sky-500/12 dark:border-sky-300/20"
        />
        <MetricCell
          label="CA annuel projeté"
          value={fmt.euro(summary.projectedAnnualRevenueHt)}
          sublabel="HT"
          icon={TrendingUp}
          iconClassName="text-amber-600 bg-amber-50 border-amber-200/80 dark:text-amber-300 dark:bg-amber-500/12 dark:border-amber-300/20"
          emphasized
        />
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-ink-500 dark:text-ink-400">
        {persistToSupabase
          ? "Données synchronisées avec votre compte (Supabase)."
          : "Données enregistrées localement (mode démo ou lecture seule)."}
        {" "}
        Projection = rythme {viewYear} annualisé sur base des jours cochés.
      </p>
    </div>
  );
}
