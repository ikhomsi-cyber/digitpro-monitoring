"use client";

import { useMemo } from "react";
import { BriefcaseBusiness, CalendarCheck2, Landmark, PiggyBank, TrendingUp, WalletCards } from "lucide-react";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { resolveBillableTjmForClientMonth } from "@/lib/billable-client-days";
import { countAgendaWorkDaysInMonth } from "@/lib/billable-calendar-metrics";
import { DEFAULT_IR_ON_BNC_RATE } from "@/lib/valeur-reelle-analyze";

type Props = {
  stats: DashboardHeroStats;
  statsReady: boolean;
  /** Bandeau contexte (démo / préférence démo). */
  contextMessage: string;
  showContextBanner: boolean;
};

type TileMetric = {
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative" | "neutral";
};

type YtdTrendPoint = {
  key: string;
  label: string;
  generatedHtEur: number;
  collectedHtEur: number;
  expensesEur: number;
  billedDays: number;
};

type Tile = {
  label: string;
  value: string;
  suffix?: string;
  sublabel?: string;
  sublabelTone?: "positive" | "negative" | "neutral";
  metrics?: TileMetric[];
  icon: typeof TrendingUp;
  iconClassName: string;
  href?: string;
  ariaLabel?: string;
  wide?: boolean;
  breakdown?: Array<{ label: string; value: number; colorClass: string }>;
  trend?: YtdTrendPoint[];
  tjmGauge?: {
    globalTjmEur: number;
    realBeforeIrEur: number;
    estimatedIrEur: number;
    sharePct: number;
  };
};

export function DashboardPremiumHero({ stats, statsReady, contextMessage, showContextBanner }: Props) {
  const fmt = useDashboardDisplayFormat();
  const billable = useBillableActivity();
  const billedDaysToDate = billable.overviewWorkdayGauge.countedBillable;
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
  const billedDaysLabel = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(billedDaysToDate);
  const remunerationDisponibleEur = (stats.soldeQontoEur ?? 0) - stats.detteTotaleDepuisDebutEur;
  const realTjmBeforeIncomeTaxEur = billedDaysToDate > 0 ? inPocketToDateEur / billedDaysToDate : 0;
  const realTjmSharePct =
    activeTjmHt > 0 ? Math.round((realTjmBeforeIncomeTaxEur / activeTjmHt) * 100) : 0;
  const estimatedIncomeTaxPerDayEur = Math.max(0, realTjmBeforeIncomeTaxEur * DEFAULT_IR_ON_BNC_RATE);
  const yearToDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const todayIso = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const monthly = new Map<string, { generatedHtEur: number; billedDays: number }>();
    let billedDays = 0;
    let generatedHt = 0;

    for (let month0 = 0; month0 <= now.getMonth(); month0 += 1) {
      const key = `${year}-${String(month0 + 1).padStart(2, "0")}`;
      monthly.set(key, { generatedHtEur: 0, billedDays: 0 });
    }

    for (const iso of billable.sortedIsos) {
      if (!iso.startsWith(`${year}-`)) continue;
      if (iso > todayIso) continue;
      billedDays += 1;
      const monthKey = iso.slice(0, 7);
      const amount = resolveBillableTjmForClientMonth(
        billable.billableRatePeriods,
        billable.billableRatePeriods[0]?.clientName ?? "",
        monthKey,
        billable.tjmHt
      );
      generatedHt += amount;
      const current = monthly.get(monthKey) ?? { generatedHtEur: 0, billedDays: 0 };
      monthly.set(monthKey, {
        generatedHtEur: current.generatedHtEur + amount,
        billedDays: current.billedDays + 1
      });
    }
    const statMonths = new Map(stats.ytdMonthly.map((month) => [month.month, month]));
    return {
      year,
      billedDays,
      generatedHt: Math.round(generatedHt * 100) / 100,
      monthly: [...monthly.entries()].map(([key, values]) => ({
        key,
        label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
          new Date(year, Number(key.slice(5, 7)) - 1, 1)
        ),
        generatedHtEur: Math.round(values.generatedHtEur * 100) / 100,
        collectedHtEur: statMonths.get(key)?.revenueHtEur ?? 0,
        expensesEur: statMonths.get(key)?.expensesEur ?? 0,
        billedDays: values.billedDays
      }))
    };
  }, [billable.billableRatePeriods, billable.sortedIsos, billable.tjmHt, stats.ytdMonthly]);
  const invoicesToCollect = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = now.getMonth() === 0
      ? { year: now.getFullYear() - 1, month0: 11 }
      : { year: now.getFullYear(), month0: now.getMonth() - 1 };
    const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(
      new Date(lastMonth.year, lastMonth.month0, 1)
    );
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
      days: daysAlreadyInvoiced,
      monthLabel
    };
  }, [billable.billableRatePeriods, billable.selected, billable.tjmHt]);

  const tiles: Tile[] = useMemo(
    () => [
      {
        label: "Encaissé ce mois",
        value: fmt.euro(stats.caMensuelEur),
        suffix: "TTC",
        icon: TrendingUp,
        iconClassName: "text-emerald-300 bg-emerald-500/12 border-emerald-400/20",
        href: "/dashboard?section=sasu&scope=pro",
        ariaLabel: "Ouvrir la page SASU"
      },
      {
        label: "Cash disponible",
        value: stats.soldeQontoEur != null ? fmt.euro(stats.soldeQontoEur) : "—",
        sublabel: statsReady ? `Rémunération à verser ${fmt.euro(remunerationDisponibleEur)}` : undefined,
        sublabelTone: remunerationDisponibleEur >= 0 ? "positive" : "negative",
        icon: WalletCards,
        iconClassName: "text-sky-300 bg-sky-500/12 border-sky-400/20"
      },
      {
        label: "Avant IR (mois en cours)",
        value: fmt.euro(inPocketToDateEur),
        sublabel: `${billedDaysLabel} j. facturés à date`,
        icon: PiggyBank,
        iconClassName: "text-amber-200 bg-amber-500/12 border-amber-300/20"
      },
      {
        label: "TJM en vigueur",
        value: fmt.euro(activeTjmHt),
        suffix: "HT",
        tjmGauge: {
          globalTjmEur: activeTjmHt,
          realBeforeIrEur: realTjmBeforeIncomeTaxEur,
          estimatedIrEur: estimatedIncomeTaxPerDayEur,
          sharePct: realTjmSharePct
        },
        icon: CalendarCheck2,
        iconClassName: "text-violet-200 bg-violet-500/12 border-violet-300/20",
        href: "/parametres",
        ariaLabel: "Ouvrir le paramétrage des TJM"
      },
      {
        label: `Depuis janvier ${yearToDate.year}`,
        value: fmt.euro(yearToDate.generatedHt),
        suffix: "HT généré",
        metrics: [
          { label: "Jours facturés", value: `${fmt.int(yearToDate.billedDays)} j.` },
          { label: "Encaissé", value: `${fmt.euro(stats.caAnnuelEncaisseHtEur)} HT`, tone: "positive" },
          {
            label: "À encaisser",
            value: `${fmt.euro(invoicesToCollect.amountHtEur)} HT`,
            detail: `${invoicesToCollect.monthLabel} · ${fmt.int(invoicesToCollect.days)} j.`,
            tone: invoicesToCollect.amountHtEur > 0 ? "negative" : "positive"
          },
          { label: "Dépenses SASU", value: fmt.euro(stats.depensesAnnuelPasseesTtcEur), tone: "negative" }
        ],
        trend: yearToDate.monthly,
        icon: TrendingUp,
        iconClassName: "text-emerald-300 bg-emerald-500/12 border-emerald-400/20",
        href: "/dashboard?section=activite",
        ariaLabel: "Ouvrir la page Activité",
        wide: true
      },
      {
        label: "Dépenses du mois (SASU)",
        value: fmt.euro(stats.depensesQontoSasuMoisEur),
        suffix: "TTC",
        sublabel: `HT ${fmt.euro(stats.depensesQontoSasuMoisHtEur)}`,
        sublabelTone: "neutral",
        icon: BriefcaseBusiness,
        iconClassName: "text-rose-200 bg-rose-500/12 border-rose-300/20",
        href: "/dashboard?panel=valeur-reelle",
        ariaLabel: "Ouvrir la page Valeur",
        wide: true,
        breakdown: [
          { label: "DigitPro", value: stats.depensesDigitProMoisEur, colorClass: "bg-orange-300" },
          { label: "Perso", value: stats.depensesPersoMoisEur, colorClass: "bg-teal-300" }
        ]
      },
      {
        label: "Dettes fiscales",
        value: fmt.euro(stats.detteTotaleDepuisDebutEur),
        icon: Landmark,
        iconClassName: "text-orange-200 bg-orange-500/12 border-orange-300/20",
        href: "/dashboard?panel=valeur-reelle",
        ariaLabel: "Ouvrir la page Valeur pour voir les dettes fiscales",
        wide: true,
        breakdown: [
          { label: "CSG", value: stats.detteCsgDepuisDebutEur, colorClass: "bg-orange-300" },
          { label: "TVA", value: stats.detteTvaDepuisDebutEur, colorClass: "bg-cyan-300" }
        ]
      }
    ],
    [
      activeTjmHt,
      billedDaysLabel,
      fmt,
      inPocketToDateEur,
      invoicesToCollect,
      estimatedIncomeTaxPerDayEur,
      realTjmBeforeIncomeTaxEur,
      realTjmSharePct,
      remunerationDisponibleEur,
      stats,
      statsReady,
      yearToDate
    ]
  );

  const chips = "SASU · LMNP · Cashflow · Fiscalité";

  return (
    <header className="relative mx-auto mt-6 max-w-6xl overflow-hidden rounded-3xl border border-ink-200/80 bg-gradient-to-b from-white via-white to-ink-50/80 px-5 py-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.15)] dark:border-white/[0.07] dark:from-[#0f1412] dark:via-[#0a0d0c] dark:to-[#050505] dark:shadow-[0_32px_100px_-20px_rgba(0,0,0,0.75)] sm:px-8 sm:py-10">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/15"
        aria-hidden
      />

      <div className="relative text-center" suppressHydrationWarning>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-500 dark:text-emerald-300/80">
          DigitPro Monitoring
        </p>
        {showContextBanner ? (
          <p className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50">
            {contextMessage}
          </p>
        ) : null}
        <h1
          suppressHydrationWarning
          className="mx-auto mt-4 max-w-3xl text-balance font-display text-3xl font-semibold leading-[1.08] tracking-apple-tight text-ink-900 dark:text-white sm:text-4xl md:text-[2.65rem]"
        >
          Pilotage finances, trésorerie et chiffre d’affaires en temps réel.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-sm text-ink-600 dark:text-white/55 sm:text-base">
          {chips}
        </p>

        <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:gap-4">
          {tiles.map((t) => {
            const interactive = Boolean(t.href);
            const href = t.href;
            const Icon = t.icon;
            const content = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[11px] font-medium text-ink-500 dark:text-white/45">{t.label}</dt>
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${t.iconClassName}`}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                </div>
                <dd className="mt-1.5 font-display text-lg font-semibold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-xl">
                  {t.value}
                  {t.suffix ? (
                    <span className="ml-1.5 align-baseline text-xs font-semibold tracking-normal text-ink-500 dark:text-white/45">
                      {t.suffix}
                    </span>
                  ) : null}
                </dd>
                {t.sublabel ? (
                  <p
                    className={`mt-1 text-[11px] font-bold ${
                      t.sublabelTone === "positive"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : t.sublabelTone === "negative"
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-ink-500 dark:text-white/40"
                    }`}
                  >
                    {t.sublabel}
                  </p>
                ) : null}
                {t.tjmGauge ? (
                  <div className="mt-3 rounded-xl border border-violet-200/70 bg-violet-50/55 p-2.5 dark:border-violet-400/15 dark:bg-violet-500/[0.06]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                          Décomposition du TJM
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold text-ink-500 dark:text-white/40">
                          Sur {fmt.euro(t.tjmGauge.globalTjmEur)} facturés / jour
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold tabular-nums text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {fmt.int(t.tjmGauge.sharePct)} %
                      </span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink-200/80 dark:bg-white/10">
                      <div
                        className="h-full bg-emerald-400"
                        style={{
                          width: `${Math.max(0, Math.min(100, t.tjmGauge.sharePct))}%`
                        }}
                        aria-hidden
                      />
                      <div
                        className="h-full bg-amber-300"
                        style={{
                          width: `${Math.max(0, Math.min(100, (t.tjmGauge.estimatedIrEur / Math.max(1, t.tjmGauge.globalTjmEur)) * 100))}%`
                        }}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {[
                        {
                          label: "Réel encaissé hors IR",
                          value: `${fmt.euro(t.tjmGauge.realBeforeIrEur)}/j`,
                          dot: "bg-emerald-400",
                          text: "text-emerald-700 dark:text-emerald-300"
                        },
                        {
                          label: "IR estimé à provisionner",
                          value: `${fmt.euro(t.tjmGauge.estimatedIrEur)}/j`,
                          dot: "bg-amber-300",
                          text: "text-amber-700 dark:text-amber-300"
                        },
                        {
                          label: "Écart charges / TVA / arrondis",
                          value: `${fmt.euro(Math.max(0, t.tjmGauge.globalTjmEur - t.tjmGauge.realBeforeIrEur - t.tjmGauge.estimatedIrEur))}/j`,
                          dot: "bg-ink-300 dark:bg-white/20",
                          text: "text-ink-600 dark:text-white/55"
                        }
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-2 rounded-lg bg-white/65 px-2 py-1.5 dark:bg-white/[0.04]">
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-[9px] font-semibold text-ink-500 dark:text-white/40">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                            <span className="truncate">{row.label}</span>
                          </span>
                          <span className={`shrink-0 text-[10px] font-bold tabular-nums ${row.text}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {t.metrics ? (
                  <div className={`mt-3 grid gap-2 ${t.metrics.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                    {t.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="min-w-0 rounded-xl border border-ink-200/70 bg-white/45 px-2.5 py-2 dark:border-white/[0.07] dark:bg-white/[0.025]"
                      >
                        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/35">
                          {metric.label}
                        </p>
                        <p
                          className={`mt-0.5 truncate text-[12px] font-bold tabular-nums ${
                            metric.tone === "positive"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : metric.tone === "negative"
                                ? "text-rose-700 dark:text-rose-300"
                                : "text-ink-900 dark:text-white"
                          }`}
                        >
                          {metric.value}
                        </p>
                        {metric.detail ? (
                          <p className="mt-0.5 truncate text-[9px] font-semibold text-ink-500 dark:text-white/35">
                            {metric.detail}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {t.trend ? (
                  <div className="mt-4 rounded-2xl border border-ink-200/70 bg-gradient-to-b from-white/60 to-ink-50/40 px-3 py-3 dark:border-white/[0.07] dark:from-white/[0.035] dark:to-white/[0.015]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-white/35">
                          Synthèse mensuelle depuis janvier
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold text-ink-500 dark:text-white/40">
                          Généré, encaissé, dépenses et jours
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(() => {
                        const trend = t.trend ?? [];
                        const maxMoney = Math.max(
                          1,
                          ...trend.flatMap((x) => [x.generatedHtEur, x.collectedHtEur, x.expensesEur])
                        );
                        return (
                          <>
                            {trend.map((point) => {
                              const generatedPct = Math.max(0, Math.min(100, (point.generatedHtEur / maxMoney) * 100));
                              const collectedPct = Math.max(0, Math.min(100, (point.collectedHtEur / maxMoney) * 100));
                              const expensesPct = Math.max(0, Math.min(100, (point.expensesEur / maxMoney) * 100));
                              return (
                                <div
                                  key={point.key}
                                  className="rounded-2xl border border-ink-200/60 bg-white/45 px-3 py-2 dark:border-white/[0.06] dark:bg-black/10"
                                >
                                  <div className="grid grid-cols-[3.2rem_1fr] gap-3">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase text-ink-700 dark:text-white/60">{point.label}</p>
                                      <p className="mt-1 text-[10px] font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                                        {fmt.int(point.billedDays)} j.
                                      </p>
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                      {[
                                        { label: "Généré", value: point.generatedHtEur, pct: generatedPct, color: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-300" },
                                        { label: "Encaissé", value: point.collectedHtEur, pct: collectedPct, color: "bg-sky-400", text: "text-sky-700 dark:text-sky-300" },
                                        { label: "Dépenses", value: point.expensesEur, pct: expensesPct, color: "bg-rose-400", text: "text-rose-700 dark:text-rose-300" }
                                      ].map((row) => (
                                        <div key={row.label} className="grid grid-cols-[4.4rem_1fr_4.2rem] items-center gap-2">
                                          <span className="truncate text-[9px] font-semibold text-ink-500 dark:text-white/35">{row.label}</span>
                                          <span className="h-1.5 overflow-hidden rounded-full bg-ink-200/80 dark:bg-white/10">
                                            <span
                                              className={`block h-full rounded-full ${row.color}`}
                                              style={{ width: `${row.pct}%` }}
                                              aria-hidden
                                            />
                                          </span>
                                          <span className={`truncate text-right text-[9px] font-bold tabular-nums ${row.text}`}>
                                            {fmt.chartAxisEuro(row.value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}
                {t.breakdown ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-200/70 dark:bg-white/10">
                      {t.breakdown.map((item) => {
                        const total = t.breakdown?.reduce((sum, x) => sum + Math.max(0, x.value), 0) ?? 0;
                        const pct =
                          total > 0
                            ? Math.max(0, (item.value / total) * 100)
                            : 0;
                        return (
                          <span
                            key={item.label}
                            className={item.colorClass}
                            style={{ width: `${pct}%` }}
                            aria-hidden
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-ink-500 dark:text-white/40">
                      {t.breakdown.map((item) => (
                        <span key={item.label} className="inline-flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${item.colorClass}`} aria-hidden />
                          {item.label} {fmt.euro(item.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            );
            return (
            <div
              key={t.label}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={
                href
                  ? () => {
                      if (href.startsWith("/dashboard")) {
                        window.history.pushState(null, "", href);
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      } else {
                        window.location.assign(href);
                      }
                    }
                  : undefined
              }
              onKeyDown={
                href
                  ? (event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      if (href.startsWith("/dashboard")) {
                        window.history.pushState(null, "", href);
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      } else {
                        window.location.assign(href);
                      }
                    }
                  : undefined
              }
              className={`rounded-2xl border border-ink-200/80 bg-white/70 px-3 py-3 text-left shadow-sm dark:border-white/[0.06] dark:bg-white/[0.04] dark:shadow-none sm:px-4 sm:py-4 ${
                t.wide ? "col-span-2" : ""
              } ${
                interactive
                  ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:border-emerald-400/25 dark:hover:bg-white/[0.07]"
                  : ""
              }`}
              aria-label={interactive ? t.ariaLabel : undefined}
            >
              {content}
            </div>
          );
          })}
        </dl>

        <p className="mt-8 text-xs text-ink-400 dark:text-white/30">by Iliass KHOMSI</p>
      </div>
    </header>
  );
}
