"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import { computeActivityTjmPerformance } from "@/lib/activity-tjm-performance";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";

type Props = {
  selected: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
};

function TjmMetricCard({
  label,
  value,
  sublabel,
  trend,
  icon: Icon,
  iconClassName,
  highlight = false
}: {
  label: string;
  value: string;
  sublabel?: string;
  trend?: ReturnType<typeof computeActivityTjmPerformance>["trends"]["current"];
  icon: typeof BriefcaseBusiness;
  iconClassName: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex min-h-[7rem] flex-col rounded-2xl border px-4 py-3.5",
        highlight
          ? "border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white shadow-sm dark:border-indigo-400/20 dark:from-indigo-500/10 dark:to-transparent"
          : "border-ink-200/80 bg-white/80 shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
            {label}
          </p>
          <KpiTrendBadge trend={trend} />
        </div>
        <span
          className={clsx(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
            iconClassName
          )}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      <p
        className={clsx(
          "mt-2 font-display font-bold tabular-nums tracking-tight",
          highlight
            ? "text-2xl text-indigo-900 dark:text-indigo-100 sm:text-[1.65rem]"
            : "text-xl text-ink-900 dark:text-white sm:text-2xl"
        )}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-[10px] font-medium text-ink-500 dark:text-white/40">{sublabel}</p>
      ) : null}
    </div>
  );
}

export function ActivityTjmPerformanceCard({
  selected,
  billableRatePeriods,
  fallbackTjmHt,
  currentTjmHt
}: Props) {
  const fmt = useDashboardDisplayFormat();

  const performance = useMemo(
    () =>
      computeActivityTjmPerformance({
        selected,
        billableRatePeriods,
        fallbackTjmHt,
        currentTjmHt
      }),
    [billableRatePeriods, currentTjmHt, fallbackTjmHt, selected]
  );

  return (
    <section className="rounded-[2rem] border border-ink-200/80 bg-gradient-to-b from-white via-white to-indigo-50/35 p-5 shadow-[0_20px_60px_-28px_rgba(79,70,229,0.25)] dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_32px_80px_-24px_rgba(0,22,28,0.72)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-200/80 bg-indigo-50 text-indigo-600 dark:border-indigo-300/20 dark:bg-indigo-500/12 dark:text-indigo-300">
            <Gauge className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-700/85 dark:text-indigo-300/80">
              Performance TJM
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink-900 dark:text-white">
              {performance.year} · analyse YTD
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-3 py-1.5 text-[10px] font-bold text-ink-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/65">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Tendance vs mois précédent
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TjmMetricCard
          label="TJM actuel"
          value={fmt.euro(performance.currentTjmHt)}
          sublabel="HT · mois en cours"
          trend={performance.trends.current}
          icon={BriefcaseBusiness}
          iconClassName="text-indigo-600 bg-indigo-50 border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-500/12 dark:border-indigo-300/20"
          highlight
        />
        <TjmMetricCard
          label="TJM moyen YTD"
          value={fmt.euro(performance.averageTjmYtd)}
          sublabel="HT · pondéré par jours travaillés"
          trend={performance.trends.averageYtd}
          icon={Gauge}
          iconClassName="text-sky-600 bg-sky-50 border-sky-200/80 dark:text-sky-300 dark:bg-sky-500/12 dark:border-sky-300/20"
        />
        <TjmMetricCard
          label="Meilleur mois"
          value={fmt.euro(performance.bestMonth.tjmHt)}
          sublabel={`${performance.bestMonth.monthLabel} · ${fmt.int(performance.bestMonth.workedDays)} j.`}
          trend={performance.trends.best}
          icon={ArrowUpRight}
          iconClassName="text-emerald-600 bg-emerald-50 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/12 dark:border-emerald-300/20"
        />
        <TjmMetricCard
          label="Pire mois"
          value={fmt.euro(performance.worstMonth.tjmHt)}
          sublabel={`${performance.worstMonth.monthLabel} · ${fmt.int(performance.worstMonth.workedDays)} j.`}
          trend={performance.trends.worst}
          icon={ArrowDownRight}
          iconClassName="text-rose-600 bg-rose-50 border-rose-200/80 dark:text-rose-300 dark:bg-rose-500/12 dark:border-rose-300/20"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200/70 bg-white/60 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/45">
          <TrendingDown className="h-3.5 w-3.5" aria-hidden />
          Écart YTD
        </div>
        <p className="text-[11px] font-medium text-ink-600 dark:text-white/55">
          Spread{" "}
          <span className="font-bold tabular-nums text-ink-900 dark:text-white">
            {fmt.euro(performance.bestMonth.tjmHt - performance.worstMonth.tjmHt)}
          </span>{" "}
          HT entre {performance.bestMonth.monthLabel.toLowerCase()} et{" "}
          {performance.worstMonth.monthLabel.toLowerCase()}
        </p>
      </div>
    </section>
  );
}
