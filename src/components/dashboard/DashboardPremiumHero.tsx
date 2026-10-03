"use client";

import { useMemo } from "react";
import { ChartNoAxesCombined, Vault, Shield, Wallet } from "lucide-react";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { computeYearEndProjection, type YearEndProjection } from "@/lib/year-end-projection";
import { computeKpiTrend, type KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { YearEndProjectionChart } from "@/components/dashboard/YearEndProjectionChart";
import { dashboardFlatHero, dashboardInsightCard } from "@/lib/dashboard-surfaces";
import { computeYearToDateInvoicingTotals } from "@/lib/invoice-worked-days-series";
import { useHiwayInvoicesOptional } from "@/components/dashboard/HiwayInvoicesContext";

type Props = {
  stats: DashboardHeroStats;
  transactions: DashboardTx[];
  statsReady: boolean;
  contextMessage: string;
  showContextBanner: boolean;
};

function DashboardIndicators({ stats, ready, formatEuro, invoicedRevenueHtEur }: {
  stats: DashboardHeroStats;
  ready: boolean;
  formatEuro: (value: number) => string;
  invoicedRevenueHtEur: number;
}) {
  const cash = stats.soldeQontoEur;
  const debt = stats.detteTotaleDepuisDebutEur;
  const debt172 = stats.csgComparaison172Eur + stats.detteTvaDepuisDebutEur;
  const coverage172 = cash === null ? null : debt172 > 0 ? Math.min(100, Math.max(0, cash / debt172 * 100)) : 100;
  const coverage = cash === null ? null : debt > 0 ? Math.min(100, Math.max(0, cash / debt * 100)) : 100;
  const indicators = [
    { label: "Trésorerie", value: cash === null ? "—" : formatEuro(cash), icon: Vault, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300", detail: "Solde du compte professionnel" },
    { label: "CA facturé HT", value: formatEuro(invoicedRevenueHtEur), icon: ChartNoAxesCombined, color: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300", detail: "Chiffre d’affaires facturé HT depuis janvier" },
    { label: "Dette à 9,7 %", value: formatEuro(debt), icon: Wallet, color: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300", detail: "Dette CSG à 9,7 % et TVA cumulée" },
    { label: "Dette à 17,2 %", value: formatEuro(debt172), icon: Wallet, color: "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300", detail: "Dette CSG à 17,2 % et TVA cumulée" },
    { label: "Sécurisation 9,7 %", value: coverage === null ? "—" : `${Math.round(coverage)}%`, icon: Shield, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300", detail: "Part de la dette à 9,7 %, TVA incluse, couverte par la trésorerie" },
    { label: "Sécurisation 17,2 %", value: coverage172 === null ? "—" : `${Math.round(coverage172)}%`, icon: Shield, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300", detail: "Part de la dette à 17,2 %, TVA incluse, couverte par la trésorerie" }
  ];
  return (
    <section aria-label="Indicateurs financiers" aria-busy={!ready} className="mb-4">
      <dl className="grid grid-cols-2 gap-1.5">
        {indicators.map(({ label, value, icon: Icon, color, detail }) => (
          <div key={label} title={detail} className="flex min-w-0 items-center gap-2 rounded-xl border border-ink-900/5 bg-white/70 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <dt className="text-[10px] font-medium text-ink-500 dark:text-white/55">{label}</dt>
              <dd className="mt-0.5 whitespace-nowrap font-display text-base font-medium tracking-tight tabular-nums text-ink-900 dark:text-white">{ready ? value : "—"}</dd>
              <span className="sr-only">{detail}</span>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

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
  trend,
  ytdFactureHtEur
}: {
  projection: YearEndProjection;
  formatEuro: (n: number) => string;
  formatInt: (n: number) => number;
  trend?: KpiTrend | null;
  ytdFactureHtEur: number;
}) {
  return (
    <div className={dashboardInsightCard}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-500 dark:text-white/50">Projection fin d&apos;année</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
              {formatEuro(projection.projectedRevenueHtEur)}
              <span className="ml-1.5 text-sm font-medium text-ink-500 dark:text-white/45">HT</span>
            </p>
            <KpiTrendBadge trend={trend} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-ink-500 dark:text-white/45">CA facturé</p>
          <p className="mt-0.5 font-display text-base font-semibold tabular-nums text-ink-900 dark:text-white">
            {formatEuro(ytdFactureHtEur)}
            <span className="ml-1 text-xs font-medium text-ink-500 dark:text-white/45">HT</span>
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500 dark:text-white/45">Prévision au {projection.forecastDateLabel}</p>
        <ConfidenceBadge projection={projection} />
      </div>
      <YearEndProjectionChart
        series={projection.monthlySeries}
        currentMonthKey={projection.currentMonthKey}
        year={projection.year}
        ariaLabel={`Projection du chiffre d'affaires HT mois par mois jusqu'au ${projection.forecastDateLabel}`}
      />
      <p className="mt-2 text-xs text-ink-400 dark:text-white/35">
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

  const hiwayInvoices = useHiwayInvoicesOptional()?.invoices ?? null;

  const ytdInvoicing = useMemo(
    () =>
      computeYearToDateInvoicingTotals(
        transactions,
        new Set(billable.sortedIsos),
        billable.billableRatePeriods,
        billable.tjmHt,
        new Date(),
        hiwayInvoices
      ),
    [
      billable.billableRatePeriods,
      billable.sortedIsos,
      billable.tjmHt,
      transactions,
      hiwayInvoices
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

        <DashboardIndicators stats={stats} ready={statsReady} formatEuro={fmt.euro} invoicedRevenueHtEur={ytdInvoicing.factureHtEur} />

        <YearEndProjectionCard
            projection={yearEndProjection}
            formatEuro={fmt.euro}
            formatInt={fmt.int}
            trend={projectionTrend}
            ytdFactureHtEur={ytdInvoicing.factureHtEur}
          />
      </div>
    </header>
  );
}
