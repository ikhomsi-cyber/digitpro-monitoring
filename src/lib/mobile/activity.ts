import { computeActivityBillingPaceProjection } from "@/lib/activity-billing-pace-projection";
import { computeActivityProductivitySummary } from "@/lib/activity-productivity";
import { computeActivityTjmPerformance } from "@/lib/activity-tjm-performance";
import { computeAnnualObjectiveTracking } from "@/lib/annual-objective";
import {
  computeAgendaBillableGauge,
  computeCalendarStickyKpis,
  isBillableWorkdayIso,
  listMonthDayIsos,
  monthTitleFr
} from "@/lib/billable-calendar-metrics";
import {
  BILLABLE_CLIENT_TJM_HT,
  resolveBillableTjmForMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";
import { computeDashboardHeroStats, type DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { getFrenchPublicHolidaysForYear } from "@/lib/fr-public-holidays";
import { getParisZoneCSchoolVacationLabel } from "@/lib/fr-school-holidays-paris";
import {
  appendAgendaWorkedDayMonths,
  buildInvoiceWorkedDaysPastMonthsSeries
} from "@/lib/invoice-worked-days-series";

export type MobileActivityInput = {
  workDays: string[];
  vacationDays: string[];
  commuteDays: string[];
  mileageExtraKmByMonth: Record<string, number>;
  tjm: number | null;
  annualTarget: number | null;
  rates: BillableRatePeriod[];
};

export function buildMobileActivityMonth(
  activity: Pick<MobileActivityInput, "workDays" | "vacationDays" | "commuteDays" | "mileageExtraKmByMonth" | "tjm" | "rates">,
  monthKey: string,
  now = new Date()
) {
  const year = Number(monthKey.slice(0, 4));
  const month0 = Number(monthKey.slice(5, 7)) - 1;
  const workDays = new Set(activity.workDays);
  const vacationDays = new Set(activity.vacationDays);
  const commuteDays = new Set(activity.commuteDays);
  const fallbackTjm = activity.tjm ?? BILLABLE_CLIENT_TJM_HT;
  const currentTjm = resolveBillableTjmForMonth(activity.rates, monthKey, fallbackTjm);
  const holidays = getFrenchPublicHolidaysForYear(year);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // Future checked dates are planning, never work already completed.
  // Keep the full selection for the calendar and forecast denominator.
  const completedDays = new Set(activity.workDays.filter(iso => iso <= today));
  const gauge = computeAgendaBillableGauge(workDays, year, month0, now);
  const completedGauge = computeAgendaBillableGauge(completedDays, year, month0, now);
  gauge.countedBillable = completedGauge.countedBillable;
  gauge.remainingBillable = Math.max(0, gauge.totalBillableMonth - gauge.countedBillable);
  return {
    version: 1,
    generatedAt: now.toISOString(),
    month: monthKey,
    monthTitle: monthTitleFr(year, month0),
    today,
    currentTjmHt: currentTjm,
    mileageExtraKm: activity.mileageExtraKmByMonth[monthKey] ?? 0,
    kpis: computeCalendarStickyKpis(completedDays, currentTjm, year, month0, now),
    gauge,
    days: listMonthDayIsos(year, month0).map(iso => ({
      iso,
      day: Number(iso.slice(8, 10)),
      weekday: new Date(year, month0, Number(iso.slice(8, 10))).getDay(),
      billable: isBillableWorkdayIso(iso, holidays),
      worked: workDays.has(iso),
      vacation: vacationDays.has(iso),
      commute: commuteDays.has(iso),
      holiday: holidays.get(iso) ?? null,
      schoolVacation: getParisZoneCSchoolVacationLabel(iso) ?? null
    }))
  };
}

export function buildMobileActivity(
  transactions: DashboardTx[],
  activity: MobileActivityInput,
  monthKey: string,
  now = new Date()
) {
  const workDays = new Set(activity.workDays);
  const fallbackTjm = activity.tjm ?? BILLABLE_CLIENT_TJM_HT;
  const month = buildMobileActivityMonth(activity, monthKey, now);
  const dashboard: DashboardHeroStats = computeDashboardHeroStats(transactions, now);
  const history = appendAgendaWorkedDayMonths(
    buildInvoiceWorkedDaysPastMonthsSeries(transactions, "pro", now, 12, activity.rates, fallbackTjm),
    workDays,
    activity.rates,
    fallbackTjm,
    now
  ).slice(-12);

  return {
    ...month,
    annualTargetHt: activity.annualTarget,
    productivity: computeActivityProductivitySummary({
      selected: workDays, viewYear: Number(monthKey.slice(0, 4)), billableRatePeriods: activity.rates,
      fallbackTjmHt: fallbackTjm, currentTjmHt: month.currentTjmHt, now
    }),
    performance: computeActivityTjmPerformance({
      selected: workDays, billableRatePeriods: activity.rates,
      fallbackTjmHt: fallbackTjm,
      currentTjmHt: resolveBillableTjmForMonth(
        activity.rates,
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        fallbackTjm
      ),
      now
    }),
    pace: computeActivityBillingPaceProjection({
      selected: workDays, billableRatePeriods: activity.rates,
      fallbackTjmHt: fallbackTjm, currentTjmHt: month.currentTjmHt,
      tjmRepartition: dashboard.tjmRepartitionMois, now
    }),
    annualObjective: computeAnnualObjectiveTracking(activity.annualTarget, dashboard.caAnnuelEncaisseHtEur, now),
    history
  };
}
