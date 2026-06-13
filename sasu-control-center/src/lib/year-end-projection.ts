import {
  buildYearRevenueCapacityDaySet,
  effectiveRevenueAnalyticsDateIso,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { isRevenueCategory } from "@/lib/revenue-category";
import {
  resolveBillableTjmForClientMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";

const VAT_RATE = 0.2;

export type YearEndConfidenceLevel = "high" | "medium" | "low";

export type YearEndProjection = {
  year: number;
  forecastDateLabel: string;
  projectedRevenueHtEur: number;
  projectedPersonalIncomeEur: number;
  projectedCsgEur: number;
  projectedCashEur: number;
  confidence: {
    level: YearEndConfidenceLevel;
    score: number;
    label: string;
  };
  detail: {
    ytdCapacityDays: number;
    remainingCapacityDays: number;
    totalCapacityDays: number;
    explicitPlannedDays: number;
    ytdActualRevenueHtEur: number;
    habitYearsSampled: number;
    basisLabel: string;
  };
};

type HistoricalHabits = {
  yearsSampled: number;
  seasonalRevenueHtByMonth: Map<number, number>;
  seasonalWorkedDaysByMonth: Map<number, number>;
  avgMonthlyRevenueHt: number;
  avgWorkedDaysPerMonth: number;
  avgRevenuePerWorkedDayHt: number;
};

type BlendWeights = {
  habit: number;
  pace: number;
  plan: number;
};

function localTodayIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthKeyFromParts(year: number, month1: number): string {
  return `${year}-${String(month1).padStart(2, "0")}`;
}

function remainingMonthKeysInYear(year: number, afterMonth1: number): string[] {
  const keys: string[] = [];
  for (let m = afterMonth1 + 1; m <= 12; m += 1) {
    keys.push(monthKeyFromParts(year, m));
  }
  return keys;
}

function revenueHtByMonthFromTransactions(transactions: readonly DashboardTx[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (!isRevenueCategory(tx.category) || tx.amount <= 0) continue;
    if ((tx.scope ?? "pro") !== "pro") continue;
    const monthKey = effectiveRevenueAnalyticsDateIso(tx).slice(0, 7);
    map.set(monthKey, (map.get(monthKey) ?? 0) + tx.amount / (1 + VAT_RATE));
  }
  return map;
}

function workedDaysByMonthFromSelection(
  selectedWorkDayIsos: readonly string[],
  maxYearExclusive: number
): Map<string, number> {
  const map = new Map<string, number>();
  for (const iso of selectedWorkDayIsos) {
    const year = Number(iso.slice(0, 4));
    if (year >= maxYearExclusive) continue;
    const monthKey = iso.slice(0, 7);
    map.set(monthKey, (map.get(monthKey) ?? 0) + 1);
  }
  return map;
}

function buildHistoricalHabits(
  transactions: readonly DashboardTx[] | undefined,
  selectedWorkDayIsos: readonly string[],
  currentYear: number
): HistoricalHabits {
  const revenueByMonth = revenueHtByMonthFromTransactions(transactions ?? []);
  const workedDaysByMonth = workedDaysByMonthFromSelection(selectedWorkDayIsos, currentYear);

  const annualTotals = new Map<number, number>();
  const seasonalRevenue = new Map<number, { sum: number; count: number }>();
  const seasonalWorkedDays = new Map<number, { sum: number; count: number }>();

  for (const [monthKey, revenueHt] of revenueByMonth) {
    const year = Number(monthKey.slice(0, 4));
    if (year >= currentYear) continue;
    const month = Number(monthKey.slice(5, 7));
    annualTotals.set(year, (annualTotals.get(year) ?? 0) + revenueHt);

    const bucket = seasonalRevenue.get(month) ?? { sum: 0, count: 0 };
    bucket.sum += revenueHt;
    bucket.count += 1;
    seasonalRevenue.set(month, bucket);
  }

  for (const [monthKey, days] of workedDaysByMonth) {
    const month = Number(monthKey.slice(5, 7));
    const bucket = seasonalWorkedDays.get(month) ?? { sum: 0, count: 0 };
    bucket.sum += days;
    bucket.count += 1;
    seasonalWorkedDays.set(month, bucket);
  }

  const completeYears = [...annualTotals.entries()]
    .filter(([, total]) => total > 0)
    .map(([year]) => year);

  const seasonalRevenueHtByMonth = new Map<number, number>();
  for (const [month, bucket] of seasonalRevenue) {
    if (bucket.count > 0) {
      seasonalRevenueHtByMonth.set(month, bucket.sum / bucket.count);
    }
  }

  const seasonalWorkedDaysByMonth = new Map<number, number>();
  for (const [month, bucket] of seasonalWorkedDays) {
    if (bucket.count > 0) {
      seasonalWorkedDaysByMonth.set(month, bucket.sum / bucket.count);
    }
  }

  const annualAvg =
    completeYears.length > 0
      ? completeYears.reduce((sum, year) => sum + (annualTotals.get(year) ?? 0), 0) / completeYears.length
      : 0;

  let workedDaysTotal = 0;
  let workedMonthsTotal = 0;
  for (const [, days] of workedDaysByMonth) {
    workedDaysTotal += days;
    workedMonthsTotal += 1;
  }
  const avgWorkedDaysPerMonth = workedMonthsTotal > 0 ? workedDaysTotal / workedMonthsTotal : 0;
  const avgRevenuePerWorkedDayHt =
    workedDaysTotal > 0 && completeYears.length > 0
      ? completeYears.reduce((sum, year) => sum + (annualTotals.get(year) ?? 0), 0) / workedDaysTotal
      : annualAvg > 0 && avgWorkedDaysPerMonth > 0
        ? annualAvg / (avgWorkedDaysPerMonth * 12)
        : 0;

  return {
    yearsSampled: completeYears.length,
    seasonalRevenueHtByMonth,
    seasonalWorkedDaysByMonth,
    avgMonthlyRevenueHt: annualAvg / 12,
    avgWorkedDaysPerMonth,
    avgRevenuePerWorkedDayHt
  };
}

function habitRevenueForMonth(monthKey: string, habits: HistoricalHabits): number {
  const month = Number(monthKey.slice(5, 7));
  const seasonalRevenue = habits.seasonalRevenueHtByMonth.get(month);
  if (seasonalRevenue != null && seasonalRevenue > 0) {
    return seasonalRevenue;
  }

  const avgDaysInMonth =
    habits.seasonalWorkedDaysByMonth.get(month) ?? habits.avgWorkedDaysPerMonth;

  if (avgDaysInMonth > 0 && habits.avgRevenuePerWorkedDayHt > 0) {
    return avgDaysInMonth * habits.avgRevenuePerWorkedDayHt;
  }

  return habits.avgMonthlyRevenueHt;
}

function resolveBlendWeights(
  habitYears: number,
  explicitPlannedDays: number,
  totalCapacityDays: number,
  monthsElapsed: number
): BlendWeights {
  const habit =
    habitYears >= 3 ? 0.38 : habitYears === 2 ? 0.3 : habitYears === 1 ? 0.18 : 0;
  const planBase = totalCapacityDays > 0 ? explicitPlannedDays / totalCapacityDays : 0;
  const plan = Math.min(0.42, 0.14 + planBase * 0.28);
  const pace = Math.min(0.45, 0.12 + monthsElapsed * 0.04);
  const total = habit + plan + pace;
  if (total <= 0) return { habit: 0, pace: 0.55, plan: 0.45 };
  return {
    habit: habit / total,
    plan: plan / total,
    pace: pace / total
  };
}

function resolveConfidence(
  ytdCapacityDays: number,
  totalCapacityDays: number,
  explicitPlannedDays: number,
  statsReady: boolean,
  habitYears: number,
  monthsElapsed: number
): YearEndProjection["confidence"] {
  const yearProgress = totalCapacityDays > 0 ? ytdCapacityDays / totalCapacityDays : 0;
  const explicitRatio = totalCapacityDays > 0 ? explicitPlannedDays / totalCapacityDays : 0;

  let score = 0;
  if (statsReady) score += 15;
  score += Math.round(yearProgress * 35);
  score += Math.round(explicitRatio * 20);
  score += Math.min(20, habitYears * 6);
  score += Math.min(10, monthsElapsed * 2);
  score = Math.max(0, Math.min(100, score));

  if (score >= 70) return { level: "high", score, label: "Élevée" };
  if (score >= 45) return { level: "medium", score, label: "Moyenne" };
  return { level: "low", score, label: "Faible" };
}

function formatBasisLabel(weights: BlendWeights, habitYears: number): string {
  const parts: string[] = ["Réel YTD"];
  if (weights.habit > 0.05 && habitYears > 0) {
    parts.push(`habitudes ${habitYears} an${habitYears > 1 ? "s" : ""}`);
  }
  if (weights.pace > 0.05) parts.push("rythme actuel");
  if (weights.plan > 0.05) parts.push("jours planifiés");
  return parts.join(" + ");
}

function resolveTjmForMonth(
  monthKey: string,
  billableRatePeriods: readonly BillableRatePeriod[],
  clientName: string,
  fallbackTjmHt: number,
  cache: Map<string, number>
): number {
  let tjmHt = cache.get(monthKey);
  if (tjmHt == null) {
    tjmHt = resolveBillableTjmForClientMonth(
      billableRatePeriods,
      clientName,
      monthKey,
      fallbackTjmHt
    );
    cache.set(monthKey, tjmHt);
  }
  return tjmHt;
}

function planRevenueForMonth(
  monthKey: string,
  capacitySet: ReadonlySet<string>,
  todayIso: string,
  billableRatePeriods: readonly BillableRatePeriod[],
  clientName: string,
  fallbackTjmHt: number,
  tjmCache: Map<string, number>
): number {
  let total = 0;
  for (const iso of capacitySet) {
    if (!iso.startsWith(`${monthKey}-`) || iso <= todayIso) continue;
    total += resolveTjmForMonth(monthKey, billableRatePeriods, clientName, fallbackTjmHt, tjmCache);
  }
  return total;
}

/**
 * Projection au 31/12 : encaissements réels YTD + estimation du reste de l'année
 * (habitudes des années passées, rythme actuel, jours planifiés).
 */
export function computeYearEndProjection(input: {
  selectedWorkDayIsos: readonly string[];
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  clientName?: string;
  transactions?: readonly DashboardTx[];
  ytdRevenueHtEur?: number;
  tjmRepartition: {
    caHtEur: number;
    bncEur: number;
    fraisPersoEur: number;
    csgEur: number;
  };
  soldeQontoEur: number | null;
  detteTotaleEur: number;
  statsReady: boolean;
  now?: Date;
}): YearEndProjection {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const todayIso = localTodayIso(now);
  const yearPrefix = `${year}-`;
  const clientName = input.clientName ?? input.billableRatePeriods[0]?.clientName ?? "";
  const monthsElapsed = now.getMonth() + 1;

  const selectedInYear = new Set(
    input.selectedWorkDayIsos.filter((iso) => iso.startsWith(yearPrefix))
  );
  const capacitySet = buildYearRevenueCapacityDaySet(year, selectedInYear);
  const sortedCapacity = [...capacitySet].sort();

  const caBase = Math.max(0, input.tjmRepartition.caHtEur);
  const bncRatio = caBase > 0 ? input.tjmRepartition.bncEur / caBase : 0;
  const persoRatio = caBase > 0 ? input.tjmRepartition.fraisPersoEur / caBase : 0;
  const csgRatio = caBase > 0 ? input.tjmRepartition.csgEur / caBase : 0;
  const personalRatio = bncRatio + persoRatio;

  const habits = buildHistoricalHabits(input.transactions, input.selectedWorkDayIsos, year);
  const weights = resolveBlendWeights(
    habits.yearsSampled,
    selectedInYear.size,
    sortedCapacity.length,
    monthsElapsed
  );

  const revenueByMonth = revenueHtByMonthFromTransactions(input.transactions ?? []);
  let ytdActualRevenueHtEur = Math.max(0, input.ytdRevenueHtEur ?? 0);
  if (ytdActualRevenueHtEur <= 0) {
    for (const [monthKey, revenueHt] of revenueByMonth) {
      if (!monthKey.startsWith(yearPrefix)) continue;
      if (Number(monthKey.slice(5, 7)) <= monthsElapsed) {
        ytdActualRevenueHtEur += revenueHt;
      }
    }
  }

  const tjmCache = new Map<string, number>();
  let ytdCapacityDays = 0;
  let remainingCapacityDays = 0;
  for (const iso of sortedCapacity) {
    if (iso <= todayIso) ytdCapacityDays += 1;
    else remainingCapacityDays += 1;
  }

  const remainingMonthKeys = remainingMonthKeysInYear(year, monthsElapsed);
  const remainingMonths = remainingMonthKeys.length;

  let habitRemaining = 0;
  let planRemaining = 0;
  for (const monthKey of remainingMonthKeys) {
    habitRemaining += habitRevenueForMonth(monthKey, habits);
    planRemaining += planRevenueForMonth(
      monthKey,
      capacitySet,
      todayIso,
      input.billableRatePeriods,
      clientName,
      input.fallbackTjmHt,
      tjmCache
    );
  }

  const paceMonthly = monthsElapsed > 0 ? ytdActualRevenueHtEur / monthsElapsed : 0;
  const paceRemaining = paceMonthly * remainingMonths;

  const remainingRevenueHt =
    weights.habit * habitRemaining + weights.pace * paceRemaining + weights.plan * planRemaining;

  const projectedRevenueHtEur = ytdActualRevenueHtEur + remainingRevenueHt;
  const projectedPersonalIncomeEur = projectedRevenueHtEur * personalRatio;
  const projectedCsgEur = projectedRevenueHtEur * csgRatio;

  const remainingPersonalIncomeEur = remainingRevenueHt * personalRatio;
  const remainingCsgEur = remainingRevenueHt * csgRatio;
  const cashBase = input.soldeQontoEur ?? 0;
  const netCashTodayEur = cashBase - input.detteTotaleEur;
  const projectedCashEur = netCashTodayEur + remainingPersonalIncomeEur - remainingCsgEur;

  const forecastDateLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(year, 11, 31));

  return {
    year,
    forecastDateLabel,
    projectedRevenueHtEur: round2(projectedRevenueHtEur),
    projectedPersonalIncomeEur: round2(projectedPersonalIncomeEur),
    projectedCsgEur: round2(projectedCsgEur),
    projectedCashEur: round2(projectedCashEur),
    confidence: resolveConfidence(
      ytdCapacityDays,
      sortedCapacity.length,
      selectedInYear.size,
      input.statsReady,
      habits.yearsSampled,
      monthsElapsed
    ),
    detail: {
      ytdCapacityDays,
      remainingCapacityDays,
      totalCapacityDays: sortedCapacity.length,
      explicitPlannedDays: selectedInYear.size,
      ytdActualRevenueHtEur: round2(ytdActualRevenueHtEur),
      habitYearsSampled: habits.yearsSampled,
      basisLabel: formatBasisLabel(weights, habits.yearsSampled)
    }
  };
}
