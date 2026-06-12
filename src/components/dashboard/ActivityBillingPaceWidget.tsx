"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { computeActivityBillingPaceProjection } from "@/lib/activity-billing-pace-projection";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
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
  emphasized = false
}: {
  label: string;
  value: string;
  sublabel?: string;
  emphasized?: boolean;
}) {
  return (
    <div className="py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/45">
        {label}
      </p>
      <p
        className={clsx(
          "mt-2 font-display font-bold tabular-nums text-ink-900 dark:text-white",
          emphasized ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-500 dark:text-white/45">
            Projection au rythme actuel
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink-900 dark:text-white">
            Si le rythme actuel se poursuit
          </h2>
          <p className="mt-1 text-[11px] text-ink-600 dark:text-white/50">
            Prévision au {projection.forecastDateLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
            Base de calcul
          </p>
          <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-ink-700 dark:text-white/70">
            {projection.basisLabel}
          </p>
        </div>
      </div>

      <div className="grid gap-6 border-t border-ink-200/40 pt-5 dark:border-cyan-100/[0.07] md:grid-cols-3 md:gap-8 md:[&>*:not(:last-child)]:border-r md:[&>*:not(:last-child)]:border-ink-200/35 md:[&>*:not(:last-child)]:pr-8 dark:md:[&>*:not(:last-child)]:border-cyan-100/[0.07]">
        <PaceMetric
          label="Jours travaillés attendus"
          value={`${projection.expectedWorkedDays.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j.`}
          sublabel={`${fmt.int(projection.workedDaysYtd)} j. YTD · ${projection.averageDaysPerMonth.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j./mois`}
        />
        <PaceMetric
          label="CA annuel attendu"
          value={fmt.euro(projection.expectedAnnualRevenueHt)}
          sublabel="HT · annualisé"
          emphasized
        />
        <PaceMetric
          label="Revenu perso attendu"
          value={fmt.euro(projection.expectedPersonalIncomeEur)}
          sublabel="BNC + frais perso (ratio mois)"
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
