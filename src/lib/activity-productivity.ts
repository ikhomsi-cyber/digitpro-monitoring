import {
  resolveBillableTjmForClientMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";

export type ActivityProductivitySummary = {
  currentTjmHt: number;
  workedDays: number;
  averageDaysPerMonth: number;
  projectedAnnualRevenueHt: number;
  viewYear: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** CA HT cumulé sur l'année affichée (jours cochés × TJM du mois). */
export function computeActivityYearRevenueHt(
  selected: ReadonlySet<string>,
  viewYear: number,
  billableRatePeriods: readonly BillableRatePeriod[],
  fallbackTjmHt: number
): number {
  const yearPrefix = `${viewYear}-`;
  const monthRateCache = new Map<string, number>();
  let total = 0;

  for (const iso of selected) {
    if (!iso.startsWith(yearPrefix)) continue;
    const monthKey = iso.slice(0, 7);
    let rate = monthRateCache.get(monthKey);
    if (rate == null) {
      rate = resolveBillableTjmForClientMonth(
        billableRatePeriods,
        billableRatePeriods[0]?.clientName ?? "",
        monthKey,
        fallbackTjmHt
      );
      monthRateCache.set(monthKey, rate);
    }
    total += rate;
  }

  return round2(total);
}

function countWorkedDaysInYear(selected: ReadonlySet<string>, viewYear: number): number {
  const yearPrefix = `${viewYear}-`;
  let n = 0;
  for (const iso of selected) {
    if (iso.startsWith(yearPrefix)) n++;
  }
  return n;
}

export function computeActivityProductivitySummary(input: {
  selected: ReadonlySet<string>;
  viewYear: number;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  now?: Date;
}): ActivityProductivitySummary {
  const now = input.now ?? new Date();
  const currentYear = now.getFullYear();
  const workedDays = countWorkedDaysInYear(input.selected, input.viewYear);
  const revenueYearHt = computeActivityYearRevenueHt(
    input.selected,
    input.viewYear,
    input.billableRatePeriods,
    input.fallbackTjmHt
  );

  const monthsDivisor =
    input.viewYear < currentYear
      ? 12
      : input.viewYear > currentYear
        ? 1
        : now.getMonth() + 1;

  const averageDaysPerMonth = round1(workedDays / Math.max(1, monthsDivisor));

  const projectedAnnualRevenueHt =
    input.viewYear < currentYear
      ? revenueYearHt
      : round2((revenueYearHt / Math.max(1, monthsDivisor)) * 12);

  return {
    currentTjmHt: input.currentTjmHt,
    workedDays,
    averageDaysPerMonth,
    projectedAnnualRevenueHt,
    viewYear: input.viewYear
  };
}
