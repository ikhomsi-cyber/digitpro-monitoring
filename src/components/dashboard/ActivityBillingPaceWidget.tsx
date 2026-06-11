"use client";

import { useMemo } from "react";
import { CalendarClock, Coins, LineChart, UserRound } from "lucide-react";
import { clsx } from "clsx";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { computeActivityBillingPaceProjection } from "@/lib/activity-billing-pace-projection";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";

type Props = {
  selected: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  tjmRepartition: DashboardHeroStats["tjmRepartitionMois"];
};

function PaceMetric({
  label,
  value,
  sublabel,
  icon: Icon,
  emphasized = false
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: typeof LineChart;
  emphasized?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-3.5",
        emphasized
          ? "border-teal-200/80 bg-teal-50/60 dark:border-teal-400/20 dark:bg-teal-500/10"
          : "border-ink-200/75 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.04]"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={clsx(
            "h-3.5 w-3.5",
            emphasized ? "text-teal-600 dark:text-teal-300" : "text-ink-500 dark:text-white/45"
          )}
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/45">
          {label}
        </p>
      </div>
      <p
        className={clsx(
          "mt-2 font-display font-bold tabular-nums",
          emphasized
            ? "text-xl text-teal-900 dark:text-teal-100 sm:text-2xl"
            : "text-lg text-ink-900 dark:text-white sm:text-xl"
        )}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-[10px] font-medium text-ink-500 dark:text-white/40">{sublabel}</p>
      ) : null}
    </div>
  );
}

export function ActivityBillingPaceWidget({
  selected,
  billableRatePeriods,
  fallbackTjmHt,
  currentTjmHt,
  tjmRepartition
}: Props) {
  const fmt = useDashboardDisplayFormat();

  const projection = useMemo(
    () =>
      computeActivityBillingPaceProjection({
        selected,
        billableRatePeriods,
        fallbackTjmHt,
        currentTjmHt,
        tjmRepartition
      }),
    [billableRatePeriods, currentTjmHt, fallbackTjmHt, selected, tjmRepartition]
  );

  return (
    <section className="rounded-[2rem] border border-teal-200/70 bg-gradient-to-br from-teal-50/80 via-white to-cyan-50/50 p-5 shadow-[0_20px_60px_-28px_rgba(20,184,166,0.35)] dark:border-teal-300/15 dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_32px_80px_-24px_rgba(0,22,28,0.72)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <PremiumIconBadge icon={LineChart} tone="teal" size="lg" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-teal-700/85 dark:text-teal-300/80">
              Projection au rythme actuel
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink-900 dark:text-white">
              Si le rythme actuel se poursuit
            </h2>
            <p className="mt-1 text-[11px] text-ink-600 dark:text-white/50">
              Prévision au {projection.forecastDateLabel}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-teal-200/70 bg-white/70 px-3 py-2 text-right dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-[9px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
            Base de calcul
          </p>
          <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-ink-700 dark:text-white/70">
            {projection.basisLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <PaceMetric
          label="Jours travaillés attendus"
          value={`${projection.expectedWorkedDays.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j.`}
          sublabel={`${fmt.int(projection.workedDaysYtd)} j. YTD · ${projection.averageDaysPerMonth.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j./mois`}
          icon={CalendarClock}
        />
        <PaceMetric
          label="CA annuel attendu"
          value={fmt.euro(projection.expectedAnnualRevenueHt)}
          sublabel="HT · annualisé"
          icon={Coins}
          emphasized
        />
        <PaceMetric
          label="Revenu perso attendu"
          value={fmt.euro(projection.expectedPersonalIncomeEur)}
          sublabel="BNC + frais perso (ratio mois)"
          icon={UserRound}
        />
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-ink-500 dark:text-white/40">
        Extrapolation linéaire : rythme moyen des {projection.monthsElapsed} premiers mois de{" "}
        {projection.year} projeté sur 12 mois. Le revenu personnel applique la répartition Valeur
        réelle du mois en cours.
      </p>
    </section>
  );
}
