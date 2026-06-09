"use client";

import { useMemo } from "react";
import { CalendarRange, Crosshair, Sparkles, Target, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import { computeActivityAnnualForecast } from "@/lib/activity-annual-forecast";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";

type Props = {
  selected: ReadonlySet<string>;
  sortedWorkDayIsos: readonly string[];
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  annualRevenueTargetHt: number | null;
};

function ForecastMetric({
  label,
  value,
  sublabel,
  icon: Icon,
  iconClassName,
  highlight = false
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: typeof Target;
  iconClassName: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex min-h-[7rem] flex-col rounded-2xl border px-4 py-3.5",
        highlight
          ? "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white shadow-sm dark:border-amber-400/20 dark:from-amber-500/10 dark:to-transparent"
          : "border-ink-200/80 bg-white/80 shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
          {label}
        </p>
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
            ? "text-2xl text-amber-900 dark:text-amber-100 sm:text-[1.65rem]"
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

export function ActivityAnnualForecastCard({
  selected,
  sortedWorkDayIsos,
  billableRatePeriods,
  fallbackTjmHt,
  currentTjmHt,
  annualRevenueTargetHt
}: Props) {
  const fmt = useDashboardDisplayFormat();

  const forecast = useMemo(
    () =>
      computeActivityAnnualForecast({
        selected,
        sortedWorkDayIsos,
        billableRatePeriods,
        fallbackTjmHt,
        currentTjmHt,
        annualRevenueTargetHt
      }),
    [
      annualRevenueTargetHt,
      billableRatePeriods,
      currentTjmHt,
      fallbackTjmHt,
      selected,
      sortedWorkDayIsos
    ]
  );

  const achievementPct = forecast.revenueTargetAchievementPct ?? 0;
  const projectedPct = forecast.forecastedAchievementPct ?? achievementPct;
  const barPct = Math.min(100, Math.max(0, achievementPct));
  const projectedMarkerPct = Math.min(100, Math.max(0, projectedPct));

  const metricIcon =
    "text-amber-600 bg-amber-50 border-amber-200/80 dark:text-amber-300 dark:bg-amber-500/12 dark:border-amber-300/20";

  return (
    <section className="rounded-[2rem] border border-ink-200/80 bg-gradient-to-b from-white via-white to-amber-50/35 p-5 shadow-[0_20px_60px_-28px_rgba(245,158,11,0.22)] dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_32px_80px_-24px_rgba(0,22,28,0.72)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200/80 bg-amber-50 text-amber-600 dark:border-amber-300/20 dark:bg-amber-500/12 dark:text-amber-300">
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700/85 dark:text-amber-300/80">
              Prévision annuelle
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink-900 dark:text-white">
              Objectif {forecast.year}
            </h2>
            <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-ink-600 dark:text-white/50">
              Projection au rythme agenda · jours cochés + ouvrés restants × TJM
            </p>
          </div>
        </div>
        {forecast.hasTarget && forecast.targetHtEur != null ? (
          <div className="rounded-2xl border border-ink-200/70 bg-white/70 px-4 py-2.5 text-right dark:border-white/10 dark:bg-white/[0.05]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
              Objectif CA HT
            </p>
            <p className="font-display text-lg font-bold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(forecast.targetHtEur)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ForecastMetric
          label="Jours facturés prévus"
          value={`${fmt.int(forecast.forecastedBilledDays)} j.`}
          sublabel="Capacité annuelle planifiée"
          icon={CalendarRange}
          iconClassName={metricIcon}
        />
        <ForecastMetric
          label="CA HT prévu"
          value={fmt.euro(forecast.forecastedRevenueHtEur)}
          sublabel="Projection fin d'année"
          icon={TrendingUp}
          iconClassName={metricIcon}
          highlight
        />
        <ForecastMetric
          label="Jours restants objectif"
          value={
            forecast.hasTarget
              ? forecast.remainingDaysToTarget != null
                ? `${fmt.int(forecast.remainingDaysToTarget)} j.`
                : "—"
              : "—"
          }
          sublabel={
            forecast.hasTarget
              ? `À produire · TJM ${fmt.euro(currentTjmHt)}`
              : "Définissez un objectif annuel"
          }
          icon={Crosshair}
          iconClassName={metricIcon}
        />
        <ForecastMetric
          label="Atteinte objectif CA"
          value={
            forecast.hasTarget && forecast.revenueTargetAchievementPct != null
              ? `${fmt.int(forecast.revenueTargetAchievementPct)} %`
              : "—"
          }
          sublabel={
            forecast.hasTarget
              ? `${fmt.euro(forecast.achievedHtEur)} réalisé · prévu ${fmt.int(projectedPct)} %`
              : "Paramétrez l'objectif dans le hero"
          }
          icon={Target}
          iconClassName={metricIcon}
        />
      </div>

      {forecast.hasTarget ? (
        <div className="mt-4 rounded-2xl border border-ink-200/70 bg-white/60 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/45">
            <span>Avancement objectif CA HT</span>
            <span className="tabular-nums text-ink-900 dark:text-white">
              {fmt.int(achievementPct)} % · prévision {fmt.int(projectedPct)} %
            </span>
          </div>
          <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-700 dark:from-amber-500 dark:to-amber-400"
              style={{ width: `${barPct}%` }}
              role="progressbar"
              aria-valuenow={barPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avancement actuel de l'objectif"
            />
            {projectedPct > achievementPct ? (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-700 dark:bg-amber-200"
                style={{ left: `${projectedMarkerPct}%` }}
                title={`Projection fin d'année : ${fmt.int(projectedPct)} %`}
                aria-hidden
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] font-medium tabular-nums text-ink-500 dark:text-white/40">
            <span>{fmt.euro(forecast.achievedHtEur)} réalisé</span>
            <span>{fmt.euro(forecast.forecastedRevenueHtEur)} prévu</span>
            <span>{fmt.euro(forecast.targetHtEur ?? 0)} cible</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-ink-200/70 bg-white/60 px-4 py-3 text-[11px] font-medium text-ink-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/55">
          Renseignez un objectif annuel de CA HT (section Objectif annuel du dashboard) pour activer le
          suivi des jours restants et l&apos;atteinte de cible.
        </p>
      )}
    </section>
  );
}
