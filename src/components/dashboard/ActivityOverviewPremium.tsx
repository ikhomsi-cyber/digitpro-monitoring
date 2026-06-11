"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarCheck,
  Lock,
  Percent,
  TrendingUp
} from "lucide-react";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { PremiumIconBadge, type IconBadgeTone } from "@/components/ui/PremiumIconBadge";

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
  icon,
  tone,
  children
}: {
  label: string;
  icon: typeof CalendarCheck;
  tone: IconBadgeTone;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[6.5rem] flex-col rounded-2xl border border-ink-200/80 bg-white/75 px-4 py-3.5 shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
          {label}
        </p>
        <PremiumIconBadge icon={icon} tone={tone} size="sm" />
      </div>
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
    <div className="relative overflow-hidden rounded-[2rem] border border-ink-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 p-5 shadow-[0_20px_60px_-28px_rgba(16,185,129,0.35)] dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_32px_80px_-24px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl dark:bg-teal-300/18"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl dark:bg-cyan-300/12"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700/90 dark:text-teal-200/80">
            Activité SASU
          </p>
          <p className="mt-0.5 font-display text-sm font-semibold capitalize text-ink-900 dark:text-white/90">
            {monthTitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:border-teal-200/[0.16] dark:bg-teal-200/[0.08] dark:text-teal-100/85">
          <BriefcaseBusiness className="h-3 w-3" aria-hidden />
          TJM · HT{typeof tjmHt === "number" && Number.isFinite(tjmHt) ? ` · ${fmt.euro(tjmHt)}` : ""}
        </span>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ActivityKpiCard
          label="Facturé à date"
          icon={CalendarCheck}
          tone="violet"
        >
          <p className="font-display text-xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
            {fmt.int(billedDays)}
            <span className="ml-1.5 text-sm font-semibold text-ink-500 dark:text-white/45">
              / {fmt.int(totalDays)}
            </span>
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">jours</p>
        </ActivityKpiCard>

        <ActivityKpiCard
          label="Taux d'avancement"
          icon={Percent}
          tone="sky"
        >
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

        <ActivityKpiCard
          label="CA sécurisé"
          icon={Lock}
          tone="emerald"
        >
          <p className="font-display text-xl font-bold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-200 sm:text-2xl">
            {fmt.euro(kpis.caEstime)}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">HT · jours cochés</p>
        </ActivityKpiCard>

        <ActivityKpiCard
          label="Projection fin de mois"
          icon={TrendingUp}
          tone="amber"
        >
          <p className="font-display text-xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-2xl">
            {fmt.euro(kpis.projectionFinMois)}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">HT · objectif mois</p>
        </ActivityKpiCard>
      </div>

      <div className="relative mt-5 rounded-2xl border border-ink-200/70 bg-white/60 px-4 py-3.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/45">
          <span>Avancement du mois</span>
          <span className="tabular-nums text-ink-800 dark:text-white/80">{fmt.int(advancementPct)} %</span>
        </div>
        <div
          className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-ink-100/90 ring-1 ring-black/[0.04] dark:bg-[#06242b]/80 dark:ring-cyan-100/[0.10]"
          role="progressbar"
          aria-valuenow={advancementPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement mensuel"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-[width] duration-500 ease-out"
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
    </div>
  );
}
