"use client";

import { useMemo } from "react";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { computeActivityBillingPaceProjection } from "@/lib/activity-billing-pace-projection";

type Props = {
  selected: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  tjmRepartition: DashboardHeroStats["tjmRepartitionMois"];
};

export function ActivityBillingPaceWidget({
  selected,
  billableRatePeriods,
  fallbackTjmHt,
  currentTjmHt,
  tjmRepartition
}: Props) {
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
      <p className="mt-4 text-[10px] leading-relaxed text-ink-500 dark:text-white/40">
        Extrapolation linéaire : rythme moyen des {projection.monthsElapsed} premiers mois de{" "}
        {projection.year} projeté sur 12 mois. Le revenu personnel applique la répartition Valeur
        réelle du mois en cours.
      </p>
    </section>
  );
}
