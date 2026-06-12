"use client";

import { useMemo, type ReactNode } from "react";
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
import { RevenueAllocationChart } from "@/components/dashboard/RevenueAllocationChart";
import { TaxLiabilityCard } from "@/components/dashboard/TaxLiabilityCard";
import { dashboardDenseKpiGrid, dashboardFlatHero, dashboardFlatKpi, dashboardSectionTitle } from "@/lib/dashboard-surfaces";

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
  columns: 1 | 2 | 3 | 4;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className={dashboardSectionTitle}>{title}</h2>
      <div
        className={clsx(
          columns === 1 ? "grid grid-cols-1" : dashboardDenseKpiGrid(columns as 2 | 3 | 4)
        )}
      >
        {children}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  href,
  ariaLabel,
  trend,
  children
}: {
  label: string;
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
        dashboardFlatKpi,
        interactive &&
          "cursor-pointer transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300/60 dark:focus-visible:ring-white/20"
      )}
      aria-label={interactive ? ariaLabel : undefined}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
          {label}
        </p>
        <KpiTrendBadge trend={trend} />
      </div>
      <div className="mt-2 flex flex-1 flex-col justify-between gap-1.5">{children}</div>
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

function AvantIrBreakdown({
  totalEur,
  bncEur,
  fraisPersoEur,
  billedDays,
  netPerDayEur,
  remainingHtEur,
  usesRevenueProration,
  formatEuro,
  formatInt
}: {
  totalEur: number;
  bncEur: number;
  fraisPersoEur: number;
  billedDays: number;
  netPerDayEur: number;
  remainingHtEur: number;
  usesRevenueProration: boolean;
  formatEuro: (n: number) => string;
  formatInt: (n: number) => number;
}) {
  const rows = [
    { label: "BNC (honoraires)", value: bncEur },
    { label: "Frais perso récupérés", value: fraisPersoEur }
  ];

  return (
    <div className="space-y-2.5">
      <p className="font-display text-xl font-semibold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
        {formatEuro(totalEur)}
      </p>

      <div className="border-t border-ink-200/50 pt-2.5 dark:border-cyan-100/[0.08]">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-500 dark:text-white/42">
          Détail du calcul
        </p>
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 text-[11px] font-semibold">
              <span className="text-ink-600 dark:text-white/60">{row.label}</span>
              <span className="tabular-nums text-ink-900 dark:text-white">{formatEuro(row.value)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink-200/50 pt-2 text-[11px] font-bold dark:border-cyan-100/[0.08]">
          <span className="text-ink-700 dark:text-white/75">= Avant IR</span>
          <span className="tabular-nums text-ink-900 dark:text-white">{formatEuro(totalEur)}</span>
        </div>
        <p className="mt-2 text-[10px] font-medium leading-relaxed text-ink-500 dark:text-white/42">
          {formatInt(billedDays)} j. facturés × {formatEuro(netPerDayEur)}/j
          {usesRevenueProration
            ? " · prorata sur la répartition Valeur réelle du mois"
            : " · estimation au TJM HT"}
        </p>
      </div>

      <p className="text-[11px] font-bold text-ink-500 dark:text-white/40">
        Reste à produire {formatEuro(remainingHtEur)} HT
      </p>
    </div>
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
  const denominator = Math.max(total, 1);
  const billedPct = Math.round((billed / denominator) * 100);
  const plannedPct = Math.max(0, 100 - billedPct);

  const segments = [
    {
      id: "billed",
      label: "Facturé",
      value: billed,
      pct: billedPct,
      barClass: "bg-teal-500 dark:bg-teal-400",
      valueClass: "text-ink-700 dark:text-white/75"
    },
    {
      id: "planned",
      label: "Prévu",
      value: planned,
      pct: plannedPct,
      barClass: "bg-ink-300 dark:bg-white/25",
      valueClass: "text-ink-500 dark:text-white/50"
    }
  ] as const;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-bold leading-none tabular-nums tracking-tight text-ink-900 dark:text-white">
          {formatInt(billed)}
          <span className="ml-1 text-base font-semibold text-ink-400 dark:text-white/35">
            / {formatInt(total)} j.
          </span>
        </p>
        <p className="text-sm font-bold tabular-nums text-ink-600 dark:text-white/65">
          {formatInt(billedPct)}%
        </p>
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-ink-100/70 dark:bg-white/[0.05]"
        role="img"
        aria-label={`${formatInt(billed)} jours facturés sur ${formatInt(total)}, ${formatInt(billedPct)} %`}
      >
        {segments.map((segment) =>
          segment.pct > 0 ? (
            <div
              key={segment.id}
              className={clsx("h-full rounded-full transition-[width] duration-500", segment.barClass)}
              style={{ width: `${segment.pct}%` }}
            />
          ) : null
        )}
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-semibold tabular-nums">
        {segments.map((segment) => (
          <span key={`chip-${segment.id}`} className={segment.valueClass}>
            {segment.label} {formatInt(segment.value)} j.
          </span>
        ))}
        <span className="text-ink-500 dark:text-white/45">Total {formatInt(total)} j.</span>
      </p>
    </div>
  );
}

function ConfidenceBadge({ projection }: { projection: YearEndProjection }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-ink-200/80 bg-ink-50/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/60"
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
    <KpiCard label="Projection fin d'année" trend={trend}>
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
            className="min-h-[4.5rem] border-l border-ink-200/40 py-1 pl-2.5 first:border-l-0 dark:border-cyan-100/[0.07]"
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

  const avantIrDetail = useMemo(() => {
    const caHtMonth = stats.caMensuelEur > 0 ? stats.caMensuelEur / 1.2 : 0;
    const billedDaysInRevenue = activeTjmHt > 0 ? caHtMonth / activeTjmHt : 0;
    const usesRevenueProration = billedDaysInRevenue > 0 && billedDaysToDate > 0;
    const proration = usesRevenueProration ? billedDaysToDate / billedDaysInRevenue : 0;

    const bncMois = stats.tjmRepartitionMois.bncEur;
    const fraisPersoMois = stats.tjmRepartitionMois.fraisPersoEur;
    const netMois = stats.netDansMaPocheMoisEur;

    let totalEur = 0;
    let bncEur = 0;
    let fraisPersoEur = 0;
    let netPerDayEur = 0;

    if (billedDaysToDate <= 0) {
      return {
        totalEur,
        bncEur,
        fraisPersoEur,
        billedDays: billedDaysToDate,
        netPerDayEur,
        usesRevenueProration: false
      };
    }

    if (usesRevenueProration) {
      bncEur = bncMois * proration;
      fraisPersoEur = fraisPersoMois * proration;
      totalEur = netMois * proration;
      netPerDayEur = netMois / billedDaysInRevenue;
    } else {
      netPerDayEur = activeTjmHt;
      totalEur = activeTjmHt * billedDaysToDate;
      const shareDenom = Math.max(bncMois + fraisPersoMois, 1);
      bncEur = totalEur * (bncMois / shareDenom);
      fraisPersoEur = totalEur * (fraisPersoMois / shareDenom);
    }

    return {
      totalEur,
      bncEur,
      fraisPersoEur,
      billedDays: billedDaysToDate,
      netPerDayEur,
      usesRevenueProration
    };
  }, [
    activeTjmHt,
    billedDaysToDate,
    stats.caMensuelEur,
    stats.netDansMaPocheMoisEur,
    stats.tjmRepartitionMois.bncEur,
    stats.tjmRepartitionMois.fraisPersoEur
  ]);

  const inPocketToDateEur = avantIrDetail.totalEur;

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
    <header className={dashboardFlatHero} suppressHydrationWarning>
      <div suppressHydrationWarning>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-500 dark:text-white/45">
          DigitPro Monitoring
        </p>
        {showContextBanner ? (
          <p className="mt-4 max-w-2xl border-l-2 border-amber-400/80 py-1 pl-4 text-sm text-amber-950 dark:border-amber-400/50 dark:text-amber-50">
            {contextMessage}
          </p>
        ) : null}
        <h1
          suppressHydrationWarning
          className="mt-3 max-w-3xl text-balance font-display text-2xl font-semibold leading-[1.08] tracking-apple-tight text-ink-900 dark:text-white sm:text-3xl md:text-4xl"
        >
          Pilotage finances, trésorerie et chiffre d&apos;affaires en temps réel.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink-600 dark:text-white/55 sm:text-base">
          SASU · LMNP · Cashflow · Fiscalité
        </p>

        <div className="mt-6 space-y-5">
          <KpiSection title="Trésorerie & activité" columns={4}>
            <KpiCard label="Cash disponible" trend={kpiTrends?.cash}>
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

            <KpiCard
              label="Jours du mois"
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

          <KpiSection title="Fiscalité & objectifs" columns={3}>
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

            <KpiCard label="Avant IR" trend={kpiTrends?.avantIr}>
              <AvantIrBreakdown
                totalEur={avantIrDetail.totalEur}
                bncEur={avantIrDetail.bncEur}
                fraisPersoEur={avantIrDetail.fraisPersoEur}
                billedDays={avantIrDetail.billedDays}
                netPerDayEur={avantIrDetail.netPerDayEur}
                remainingHtEur={activeTjmHt * remainingBillableDays}
                usesRevenueProration={avantIrDetail.usesRevenueProration}
                formatEuro={fmt.euro}
                formatInt={fmt.int}
              />
            </KpiCard>

            <AnnualObjectiveCard
              achievedHtEur={stats.caAnnuelEncaisseHtEur}
              trend={kpiTrends?.annual}
            />
          </KpiSection>

          <KpiSection title="Répartition & projection" columns={2}>
            <RevenueAllocationChart
              allocation={stats.tjmRepartitionMois}
              formatEuro={fmt.euro}
              formatInt={fmt.int}
              trend={kpiTrends?.revenueAllocation}
            />

            <YearEndProjectionCard
              projection={yearEndProjection}
              formatEuro={fmt.euro}
              formatInt={fmt.int}
              trend={kpiTrends?.projection}
            />
          </KpiSection>
        </div>

        <p className="mt-5 text-xs text-ink-400 dark:text-white/30">by Iliass KHOMSI</p>
      </div>
    </header>
  );
}
