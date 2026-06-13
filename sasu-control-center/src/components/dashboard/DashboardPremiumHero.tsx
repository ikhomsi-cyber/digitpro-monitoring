"use client";

import { useMemo } from "react";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { computeYearEndProjection, type YearEndProjection } from "@/lib/year-end-projection";
import { computeKpiTrend, type KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { dashboardFlatHero, dashboardInsightCard } from "@/lib/dashboard-surfaces";

type Props = {
  stats: DashboardHeroStats;
  transactions: DashboardTx[];
  statsReady: boolean;
  contextMessage: string;
  showContextBanner: boolean;
};

function ConfidenceBadge({ projection }: { projection: YearEndProjection }) {
  return (
    <span className="text-xs font-medium text-ink-500 dark:text-white/45">
      Confiance {projection.confidence.label.toLowerCase()}{" "}
      <span className="tabular-nums text-ink-700 dark:text-white/70">{projection.confidence.score}%</span>
    </span>
  );
}

function YearEndProjectionCard({
  projection,
  formatEuro,
  formatInt,
  trend
}: {
  projection: YearEndProjection;
  formatEuro: (n: number) => string;
  formatInt: (n: number) => number;
  trend?: KpiTrend | null;
}) {
  const rows = [
    { label: "Revenu perso", value: formatEuro(projection.projectedPersonalIncomeEur) },
    { label: "CSG projetée", value: formatEuro(projection.projectedCsgEur) },
    { label: "Trésorerie", value: formatEuro(projection.projectedCashEur) }
  ];

  return (
    <div className={dashboardInsightCard}>
      <p className="text-sm text-ink-500 dark:text-white/50">Projection fin d&apos;année</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
          {formatEuro(projection.projectedRevenueHtEur)}
          <span className="ml-1.5 text-sm font-medium text-ink-500 dark:text-white/45">HT</span>
        </p>
        <KpiTrendBadge trend={trend} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500 dark:text-white/45">Prévision au {projection.forecastDateLabel}</p>
        <ConfidenceBadge projection={projection} />
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-ink-500 dark:text-white/50">{row.label}</dt>
            <dd className="mt-1 font-display text-lg font-semibold tabular-nums text-ink-900 dark:text-white">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-ink-400 dark:text-white/35">
        {projection.detail.basisLabel}
        {projection.detail.habitYearsSampled > 0
          ? ` · ${projection.detail.habitYearsSampled} an${projection.detail.habitYearsSampled > 1 ? "s" : ""} d’historique`
          : ""}{" "}
        · {formatInt(projection.detail.remainingCapacityDays)} j. restants sur{" "}
        {formatInt(projection.detail.totalCapacityDays)} j. planifiés
      </p>
    </div>
  );
}

export function DashboardPremiumHero({ stats, transactions, statsReady, contextMessage, showContextBanner }: Props) {
  const fmt = useDashboardDisplayFormat();
  const billable = useBillableActivity();

  const projectionTrend = useMemo(() => {
    if (!statsReady || !stats.momKpis) return null;
    const mom = stats.momKpis;
    const ytd = stats.ytdMonthly;
    const currentMonthHt = ytd[ytd.length - 1]?.revenueHtEur ?? stats.tjmRepartitionMois.caHtEur;
    const previousMonthHt =
      ytd.length >= 2 ? ytd[ytd.length - 2]!.revenueHtEur : mom.tjmRepartitionMois.caHtEur;
    return computeKpiTrend(currentMonthHt, previousMonthHt);
  }, [stats, statsReady]);

  const yearEndProjection = useMemo(
    () =>
      computeYearEndProjection({
        selectedWorkDayIsos: billable.sortedIsos,
        billableRatePeriods: billable.billableRatePeriods,
        fallbackTjmHt: billable.tjmHt,
        transactions,
        ytdRevenueHtEur: stats.caAnnuelEncaisseHtEur,
        tjmRepartition: stats.tjmRepartitionMois,
        soldeQontoEur: stats.soldeQontoEur,
        detteTotaleEur: stats.detteTotaleDepuisDebutEur,
        statsReady
      }),
    [
      billable.billableRatePeriods,
      billable.sortedIsos,
      billable.tjmHt,
      stats.caAnnuelEncaisseHtEur,
      stats.detteTotaleDepuisDebutEur,
      stats.soldeQontoEur,
      stats.tjmRepartitionMois,
      statsReady,
      transactions
    ]
  );

  return (
    <header className={dashboardFlatHero} suppressHydrationWarning>
      <div suppressHydrationWarning>
        {showContextBanner ? (
          <p className="mb-3 max-w-2xl border-l-2 border-amber-400/80 py-1 pl-4 text-sm text-amber-950 dark:border-amber-400/50 dark:text-amber-50">
            {contextMessage}
          </p>
        ) : null}

        <YearEndProjectionCard
            projection={yearEndProjection}
            formatEuro={fmt.euro}
            formatInt={fmt.int}
            trend={projectionTrend}
          />
      </div>
    </header>
  );
}
