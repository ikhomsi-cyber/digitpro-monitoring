"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarDays, LineChart, PiggyBank, TrendingUp, WalletCards } from "lucide-react";
import { clsx } from "clsx";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { resolveBillableTjmForClientMonth } from "@/lib/billable-client-days";
import { computeTjmWorkdayGauge, countAgendaWorkDaysInMonth } from "@/lib/billable-calendar-metrics";
import { computeYearEndProjection, type YearEndProjection } from "@/lib/year-end-projection";
import { computeKpiTrend, type KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { AnnualObjectiveCard } from "@/components/dashboard/AnnualObjectiveCard";
import { FinancialWaterfallChart } from "@/components/dashboard/FinancialWaterfallChart";
import { RevenueAllocationChart } from "@/components/dashboard/RevenueAllocationChart";
import { TaxLiabilityCard } from "@/components/dashboard/TaxLiabilityCard";

type Props = {
  stats: DashboardHeroStats;
  statsReady: boolean;
  contextMessage: string;
  showContextBanner: boolean;
};

type SublabelTone = "positive" | "negative" | "neutral" | "warning";

function navigateTo(href: string) {
  if (href.startsWith("/dashboard")) {
    window.history.pushState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } else {
    window.location.assign(href);
  }
}

function KpiSection({
  title,
  children,
  columns
}: {
  title: string;
  children: ReactNode;
  columns: "1" | "2" | "3";
}) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-ink-200/70 pb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-600 dark:border-cyan-100/[0.12] dark:text-emerald-300/85">
        {title}
      </h2>
      <div
        className={clsx(
          "grid items-stretch gap-3 sm:gap-4",
          columns === "1"
            ? "grid-cols-1"
            : columns === "2"
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-3"
        )}
      >
        {children}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  icon: Icon,
  iconClassName,
  href,
  ariaLabel,
  trend,
  children
}: {
  label: string;
  icon: typeof TrendingUp;
  iconClassName: string;
  href?: string;
  ariaLabel?: string;
  trend?: KpiTrend | null;
  children: ReactNode;
}) {
  const interactive = Boolean(href);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={href ? () => navigateTo(href) : undefined}
      onKeyDown={
        href
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              navigateTo(href);
            }
          : undefined
      }
      className={clsx(
        "flex h-full min-h-[8.75rem] flex-col rounded-2xl border border-ink-200/80 bg-white/75 px-4 py-4 text-left shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none",
        interactive &&
          "cursor-pointer transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:border-emerald-400/25 dark:hover:bg-white/[0.07]"
      )}
      aria-label={interactive ? ariaLabel : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
            {label}
          </p>
          <KpiTrendBadge trend={trend} />
        </div>
        <span
          className={clsx(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
            iconClassName
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-between gap-2">{children}</div>
    </div>
  );
}

function KpiValue({
  value,
  suffix,
  sublabel,
  sublabelValue,
  sublabelTone = "neutral"
}: {
  value: string;
  suffix?: string;
  sublabel?: string;
  sublabelValue?: string;
  sublabelTone?: SublabelTone;
}) {
  return (
    <>
      <p className="font-display text-xl font-semibold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
        {value}
        {suffix ? (
          <span className="ml-1.5 align-baseline text-xs font-semibold tracking-normal text-ink-500 dark:text-white/45">
            {suffix}
          </span>
        ) : null}
      </p>
      {sublabel ? (
        <p
          className={clsx(
            "flex items-center justify-between gap-1.5 text-[11px] font-bold leading-tight",
            sublabelTone === "positive"
              ? "text-emerald-700 dark:text-emerald-300"
              : sublabelTone === "negative"
                ? "text-rose-700 dark:text-rose-300"
                : sublabelTone === "warning"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-ink-500 dark:text-white/40"
          )}
        >
          <span className="min-w-0 truncate">{sublabel}</span>
          {sublabelValue ? <span className="shrink-0 tabular-nums">{sublabelValue}</span> : null}
        </p>
      ) : null}
    </>
  );
}

function WorkdaysSummary({
  billed,
  planned,
  formatInt
}: {
  billed: number;
  planned: number;
  formatInt: (n: number) => number;
}) {
  const total = billed + planned;

  return (
    <dl className="space-y-1.5 rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2.5 dark:border-violet-300/15 dark:bg-violet-400/[0.05]">
      {[
        { label: "Facturé", value: billed },
        { label: "Prévu", value: planned },
        { label: "Total", value: total }
      ].map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 text-[11px] font-bold">
          <dt className="text-ink-500 dark:text-white/45">{row.label}</dt>
          <dd className="tabular-nums text-ink-900 dark:text-white">{formatInt(row.value)} j.</dd>
        </div>
      ))}
    </dl>
  );
}

function ConfidenceBadge({ projection }: { projection: YearEndProjection }) {
  const tone =
    projection.confidence.level === "high"
      ? "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200"
      : projection.confidence.level === "medium"
        ? "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100"
        : "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        tone
      )}
    >
      Confiance {projection.confidence.label}
      <span className="tabular-nums opacity-80">{projection.confidence.score}%</span>
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
    { label: "CA projeté", value: formatEuro(projection.projectedRevenueHtEur), suffix: "HT" },
    { label: "Revenu perso", value: formatEuro(projection.projectedPersonalIncomeEur) },
    { label: "CSG projetée", value: formatEuro(projection.projectedCsgEur) },
    { label: "Trésorerie", value: formatEuro(projection.projectedCashEur) }
  ];

  return (
    <KpiCard
      label="Projection fin d'année"
      icon={LineChart}
      iconClassName="text-indigo-600 bg-indigo-50 border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-500/12 dark:border-indigo-300/20"
      trend={trend}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-ink-600 dark:text-white/55">
          Prévision au {projection.forecastDateLabel}
        </p>
        <ConfidenceBadge projection={projection} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="min-h-[4.5rem] rounded-xl border border-ink-200/70 bg-white/55 px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <dt className="text-[9px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
              {row.label}
            </dt>
            <dd className="mt-1 font-display text-sm font-bold tabular-nums text-ink-900 dark:text-white sm:text-base">
              {row.value}
              {row.suffix ? (
                <span className="ml-1 text-[10px] font-semibold text-ink-500 dark:text-white/45">
                  {row.suffix}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[10px] leading-relaxed text-ink-500 dark:text-white/40">
        {projection.detail.basisLabel} · {formatInt(projection.detail.remainingCapacityDays)} j. restants sur{" "}
        {formatInt(projection.detail.totalCapacityDays)} j. planifiés
      </p>
    </KpiCard>
  );
}

export function DashboardPremiumHero({ stats, statsReady, contextMessage, showContextBanner }: Props) {
  const fmt = useDashboardDisplayFormat();
  const billable = useBillableActivity();
  const billedDaysToDate = billable.overviewWorkdayGauge.countedBillable;
  const remainingBillableDays = billable.overviewWorkdayGauge.remainingBillable;

  const activeTjmHt = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return resolveBillableTjmForClientMonth(
      billable.billableRatePeriods,
      billable.billableRatePeriods[0]?.clientName ?? "",
      monthKey,
      billable.tjmHt
    );
  }, [billable.billableRatePeriods, billable.tjmHt]);

  const inPocketToDateEur = useMemo(() => {
    const caHtMonth = stats.caMensuelEur > 0 ? stats.caMensuelEur / 1.2 : 0;
    const billedDaysInRevenue = activeTjmHt > 0 ? caHtMonth / activeTjmHt : 0;
    if (billedDaysToDate <= 0) return 0;
    if (billedDaysInRevenue > 0) {
      return (stats.netDansMaPocheMoisEur / billedDaysInRevenue) * billedDaysToDate;
    }
    return activeTjmHt * billedDaysToDate;
  }, [activeTjmHt, billedDaysToDate, stats.caMensuelEur, stats.netDansMaPocheMoisEur]);

  const remunerationDisponibleEur = (stats.soldeQontoEur ?? 0) - stats.detteTotaleDepuisDebutEur;
  const realTjmBeforeIncomeTaxEur = billedDaysToDate > 0 ? inPocketToDateEur / billedDaysToDate : 0;
  const realTjmSharePct = activeTjmHt > 0 ? Math.round((realTjmBeforeIncomeTaxEur / activeTjmHt) * 100) : 0;

  const invoicesToCollect = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth =
      now.getMonth() === 0
        ? { year: now.getFullYear() - 1, month0: 11 }
        : { year: now.getFullYear(), month0: now.getMonth() - 1 };
    const invoiceIssueDate = new Date(lastMonth.year, lastMonth.month0 + 1, 1);
    const invoiceDueDate = new Date(invoiceIssueDate);
    invoiceDueDate.setDate(invoiceDueDate.getDate() + 30);
    const dueInDays = Math.ceil((invoiceDueDate.getTime() - now.getTime()) / 86_400_000);
    const chartTjmHt = resolveBillableTjmForClientMonth(
      billable.billableRatePeriods,
      billable.billableRatePeriods[0]?.clientName ?? "",
      currentMonthKey,
      billable.tjmHt
    );
    const daysAlreadyInvoiced = countAgendaWorkDaysInMonth(
      billable.selected,
      lastMonth.year,
      lastMonth.month0,
      now
    );
    return {
      amountHtEur: Math.round(daysAlreadyInvoiced * chartTjmHt * 100) / 100,
      dueInDays,
      statusLabel:
        dueInDays >= 0
          ? `À venir J-${Math.ceil(dueInDays)}`
          : `Retard de ${Math.abs(Math.floor(dueInDays))} j.`
    };
  }, [billable.billableRatePeriods, billable.selected, billable.tjmHt]);

  const kpiTrends = useMemo(() => {
    if (!statsReady || !stats.momKpis) {
      return null;
    }

    const mom = stats.momKpis;
    const prevYear = Number(mom.previousMonthKey.slice(0, 4));
    const prevMonth0 = Number(mom.previousMonthKey.slice(5, 7)) - 1;
    const prevMonthEnd = new Date(prevYear, prevMonth0 + 1, 0);
    const prevWorkdayGauge = computeTjmWorkdayGauge(
      billable.selected,
      prevYear,
      prevMonth0,
      prevMonthEnd
    );
    const prevTjmHt = resolveBillableTjmForClientMonth(
      billable.billableRatePeriods,
      billable.billableRatePeriods[0]?.clientName ?? "",
      mom.previousMonthKey,
      billable.tjmHt
    );

    const ytd = stats.ytdMonthly;
    const currentMonthHt = ytd[ytd.length - 1]?.revenueHtEur ?? stats.tjmRepartitionMois.caHtEur;
    const previousMonthHt =
      ytd.length >= 2 ? ytd[ytd.length - 2]!.revenueHtEur : mom.tjmRepartitionMois.caHtEur;

    return {
      cash:
        stats.soldeQontoEur != null && mom.soldeQontoApproxEur != null
          ? computeKpiTrend(stats.soldeQontoEur, mom.soldeQontoApproxEur)
          : null,
      encaisse: computeKpiTrend(stats.caMensuelEur, mom.caMensuelEur),
      tax: computeKpiTrend(stats.detteTotaleDepuisDebutEur, mom.detteTotaleDepuisDebutEur, {
        positiveIsGood: false
      }),
      workdays: computeKpiTrend(billedDaysToDate, prevWorkdayGauge.countedBillable),
      tjm: computeKpiTrend(activeTjmHt, prevTjmHt),
      avantIr: computeKpiTrend(stats.netDansMaPocheMoisEur, mom.netDansMaPocheMoisEur),
      revenueAllocation: computeKpiTrend(
        stats.tjmRepartitionMois.caHtEur,
        mom.tjmRepartitionMois.caHtEur
      ),
      waterfall: computeKpiTrend(stats.caMensuelEur, mom.caMensuelEur),
      annual: computeKpiTrend(currentMonthHt, previousMonthHt),
      projection: computeKpiTrend(currentMonthHt, previousMonthHt)
    };
  }, [
    activeTjmHt,
    billable.billableRatePeriods,
    billable.selected,
    billable.tjmHt,
    billedDaysToDate,
    stats,
    statsReady
  ]);

  const yearEndProjection = useMemo(
    () =>
      computeYearEndProjection({
        selectedWorkDayIsos: billable.sortedIsos,
        billableRatePeriods: billable.billableRatePeriods,
        fallbackTjmHt: billable.tjmHt,
        tjmRepartition: stats.tjmRepartitionMois,
        soldeQontoEur: stats.soldeQontoEur,
        detteTotaleEur: stats.detteTotaleDepuisDebutEur,
        statsReady
      }),
    [
      billable.billableRatePeriods,
      billable.sortedIsos,
      billable.tjmHt,
      stats.detteTotaleDepuisDebutEur,
      stats.soldeQontoEur,
      stats.tjmRepartitionMois,
      statsReady
    ]
  );

  return (
    <header className="relative mx-auto mt-6 w-full overflow-hidden rounded-[2rem] border border-ink-200/80 bg-gradient-to-b from-white via-white to-ink-50/80 px-5 py-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.15)] dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_32px_100px_-20px_rgba(0,22,28,0.78),inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-8 sm:py-10">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/15"
        aria-hidden
      />

      <div className="relative" suppressHydrationWarning>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-500 dark:text-emerald-300/80">
          DigitPro Monitoring
        </p>
        {showContextBanner ? (
          <p className="mt-4 max-w-2xl rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50">
            {contextMessage}
          </p>
        ) : null}
        <h1
          suppressHydrationWarning
          className="mt-4 max-w-3xl text-balance font-display text-3xl font-semibold leading-[1.08] tracking-apple-tight text-ink-900 dark:text-white sm:text-4xl md:text-[2.65rem]"
        >
          Pilotage finances, trésorerie et chiffre d&apos;affaires en temps réel.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink-600 dark:text-white/55 sm:text-base">
          SASU · LMNP · Cashflow · Fiscalité
        </p>

        <div className="mt-10 space-y-8">
          <KpiSection title="Cash" columns="2">
            <KpiCard
              label="Cash disponible"
              icon={WalletCards}
              iconClassName="text-sky-600 bg-sky-50 border-sky-200/80 dark:text-sky-300 dark:bg-sky-500/12 dark:border-sky-400/20"
              trend={kpiTrends?.cash}
            >
              <KpiValue
                value={stats.soldeQontoEur != null ? fmt.euro(stats.soldeQontoEur) : "—"}
                sublabel={
                  statsReady
                    ? remunerationDisponibleEur >= 0
                      ? "Rémunération à verser"
                      : "Dette nette"
                    : undefined
                }
                sublabelValue={statsReady ? fmt.euro(Math.abs(remunerationDisponibleEur)) : undefined}
                sublabelTone={remunerationDisponibleEur >= 0 ? "positive" : "negative"}
              />
            </KpiCard>

            <KpiCard
              label="Encaissé ce mois"
              icon={TrendingUp}
              iconClassName="text-emerald-600 bg-emerald-50 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/12 dark:border-emerald-400/20"
              href="/dashboard?section=sasu&scope=pro"
              ariaLabel="Ouvrir la page SASU"
              trend={kpiTrends?.encaisse}
            >
              <KpiValue
                value={fmt.euro(stats.caMensuelEur)}
                suffix="TTC"
                sublabel={`${invoicesToCollect.statusLabel} · ${fmt.euro(invoicesToCollect.amountHtEur * 1.2)} TTC`}
                sublabelTone={
                  invoicesToCollect.amountHtEur <= 0
                    ? "positive"
                    : invoicesToCollect.dueInDays < 0
                      ? "negative"
                      : "warning"
                }
              />
            </KpiCard>

            <div className="sm:col-span-2">
              <TaxLiabilityCard
                cashEur={stats.soldeQontoEur}
                vatEur={stats.detteTvaDepuisDebutEur}
                csgEur={stats.detteCsgDepuisDebutEur}
                totalLiabilityEur={stats.detteTotaleDepuisDebutEur}
                statsReady={statsReady}
                formatEuro={fmt.euro}
                formatInt={fmt.int}
                trend={kpiTrends?.tax}
              />
            </div>
          </KpiSection>

          <KpiSection title="Activité" columns="2">
            <KpiCard
              label="Jours du mois"
              icon={CalendarDays}
              iconClassName="text-violet-600 bg-violet-50 border-violet-200/80 dark:text-violet-300 dark:bg-violet-500/12 dark:border-violet-300/20"
              href="/dashboard?section=activite"
              ariaLabel="Ouvrir la page Activité"
              trend={kpiTrends?.workdays}
            >
              <WorkdaysSummary
                billed={billedDaysToDate}
                planned={remainingBillableDays}
                formatInt={fmt.int}
              />
            </KpiCard>

            <KpiCard
              label="TJM"
              icon={CalendarDays}
              iconClassName="text-indigo-600 bg-indigo-50 border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-500/12 dark:border-indigo-300/20"
              href="/parametres"
              ariaLabel="Ouvrir le paramétrage des TJM"
              trend={kpiTrends?.tjm}
            >
              <KpiValue
                value={fmt.euro(activeTjmHt)}
                suffix="HT"
                sublabel={`Réel ${fmt.euro(realTjmBeforeIncomeTaxEur)}/j · ${fmt.int(realTjmSharePct)} %`}
                sublabelTone="positive"
              />
            </KpiCard>
          </KpiSection>

          <KpiSection title="Résultat" columns="2">
            <KpiCard
              label="Avant IR"
              icon={PiggyBank}
              iconClassName="text-amber-600 bg-amber-50 border-amber-200/80 dark:text-amber-300 dark:bg-amber-500/12 dark:border-amber-300/20"
              trend={kpiTrends?.avantIr}
            >
              <KpiValue
                value={fmt.euro(inPocketToDateEur)}
                sublabel={`Reste à produire ${fmt.euro(activeTjmHt * remainingBillableDays)} HT`}
                sublabelTone="neutral"
              />
            </KpiCard>

            <div className="sm:col-span-2">
              <RevenueAllocationChart
                allocation={stats.tjmRepartitionMois}
                formatEuro={fmt.euro}
                formatInt={fmt.int}
                trend={kpiTrends?.revenueAllocation}
              />
            </div>

            <div className="sm:col-span-2">
              <FinancialWaterfallChart
                stats={stats}
                statsReady={statsReady}
                formatEuro={fmt.euro}
                trend={kpiTrends?.waterfall}
              />
            </div>
          </KpiSection>

          <KpiSection title="Objectif annuel" columns="1">
            <AnnualObjectiveCard
              achievedHtEur={stats.caAnnuelEncaisseHtEur}
              trend={kpiTrends?.annual}
            />
          </KpiSection>

          <KpiSection title="Projection" columns="1">
            <YearEndProjectionCard
              projection={yearEndProjection}
              formatEuro={fmt.euro}
              formatInt={fmt.int}
              trend={kpiTrends?.projection}
            />
          </KpiSection>
        </div>

        <p className="mt-8 text-xs text-ink-400 dark:text-white/30">by Iliass KHOMSI</p>
      </div>
    </header>
  );
}
