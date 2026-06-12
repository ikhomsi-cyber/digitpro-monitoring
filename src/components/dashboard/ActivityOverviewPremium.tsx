"use client";

import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { dashboardEyebrow, dashboardFlatSectionHeader } from "@/lib/dashboard-surfaces";

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

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

function ActivityKpiCard({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[6.5rem] flex-col py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
        {label}
      </p>
      <div className="mt-2 flex flex-1 flex-col justify-end">{children}</div>
    </div>
  );
}

export function ActivityOverviewPremium({
  monthTitle,
  kpis,
  workdayGauge,
  tjmHt,
  ctaMode = "expand",
  onOpenCalendar
}: {
  monthTitle: string;
  kpis: ActivityOverviewKpis;
  workdayGauge: ActivityWorkdayGauge;
  tjmHt?: number;
  ctaMode?: "expand" | "navigate" | "hidden";
  onOpenCalendar?: () => void;
}) {
  const fmt = useDashboardDisplayFormat();

  const billedDays = workdayGauge.countedBillable;
  const totalDays = Math.max(workdayGauge.totalBillableMonth, 1);
  const advancementPct = Math.round(clamp01(billedDays / totalDays) * 100);

  return (
    <section className="space-y-4">
      <div className={clsx(dashboardFlatSectionHeader, "flex flex-wrap items-center justify-between gap-2")}>
        <div>
          <p className={dashboardEyebrow}>Activité SASU</p>
          <p className="mt-0.5 font-display text-sm font-semibold capitalize text-ink-900 dark:text-white/90">
            {monthTitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200/70 px-2.5 py-1 text-[10px] font-semibold text-ink-600 dark:border-white/10 dark:text-white/55">
          <BriefcaseBusiness className="h-3 w-3" aria-hidden />
          TJM · HT{typeof tjmHt === "number" && Number.isFinite(tjmHt) ? ` · ${fmt.euro(tjmHt)}` : ""}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <ActivityKpiCard label="Facturé à date">
          <p className="font-display text-xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
            {fmt.int(billedDays)}
            <span className="ml-1.5 text-sm font-semibold text-ink-500 dark:text-white/45">
              / {fmt.int(totalDays)}
            </span>
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">jours</p>
        </ActivityKpiCard>

        <ActivityKpiCard label="Taux d'avancement">
          <p className="font-display text-xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
            {fmt.int(advancementPct)}
            <span className="ml-0.5 text-sm font-semibold text-ink-500 dark:text-white/45">%</span>
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">
            {workdayGauge.isCurrent
              ? `${fmt.int(workdayGauge.remainingBillable)} j. restants`
              : "Mois passé"}
          </p>
        </ActivityKpiCard>

        <ActivityKpiCard label="CA sécurisé">
          <p className="font-display text-xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
            {fmt.euro(kpis.caEstime)}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">HT · jours cochés</p>
        </ActivityKpiCard>

        <ActivityKpiCard label="Projection fin de mois">
          <p className="font-display text-xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
            {fmt.euro(kpis.projectionFinMois)}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">HT · objectif mois</p>
        </ActivityKpiCard>
      </div>

      <div className="mt-5 border-t border-ink-200/40 pt-5 dark:border-cyan-100/[0.07]">
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/45">
          <span>Avancement du mois</span>
          <span className="tabular-nums text-ink-800 dark:text-white/80">{fmt.int(advancementPct)} %</span>
        </div>
        <div
          className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-ink-100/90 ring-1 ring-black/[0.04] dark:bg-white/[0.05] dark:ring-white/[0.06]"
          role="progressbar"
          aria-valuenow={advancementPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement mensuel"
        >
          <div
            className="h-full rounded-full bg-teal-500 transition-[width] duration-500 ease-out dark:bg-teal-400"
            style={{ width: `${advancementPct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium tabular-nums text-ink-500 dark:text-white/45">
          <span>{fmt.euro(kpis.caEstime)} sécurisé</span>
          <span>{fmt.euro(kpis.projectionFinMois)} objectif</span>
        </div>
      </div>

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
    </section>
  );
}
