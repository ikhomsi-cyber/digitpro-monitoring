"use client";

import { useMemo } from "react";
import { BriefcaseBusiness, CalendarCheck2, Landmark, PiggyBank, TrendingUp, WalletCards } from "lucide-react";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { resolveBillableTjmForClientMonth } from "@/lib/billable-client-days";
import { countAgendaWorkDaysInMonth } from "@/lib/billable-calendar-metrics";

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

type Tile = {
  label: string;
  value: string;
  suffix?: string;
  valueNote?: { text: string; tone: "positive" | "negative" };
  sublabel?: string;
  sublabelTone?: "positive" | "negative" | "neutral" | "warning";
  metrics?: TileMetric[];
  icon: typeof TrendingUp;
  iconClassName: string;
  href?: string;
  ariaLabel?: string;
  wide?: boolean;
  breakdown?: Array<{ label: string; value: number; colorClass: string }>;
  workdayProgress?: {
    billedDays: number;
    remainingDays: number;
    billedAmountEur: number;
    remainingAmountEur: number;
  };
  tjmRepartition?: Array<{ label: string; value: number; colorClass: string; textClass: string }>;
};

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
  const billedDaysLabel = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(billedDaysToDate);
  const remunerationDisponibleEur = (stats.soldeQontoEur ?? 0) - stats.detteTotaleDepuisDebutEur;
  const realTjmBeforeIncomeTaxEur = billedDaysToDate > 0 ? inPocketToDateEur / billedDaysToDate : 0;
  const realTjmSharePct = activeTjmHt > 0 ? Math.round((realTjmBeforeIncomeTaxEur / activeTjmHt) * 100) : 0;
  const tjmRepartitionTotalEur = Math.max(
    1,
    stats.tjmRepartitionMois.bncEur + stats.tjmRepartitionMois.ikEur + stats.tjmRepartitionMois.ndfEur
  );
  const yearToDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonthKey = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let billedDays = 0;
    let generatedHt = 0;

    for (const iso of billable.sortedIsos) {
      if (!iso.startsWith(`${year}-`)) continue;
      const monthKey = iso.slice(0, 7);
      if (monthKey >= currentMonthKey) continue;
      billedDays += 1;
      const amount = resolveBillableTjmForClientMonth(
        billable.billableRatePeriods,
        billable.billableRatePeriods[0]?.clientName ?? "",
        monthKey,
        billable.tjmHt
      );
      generatedHt += amount;
    }
    return {
      year,
      billedDays,
      generatedHt: Math.round(generatedHt * 100) / 100
    };
  }, [billable.billableRatePeriods, billable.sortedIsos, billable.tjmHt]);
  const invoicesToCollect = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = now.getMonth() === 0
      ? { year: now.getFullYear() - 1, month0: 11 }
      : { year: now.getFullYear(), month0: now.getMonth() - 1 };
    const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(
      new Date(lastMonth.year, lastMonth.month0, 1)
    );
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
      days: daysAlreadyInvoiced,
      monthLabel,
      dueInDays,
      statusLabel:
        dueInDays >= 0
          ? `📅 À venir J-${Math.ceil(dueInDays)}`
          : `⚠️ Retard de ${Math.abs(Math.floor(dueInDays))} j.`
    };
  }, [billable.billableRatePeriods, billable.selected, billable.tjmHt]);
  const activityYtd = useMemo(() => {
    const totalDays = yearToDate.billedDays;
    const facturedDays = Math.min(invoicesToCollect.days, totalDays);
    const encaisseDays = Math.max(0, totalDays - facturedDays);
    return {
      amountHtEur: yearToDate.generatedHt,
      encaisseDays: Math.round(encaisseDays * 10) / 10,
      facturedDays: Math.round(facturedDays * 10) / 10,
      totalDays: Math.round(totalDays * 10) / 10
    };
  }, [invoicesToCollect.days, yearToDate]);

  const tiles: Tile[] = useMemo(
    () => [
      {
        label: "Encaissé ce mois",
        value: fmt.euro(stats.caMensuelEur),
        suffix: "TTC",
        sublabel: `${invoicesToCollect.statusLabel} · ${fmt.euro(invoicesToCollect.amountHtEur * 1.2)} TTC`,
        sublabelTone: invoicesToCollect.amountHtEur <= 0 ? "positive" : invoicesToCollect.dueInDays < 0 ? "negative" : "warning",
        icon: TrendingUp,
        iconClassName: "text-emerald-300 bg-emerald-500/12 border-emerald-400/20",
        href: "/dashboard?section=sasu&scope=pro",
        ariaLabel: "Ouvrir la page SASU"
      },
      {
        label: "Cash disponible",
        value: stats.soldeQontoEur != null ? fmt.euro(stats.soldeQontoEur) : "—",
        sublabel: statsReady
          ? remunerationDisponibleEur >= 0
            ? `💸 Rémunération à verser ${fmt.euro(remunerationDisponibleEur)}`
            : `🛑 Dette ${fmt.euro(Math.abs(remunerationDisponibleEur))}`
          : undefined,
        sublabelTone: remunerationDisponibleEur >= 0 ? "positive" : "negative",
        icon: WalletCards,
        iconClassName: "text-sky-300 bg-sky-500/12 border-sky-400/20"
      },
      {
        label: "Avant IR (mois en cours)",
        value: fmt.euro(inPocketToDateEur),
        sublabel: `${billedDaysLabel} j. facturés à date`,
        workdayProgress: {
          billedDays: billedDaysToDate,
          remainingDays: remainingBillableDays,
          billedAmountEur: inPocketToDateEur,
          remainingAmountEur: activeTjmHt * remainingBillableDays
        },
        icon: PiggyBank,
        iconClassName: "text-amber-200 bg-amber-500/12 border-amber-300/20"
      },
      {
        label: "TJM en vigueur",
        value: fmt.euro(activeTjmHt),
        suffix: "HT",
        sublabel: `Réel ${fmt.euro(realTjmBeforeIncomeTaxEur)}/j · ${fmt.int(realTjmSharePct)} %`,
        sublabelTone: "positive",
        tjmRepartition: [
          { label: "BNC", value: stats.tjmRepartitionMois.bncEur, colorClass: "bg-sky-400", textClass: "text-sky-700 dark:text-sky-300" },
          { label: "IK", value: stats.tjmRepartitionMois.ikEur, colorClass: "bg-emerald-400", textClass: "text-emerald-700 dark:text-emerald-300" },
          { label: "NDF", value: stats.tjmRepartitionMois.ndfEur, colorClass: "bg-violet-400", textClass: "text-violet-700 dark:text-violet-300" }
        ],
        icon: CalendarCheck2,
        iconClassName: "text-violet-200 bg-violet-500/12 border-violet-300/20",
        href: "/parametres",
        ariaLabel: "Ouvrir le paramétrage des TJM"
      },
      {
        label: `Depuis janvier ${yearToDate.year}`,
        value: fmt.euro(activityYtd.amountHtEur),
        suffix: "HT encaissé + facturé",
        sublabel: `${fmt.int(activityYtd.encaisseDays)} j. encaissés + ${fmt.int(activityYtd.facturedDays)} j. facturés`,
        sublabelTone: "neutral",
        metrics: [
          { label: "Jours activité", value: `${fmt.int(activityYtd.totalDays)} j.` },
          { label: "Encaissé", value: `${fmt.euro(stats.caAnnuelEncaisseHtEur)} HT`, tone: "positive" },
          { label: "Dépenses SASU", value: fmt.euro(stats.depensesAnnuelPasseesTtcEur), tone: "negative" }
        ],
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
        valueNote: {
          text:
          (stats.soldeQontoEur ?? 0) >= stats.detteTotaleDepuisDebutEur
            ? "✅ Solde suffisant pour couvrir la dette"
            : `🛑 Il manque ${fmt.euro(stats.resteAVerserApresCashEur)} pour couvrir la dette`,
          tone: (stats.soldeQontoEur ?? 0) >= stats.detteTotaleDepuisDebutEur ? "positive" : "negative"
        },
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
      activityYtd,
      billedDaysLabel,
      fmt,
      inPocketToDateEur,
      invoicesToCollect,
      realTjmBeforeIncomeTaxEur,
      realTjmSharePct,
      remainingBillableDays,
      remunerationDisponibleEur,
      stats,
      statsReady,
      tjmRepartitionTotalEur,
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
                  {t.valueNote ? (
                    <span
                      className={`ml-2 align-baseline text-[11px] font-bold tracking-normal ${
                        t.valueNote.tone === "positive"
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {t.valueNote.text}
                    </span>
                  ) : null}
                </dd>
                {t.sublabel ? (
                  <p
                    className={`mt-1 truncate whitespace-nowrap text-[11px] font-bold ${
                      t.sublabelTone === "positive"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : t.sublabelTone === "negative"
                          ? "text-rose-700 dark:text-rose-300"
                          : t.sublabelTone === "warning"
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-ink-500 dark:text-white/40"
                    }`}
                  >
                    {t.sublabel}
                  </p>
                ) : null}
                {t.tjmRepartition ? (
                  <div className="mt-2 rounded-xl border border-violet-200/60 bg-white/45 p-2 dark:border-violet-400/15 dark:bg-white/[0.025]">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-200/70 dark:bg-white/10">
                      {t.tjmRepartition.map((part) => (
                        <div
                          key={part.label}
                          className={part.colorClass}
                          style={{ width: `${Math.max(4, (part.value / tjmRepartitionTotalEur) * 100)}%` }}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1 text-[8px] font-bold">
                      {t.tjmRepartition.map((part) => {
                        const pct = (part.value / tjmRepartitionTotalEur) * 100;
                        const dailyValue = activeTjmHt * (pct / 100);
                        return (
                          <span key={part.label} className={`min-w-0 ${part.textClass}`}>
                            <span className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${part.colorClass}`} />
                              <span>{part.label}</span>
                              <span className="tabular-nums">{fmt.int(pct)}%</span>
                            </span>
                            <span className="mt-0.5 block truncate tabular-nums text-ink-500 dark:text-white/40">
                              {fmt.euro(dailyValue)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {t.workdayProgress ? (
                  <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/45 p-2 dark:border-amber-300/15 dark:bg-amber-400/[0.04]">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-200/70 dark:bg-white/10">
                      <span
                        className="bg-amber-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              (t.workdayProgress.billedDays /
                                Math.max(1, t.workdayProgress.billedDays + t.workdayProgress.remainingDays)) *
                                100
                            )
                          )}%`
                        }}
                        aria-hidden
                      />
                      <span className="flex-1 bg-white/70 dark:bg-white/20" aria-hidden />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1 text-[8px] font-bold sm:text-[9px]">
                      <span className="shrink-0 whitespace-nowrap text-amber-700 dark:text-amber-300">
                        Facturé {fmt.int(t.workdayProgress.billedDays)} j.
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-ink-500 dark:text-white/40">
                        À venir {fmt.int(t.workdayProgress.remainingDays)} j. · {fmt.euro(t.workdayProgress.remainingAmountEur)}
                      </span>
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
