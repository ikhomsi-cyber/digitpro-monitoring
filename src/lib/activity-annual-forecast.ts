import type { BillableRatePeriod } from "@/lib/billable-client-days";
import { computeAnnualObjectiveTracking } from "@/lib/annual-objective";
import { computeActivityYearRevenueHt } from "@/lib/activity-productivity";
import { computeYearEndProjection } from "@/lib/year-end-projection";

export type ActivityAnnualForecast = {
  year: number;
  forecastedBilledDays: number;
  forecastedRevenueHtEur: number;
  remainingDaysToTarget: number | null;
  /** Avancement actuel vs objectif (CA HT réalisé). */
  revenueTargetAchievementPct: number | null;
  /** Avancement projeté fin d'année vs objectif. */
  forecastedAchievementPct: number | null;
  achievedHtEur: number;
  targetHtEur: number | null;
  hasTarget: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Prévision annuelle activité : jours facturés, CA HT, écart objectif. */
export function computeActivityAnnualForecast(input: {
  selected: ReadonlySet<string>;
  sortedWorkDayIsos: readonly string[];
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  annualRevenueTargetHt: number | null;
  now?: Date;
}): ActivityAnnualForecast {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const currentTjmHt = Math.max(0, input.currentTjmHt);

  const achievedHtEur = computeActivityYearRevenueHt(
    input.selected,
    year,
    input.billableRatePeriods,
    input.fallbackTjmHt
  );

  const yearEnd = computeYearEndProjection({
    selectedWorkDayIsos: input.sortedWorkDayIsos,
    billableRatePeriods: input.billableRatePeriods,
    fallbackTjmHt: input.fallbackTjmHt,
    tjmRepartition: {
      caHtEur: currentTjmHt,
      bncEur: 0,
      fraisPersoEur: 0,
      csgEur: 0
    },
    soldeQontoEur: null,
    detteTotaleEur: 0,
    statsReady: true,
    now
  });

  const tracking = computeAnnualObjectiveTracking(input.annualRevenueTargetHt, achievedHtEur, now);
  const hasTarget = tracking != null;
  const targetHtEur = tracking?.targetHtEur ?? null;

  let remainingDaysToTarget: number | null = null;
  let revenueTargetAchievementPct: number | null = null;

  if (tracking && currentTjmHt > 0) {
    remainingDaysToTarget = Math.ceil(tracking.remainingHtEur / currentTjmHt);
    revenueTargetAchievementPct = tracking.completionPct;
  } else if (tracking) {
    remainingDaysToTarget = tracking.remainingHtEur > 0 ? null : 0;
    revenueTargetAchievementPct = tracking.completionPct;
  }

  const forecastedAchievementPct =
    hasTarget && targetHtEur != null && targetHtEur > 0
      ? Math.min(100, round2((yearEnd.projectedRevenueHtEur / targetHtEur) * 1000) / 10)
      : null;

  return {
    year,
    forecastedBilledDays: yearEnd.detail.totalCapacityDays,
    forecastedRevenueHtEur: yearEnd.projectedRevenueHtEur,
    remainingDaysToTarget,
    revenueTargetAchievementPct,
    achievedHtEur,
    targetHtEur,
    hasTarget,
    forecastedAchievementPct
  };
}
