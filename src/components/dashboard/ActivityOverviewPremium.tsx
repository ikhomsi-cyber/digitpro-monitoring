"use client";

import Link from "next/link";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { dashboardHeroSection } from "@/lib/dashboard-surfaces";

export type ActivityOverviewKpis = {
  jours: number;
  caEstime: number;
  resteAFacturer: number;
  projectionFinMois: number;
};

export type ActivityWorkdayGauge = {
  countedBillable: number;
  totalBillableMonth: number;
  remainingBillable: number;
  isCurrent: boolean;
};

export function ActivityOverviewPremium({
  kpis,
  workdayGauge,
  ctaMode = "expand",
  onOpenCalendar
}: {
  kpis: ActivityOverviewKpis;
  workdayGauge: ActivityWorkdayGauge;
  ctaMode?: "expand" | "navigate" | "hidden";
  onOpenCalendar?: () => void;
}) {
  const fmt = useDashboardDisplayFormat();

  const billedDays = workdayGauge.countedBillable;
  const totalDays = Math.max(workdayGauge.totalBillableMonth, 1);

  return (
    <>
      <section className={dashboardHeroSection}>
        <p className="text-sm font-medium text-ink-500 dark:text-white/55">CA sécurisé · HT</p>
        <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-apple-tight text-ink-900 dark:text-white sm:text-5xl">
          {fmt.euro(kpis.caEstime)}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-300">
            <span className="text-ink-600 dark:text-white/60">Jours facturés</span>
            <span className="tabular-nums">
              {fmt.int(billedDays)} / {fmt.int(totalDays)} j.
            </span>
          </span>
        </div>
      </section>

      {ctaMode === "hidden" ? null : ctaMode === "navigate" ? (
        <Link
          href="/dashboard?section=activite"
          scroll={false}
          className="premium-cta relative mt-5 flex w-full items-center justify-center py-3.5 text-sm font-semibold"
        >
          Voir le calendrier & TJM
        </Link>
      ) : (
        <button
          type="button"
          onClick={onOpenCalendar}
          className="premium-cta relative mt-5 w-full py-3.5 text-sm font-semibold"
        >
          Ouvrir le calendrier & TJM
        </button>
      )}
    </>
  );
}
