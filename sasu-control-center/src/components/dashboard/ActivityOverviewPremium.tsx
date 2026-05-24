"use client";

import Link from "next/link";
import { useId } from "react";
import { BriefcaseBusiness, Target, TrendingUp } from "lucide-react";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function PremiumRadialGauge({
  value,
  max,
  gradientId,
  caption
}: {
  value: number;
  max: number;
  gradientId: string;
  caption: string;
}) {
  const fmt = useDashboardDisplayFormat();
  const pct = clamp01(max > 0 ? value / max : 0);
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div
      className="relative mx-auto flex h-[7.75rem] w-[7.75rem] shrink-0 items-center justify-center sm:mx-0"
      aria-hidden
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="55%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="9"
          className="stroke-ink-200/90 dark:stroke-white/[0.08]"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="drop-shadow-[0_0_12px_rgba(16,185,129,0.45)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[1.65rem] font-bold leading-none tabular-nums text-ink-900 dark:text-white">
          {fmt.int(value)}
        </span>
        <span className="mt-0.5 text-[11px] font-medium tabular-nums text-ink-500 dark:text-white/45">
          / {fmt.int(max)} j.
        </span>
      </div>
      <p className="sr-only">{caption}</p>
    </div>
  );
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

export function ActivityOverviewPremium({
  monthTitle,
  kpis,
  workdayGauge,
  ctaMode = "expand",
  onOpenCalendar
}: {
  monthTitle: string;
  kpis: ActivityOverviewKpis;
  workdayGauge: ActivityWorkdayGauge;
  ctaMode?: "expand" | "navigate" | "hidden";
  onOpenCalendar?: () => void;
}) {
  const fmt = useDashboardDisplayFormat();
  const gaugeGradId = useId().replace(/:/g, "");
  const caPct = clamp01(kpis.projectionFinMois > 0 ? kpis.caEstime / kpis.projectionFinMois : 0);
  const workdayCaption = workdayGauge.isCurrent
    ? `${fmt.int(workdayGauge.countedBillable)} jours cochés, ${fmt.int(workdayGauge.remainingBillable)} restants ce mois`
    : `${fmt.int(workdayGauge.countedBillable)} jours sur ${fmt.int(workdayGauge.totalBillableMonth)} ouvrés`;

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
          TJM · HT
        </span>
      </div>

      <div className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <PremiumRadialGauge
          value={workdayGauge.countedBillable}
          max={Math.max(workdayGauge.totalBillableMonth, 1)}
          gradientId={gaugeGradId}
          caption={workdayCaption}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50/90 text-emerald-700 dark:border-teal-200/[0.14] dark:bg-teal-200/[0.08] dark:text-teal-100">
                  <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/55">
                    CA estimé (mois)
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white/95">
                    {fmt.euro(kpis.caEstime)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink-100/90 ring-1 ring-black/[0.04] dark:bg-[#06242b]/80 dark:ring-cyan-100/[0.10]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.45)] transition-[width] duration-500 ease-out"
                style={{ width: `${caPct * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-ink-500 dark:text-white/55">
              <span>0 €</span>
              <span>{fmt.euro(kpis.projectionFinMois)} objectif</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-ink-200/70 bg-white/60 px-3 py-2.5 dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.07]">
              <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-500 dark:text-white/55">
                <Target className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                Reste à facturer
              </dt>
              <dd className="mt-1 font-display text-sm font-semibold tabular-nums text-ink-900 dark:text-white/92">
                {fmt.euro(kpis.resteAFacturer)}
              </dd>
            </div>
            <div className="rounded-2xl border border-ink-200/70 bg-white/60 px-3 py-2.5 dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.07]">
              <dt className="text-[10px] font-semibold text-ink-500 dark:text-white/55">Projection fin de mois</dt>
              <dd className="mt-1 font-display text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                {fmt.euro(kpis.projectionFinMois)}
              </dd>
            </div>
          </dl>
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
