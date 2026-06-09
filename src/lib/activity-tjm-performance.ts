import {
  resolveBillableTjmForClientMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";
import { computeKpiTrend, type KpiTrend } from "@/lib/kpi-month-trend";

export type ActivityTjmMonthSnapshot = {
  monthKey: string;
  monthLabel: string;
  tjmHt: number;
  workedDays: number;
};

export type ActivityTjmPerformance = {
  year: number;
  currentTjmHt: number;
  averageTjmYtd: number;
  bestMonth: ActivityTjmMonthSnapshot;
  worstMonth: ActivityTjmMonthSnapshot;
  trends: {
    current: KpiTrend | null;
    averageYtd: KpiTrend | null;
    best: KpiTrend | null;
    worst: KpiTrend | null;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthLabelFr(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const raw = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(y, (m || 1) - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function countWorkedDaysInMonth(
  selected: ReadonlySet<string>,
  year: number,
  month0: number
): number {
  const prefix = `${year}-${String(month0 + 1).padStart(2, "0")}-`;
  let n = 0;
  for (const iso of selected) {
    if (iso.startsWith(prefix)) n++;
  }
  return n;
}

function pickExtremeMonth(
  rows: readonly ActivityTjmMonthSnapshot[],
  mode: "max" | "min"
): ActivityTjmMonthSnapshot {
  return rows.reduce((acc, row) => {
    if (mode === "max") return row.tjmHt > acc.tjmHt ? row : acc;
    return row.tjmHt < acc.tjmHt ? row : acc;
  });
}

function averageTjm(rows: readonly ActivityTjmMonthSnapshot[]): number {
  if (!rows.length) return 0;
  let weighted = 0;
  let days = 0;
  for (const row of rows) {
    if (row.workedDays > 0) {
      weighted += row.tjmHt * row.workedDays;
      days += row.workedDays;
    }
  }
  if (days > 0) return round2(weighted / days);
  const sum = rows.reduce((s, row) => s + row.tjmHt, 0);
  return round2(sum / rows.length);
}

/** Performance TJM : actuel, moyenne pondérée YTD, meilleur / pire mois + tendances. */
export function computeActivityTjmPerformance(input: {
  selected: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  currentTjmHt: number;
  clientName?: string;
  now?: Date;
}): ActivityTjmPerformance {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const currentMonth0 = now.getMonth();
  const clientName = input.clientName ?? input.billableRatePeriods[0]?.clientName ?? "";

  const monthlyRows: ActivityTjmMonthSnapshot[] = [];
  for (let month0 = 0; month0 <= currentMonth0; month0++) {
    const monthKey = `${year}-${String(month0 + 1).padStart(2, "0")}`;
    monthlyRows.push({
      monthKey,
      monthLabel: monthLabelFr(monthKey),
      tjmHt: resolveBillableTjmForClientMonth(
        input.billableRatePeriods,
        clientName,
        monthKey,
        input.fallbackTjmHt
      ),
      workedDays: countWorkedDaysInMonth(input.selected, year, month0)
    });
  }

  const previousRows = monthlyRows.slice(0, -1);
  const previousRow = previousRows[previousRows.length - 1];

  const averageTjmYtd = averageTjm(monthlyRows);
  const previousAverageYtd = previousRows.length ? averageTjm(previousRows) : null;

  const bestMonth = pickExtremeMonth(monthlyRows, "max");
  const worstMonth = pickExtremeMonth(monthlyRows, "min");
  const previousBest = previousRows.length ? pickExtremeMonth(previousRows, "max") : null;
  const previousWorst = previousRows.length ? pickExtremeMonth(previousRows, "min") : null;

  return {
    year,
    currentTjmHt: input.currentTjmHt,
    averageTjmYtd,
    bestMonth,
    worstMonth,
    trends: {
      current: previousRow ? computeKpiTrend(input.currentTjmHt, previousRow.tjmHt) : null,
      averageYtd:
        previousAverageYtd != null ? computeKpiTrend(averageTjmYtd, previousAverageYtd) : null,
      best:
        previousBest != null ? computeKpiTrend(bestMonth.tjmHt, previousBest.tjmHt) : null,
      worst:
        previousWorst != null ? computeKpiTrend(worstMonth.tjmHt, previousWorst.tjmHt) : null
    }
  };
}
