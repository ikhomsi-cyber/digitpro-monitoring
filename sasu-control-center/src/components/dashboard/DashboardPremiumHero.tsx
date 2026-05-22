"use client";

import { useMemo } from "react";
import { BriefcaseBusiness, CalendarCheck2, Landmark, PiggyBank, TrendingUp, WalletCards } from "lucide-react";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { ActivityOverviewPremium } from "@/components/dashboard/ActivityOverviewPremium";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { resolveBillableTjmForClientMonth } from "@/lib/billable-client-days";

type Props = {
  stats: DashboardHeroStats;
  /** Bandeau contexte (démo / préférence démo). */
  contextMessage: string;
  showContextBanner: boolean;
};

type Tile = {
  label: string;
  value: string;
  suffix?: string;
  sublabel?: string;
  sublabelTone?: "positive" | "negative" | "neutral";
  icon: typeof TrendingUp;
  iconClassName: string;
  href?: string;
  ariaLabel?: string;
  wide?: boolean;
  breakdown?: Array<{ label: string; value: number; colorClass: string }>;
};

export function DashboardPremiumHero({ stats, contextMessage, showContextBanner }: Props) {
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
        sublabel: `Rémunération à verser ${fmt.euro(remunerationDisponibleEur)}`,
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
        icon: CalendarCheck2,
        iconClassName: "text-violet-200 bg-violet-500/12 border-violet-300/20",
        href: "/parametres",
        ariaLabel: "Ouvrir le paramétrage des TJM"
      },
      {
        label: "Dépenses du mois (SASU)",
        value: fmt.euro(stats.depensesQontoSasuMoisEur),
        suffix: "TTC",
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
          { label: "CSG +1,5 %", value: stats.detteCsgDepuisDebutEur, colorClass: "bg-orange-300" },
          { label: "TVA +1,5 %", value: stats.detteTvaDepuisDebutEur, colorClass: "bg-cyan-300" }
        ]
      }
    ],
    [activeTjmHt, billedDaysLabel, fmt, inPocketToDateEur, remunerationDisponibleEur, stats]
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

        <div className="mx-auto mt-8 max-w-3xl text-left">
          <ActivityOverviewPremium
            monthTitle={billable.overviewMonthTitle}
            kpis={billable.overviewKpis}
            workdayGauge={billable.overviewWorkdayGauge}
            ctaMode="navigate"
          />
        </div>

        <p className="mt-8 text-xs text-ink-400 dark:text-white/30">by Iliass KHOMSI</p>
      </div>
    </header>
  );
}
