import { getFrenchPublicHolidaysForYear } from "@/lib/fr-public-holidays";
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
  tjmHt: number,
  refDate = new Date()
): {
  monthTitle: string;
  kpis: ActivityOverviewKpis;
  workdayGauge: ActivityWorkdayGauge;
} {
  const y = refDate.getFullYear();
  const m0 = refDate.getMonth();
  const gauge = computeTjmWorkdayGauge(selected, y, m0, refDate);
  return {
    monthTitle: monthTitleFr(y, m0),
    kpis: computeCalendarStickyKpis(selected, tjmHt, y, m0, refDate),
    workdayGauge: gauge
  };
}
