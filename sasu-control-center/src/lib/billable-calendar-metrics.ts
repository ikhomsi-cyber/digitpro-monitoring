import { getFrenchPublicHolidaysForYear } from "@/lib/fr-public-holidays";
import {
  resolveBillableTjmForClientMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";
import type {
  ActivityOverviewKpis,
  ActivityWorkdayGauge
} from "@/components/dashboard/ActivityOverviewPremium";

export function toBillableIso(y: number, month0: number, day: number): string {
  return `${y}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthTitleFr(year: number, month0: number): string {
  const raw = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(year, month0, 1)
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Lun–ven, hors jours fériés France métropolitaine. */
export function isBillableWorkdayIso(
  iso: string,
  holidays: ReadonlyMap<string, string>
): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays.has(iso);
}

export function computeTjmWorkdayGauge(
  selected: ReadonlySet<string>,
  viewYear: number,
  viewMonth0: number,
  refDate = new Date()
): ActivityWorkdayGauge & { isCurrent: boolean } {
  const nowY = refDate.getFullYear();
  const nowM0 = refDate.getMonth();
  const todayD = refDate.getDate();
  const todayIso = toBillableIso(nowY, nowM0, todayD);
  const lastDate = new Date(viewYear, viewMonth0 + 1, 0);
  const lastDay = lastDate.getDate();
  const prefix = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}-`;
  const publicHolidays = getFrenchPublicHolidaysForYear(viewYear);

  const isPast = viewYear < nowY || (viewYear === nowY && viewMonth0 < nowM0);
  const isCurrent = viewYear === nowY && viewMonth0 === nowM0;

  const billableIsos: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const iso = toBillableIso(viewYear, viewMonth0, day);
    if (isBillableWorkdayIso(iso, publicHolidays)) billableIsos.push(iso);
  }
  const totalBillableMonth = billableIsos.length;

  let countedBillable = 0;
  for (const iso of selected) {
    if (!iso.startsWith(prefix)) continue;
    if (!isBillableWorkdayIso(iso, publicHolidays)) continue;
    if (isPast) countedBillable++;
    else if (isCurrent) {
      if (iso <= todayIso) countedBillable++;
    } else {
      countedBillable++;
    }
  }

  let remainingBillable = 0;
  if (isPast) {
    remainingBillable = 0;
  } else if (isCurrent) {
    for (const iso of billableIsos) {
      if (iso > todayIso) remainingBillable++;
    }
  } else {
    for (const iso of billableIsos) {
      if (!selected.has(iso)) remainingBillable++;
    }
  }

  return { countedBillable, remainingBillable, totalBillableMonth, isCurrent };
}

/**
 * Jours cochés dans l’agenda pour un mois civil (tous les jours sélectionnés, pas seulement ouvrés).
 * Mois passé : tous les jours du mois · mois en cours : date ≤ aujourd’hui · mois futur : tous cochés.
 */
export function countAgendaWorkDaysInMonth(
  selected: ReadonlySet<string>,
  year: number,
  month0: number,
  refDate = new Date()
): number {
  const nowY = refDate.getFullYear();
  const nowM0 = refDate.getMonth();
  const todayIso = toBillableIso(nowY, nowM0, refDate.getDate());
  const prefix = `${year}-${String(month0 + 1).padStart(2, "0")}-`;
  const isPast = year < nowY || (year === nowY && month0 < nowM0);
  const isCurrent = year === nowY && month0 === nowM0;

  let n = 0;
  for (const iso of selected) {
    if (!iso.startsWith(prefix)) continue;
    if (isPast) n++;
    else if (isCurrent) {
      if (iso <= todayIso) n++;
    } else {
      n++;
    }
  }
  return n;
}

export type WorkedDaysChartQuarterFilter = "full" | 1 | 2 | 3 | 4;

function monthKeyFromYm(y: number, month0: number): string {
  return `${y}-${String(month0 + 1).padStart(2, "0")}`;
}

/** Mois civils couverts par le filtre année / trimestre du graphique « Jours facturés ». */
export function listMonthsInWorkedDaysChartFilter(
  year: number | "all",
  quarter: WorkedDaysChartQuarterFilter,
  /** Clés YYYY-MM de la série encaissée (sans filtre) — sert de borne quand année = toutes. */
  seriesMonthKeys: readonly string[],
  refDate = new Date()
): { y: number; m0: number }[] {
  if (year === "all") {
    const seen = new Set<string>();
    const months: { y: number; m0: number }[] = [];
    const addKey = (mk: string) => {
      if (seen.has(mk)) return;
      seen.add(mk);
      months.push({
        y: Number(mk.slice(0, 4)),
        m0: Number(mk.slice(5, 7)) - 1
      });
    };
    for (const mk of seriesMonthKeys) addKey(mk);
    const cy = refDate.getFullYear();
    const cm0 = refDate.getMonth();
    const last = cm0 === 0 ? { y: cy - 1, m0: 11 } : { y: cy, m0: cm0 - 1 };
    addKey(monthKeyFromYm(last.y, last.m0));
    addKey(monthKeyFromYm(cy, cm0));
    months.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.m0 - b.m0));
    return months;
  }

  let mStart0 = 0;
  let mEnd0 = 11;
  if (quarter !== "full") {
    mStart0 = (quarter - 1) * 3;
    mEnd0 = mStart0 + 2;
  }
  const months: { y: number; m0: number }[] = [];
  for (let m0 = mStart0; m0 <= mEnd0; m0++) {
    months.push({ y: year, m0 });
  }
  return months;
}

/** Total jours cochés agenda sur la période du filtre graphique (mêmes règles que `countAgendaWorkDaysInMonth`). */
export function countAgendaWorkDaysInPeriod(
  selected: ReadonlySet<string>,
  year: number | "all",
  quarter: WorkedDaysChartQuarterFilter,
  seriesMonthKeys: readonly string[],
  refDate = new Date()
): number {
  const months = listMonthsInWorkedDaysChartFilter(year, quarter, seriesMonthKeys, refDate);
  let total = 0;
  for (const { y, m0 } of months) {
    total += countAgendaWorkDaysInMonth(selected, y, m0, refDate);
  }
  return total;
}

export function workedDaysChartPeriodLabel(
  year: number | "all",
  quarter: WorkedDaysChartQuarterFilter
): string {
  if (year === "all") return "toute la période";
  if (quarter === "full") return String(year);
  return `T${quarter} ${year}`;
}

export function computeCalendarStickyKpis(
  selected: ReadonlySet<string>,
  tjmHt: number,
  viewYear: number,
  viewMonth0: number,
  refDate = new Date()
): ActivityOverviewKpis {
  const gauge = computeTjmWorkdayGauge(selected, viewYear, viewMonth0, refDate);
  const jours = gauge.countedBillable;
  const caEstime = jours * tjmHt;
  const resteAFacturer = Math.max(0, gauge.totalBillableMonth - jours) * tjmHt;
  const projectionFinMois = gauge.totalBillableMonth * tjmHt;
  return { jours, caEstime, resteAFacturer, projectionFinMois };
}

export function computeCurrentMonthOverview(
  selected: ReadonlySet<string>,
  billableRatePeriods: readonly BillableRatePeriod[],
  fallbackTjmHt: number,
  refDate = new Date()
): {
  monthTitle: string;
  kpis: ActivityOverviewKpis;
  workdayGauge: ActivityWorkdayGauge;
  tjmEnVigueurHt: number;
} {
  const y = refDate.getFullYear();
  const m0 = refDate.getMonth();
  const monthKey = monthKeyFromYm(y, m0);
  const tjmEnVigueurHt = resolveBillableTjmForClientMonth(
    billableRatePeriods,
    billableRatePeriods[0]?.clientName ?? "",
    monthKey,
    fallbackTjmHt
  );
  const gauge = computeTjmWorkdayGauge(selected, y, m0, refDate);
  return {
    monthTitle: monthTitleFr(y, m0),
    kpis: computeCalendarStickyKpis(selected, tjmEnVigueurHt, y, m0, refDate),
    workdayGauge: gauge,
    tjmEnVigueurHt
  };
}

/** CA HT estimé sur l’activité agenda (jours ouvrés cochés × TJM), pas l’encaissé. */
export function computeMonthActivityCaHt(
  selected: ReadonlySet<string>,
  billableRatePeriods: readonly BillableRatePeriod[],
  fallbackTjmHt: number,
  monthKey: string,
  refDate = new Date()
): { caHtEur: number; billableDays: number; tjmHt: number } {
  const [y, m] = monthKey.split("-").map((part) => Number(part));
  const month0 = (m || 1) - 1;
  const tjmHt = resolveBillableTjmForClientMonth(
    billableRatePeriods,
    billableRatePeriods[0]?.clientName ?? "",
    monthKey,
    fallbackTjmHt
  );
  const gauge = computeTjmWorkdayGauge(selected, y, month0, refDate);
  const caHtEur = Math.round(gauge.countedBillable * tjmHt * 100) / 100;
  return { caHtEur, billableDays: gauge.countedBillable, tjmHt };
}
