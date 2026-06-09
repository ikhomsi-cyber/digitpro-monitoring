import type { BillableRatePeriod } from "@/lib/billable-client-days";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { computeActivityProductivitySummary } from "@/lib/activity-productivity";

export type ActivityBillingPaceProjection = {
  year: number;
  forecastDateLabel: string;
  monthsElapsed: number;
  workedDaysYtd: number;
  averageDaysPerMonth: number;
  expectedWorkedDays: number;
  expectedAnnualRevenueHt: number;
  expectedPersonalIncomeEur: number;
  basisLabel: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolvePersonalIncomeRatio(rep: DashboardHeroStats["tjmRepartitionMois"]): number {
  const caBase = Math.max(0, rep.caHtEur);
  if (caBase <= 0) return 0;
  return (Math.max(0, rep.bncEur) + Math.max(0, rep.fraisPersoEur)) / caBase;
}

/** Projection fin d'année si le rythme de facturation actuel se poursuit. */
export function computeActivityBillingPaceProjection(input: {
  selected: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  tjmRepartition: DashboardHeroStats["tjmRepartitionMois"];
  now?: Date;
}): ActivityBillingPaceProjection {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;

  const productivity = computeActivityProductivitySummary({
    selected: input.selected,
    viewYear: year,
    billableRatePeriods: input.billableRatePeriods,
    fallbackTjmHt: input.fallbackTjmHt,
    currentTjmHt: input.currentTjmHt,
    now
  });

  const personalRatio = resolvePersonalIncomeRatio(input.tjmRepartition);
  const expectedWorkedDays = Math.round(productivity.averageDaysPerMonth * 12 * 10) / 10;
  const expectedAnnualRevenueHt = productivity.projectedAnnualRevenueHt;
  const expectedPersonalIncomeEur = round2(expectedAnnualRevenueHt * personalRatio);

  const forecastDateLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(year, 11, 31));

  return {
    year,
    forecastDateLabel,
    monthsElapsed,
    workedDaysYtd: productivity.workedDays,
    averageDaysPerMonth: productivity.averageDaysPerMonth,
    expectedWorkedDays,
    expectedAnnualRevenueHt,
    expectedPersonalIncomeEur,
    basisLabel: `${productivity.workedDays} j. sur ${monthsElapsed} mois · ${productivity.averageDaysPerMonth} j./mois`
  };
}
