import { describe, expect, it } from "vitest";
import { buildMobileActivity, buildMobileActivityMonth } from "@/lib/mobile/activity";
import { computeCalendarStickyKpis } from "@/lib/billable-calendar-metrics";
import type { DashboardTx } from "@/lib/dashboard-metrics";

const now = new Date(2026, 8, 21, 12);
const transactions: DashboardTx[] = [{
  id: "revenue", date: "2026-09-10", label: "Skylab", category: "Chiffre d’affaires",
  amount: 9_840, company: "Qonto", scope: "pro"
}];
const activity = {
  workDays: ["2026-09-01", "2026-09-02", "2026-09-22"],
  vacationDays: ["2026-09-03"],
  commuteDays: ["2026-09-01"],
  mileageExtraKmByMonth: { "2026-09": 42.5 },
  tjm: 820,
  annualTarget: 120_000,
  rates: [{ clientName: "Skylab", startDate: "2026-09-01", endDate: null, tjmHt: 900 }]
};

describe("mobile activity", () => {
  it("shares calendar KPIs, rates and day states with the web", () => {
    const result = buildMobileActivity(transactions, activity, "2026-09", now);
    expect(result.currentTjmHt).toBe(900);
    expect(result.kpis).toEqual(computeCalendarStickyKpis(new Set(activity.workDays), 900, 2026, 8, now));
    expect(result.kpis.jours).toBe(2);
    expect(result.days.find(day => day.iso === "2026-09-01")).toMatchObject({ worked: true, commute: true, billable: true });
    expect(result.days.find(day => day.iso === "2026-09-03")?.vacation).toBe(true);
    expect(result.mileageExtraKm).toBe(42.5);
  });

  it("uses the web productivity, target and pace rules", () => {
    const result = buildMobileActivity(transactions, activity, "2026-09", now);
    expect(result.productivity.workedDays).toBe(3);
    expect(result.productivity.averageDaysPerMonth).toBe(0.3);
    expect(result.annualObjective).toMatchObject({ targetHtEur: 120_000, remainingHtEur: 111_800 });
    expect(result.pace.expectedWorkedDays).toBe(3.6);
    expect(result.history.length).toBeGreaterThan(0);
  });
  it("builds a lightweight month without financial transactions", () => {
    const result = buildMobileActivityMonth(activity, "2026-09", now);
    expect(result).toMatchObject({ month: "2026-09", currentTjmHt: 900, mileageExtraKm: 42.5 });
    expect(result.days).toHaveLength(30);
    expect(result.kpis.jours).toBe(2);
    expect(result).not.toHaveProperty("history");
    expect(result).not.toHaveProperty("performance");
  });
});

it("keeps future checked days planned, with zero completed days and secured turnover", () => {
  const planned = { ...activity, workDays: ["2026-10-01", "2026-10-02", "2027-01-04"] };
  for (const month of ["2026-10", "2027-01"]) {
    const result = buildMobileActivityMonth(planned, month, now);
    expect(result.kpis.jours).toBe(0);
    expect(result.kpis.caEstime).toBe(0);
    expect(result.gauge.countedBillable).toBe(0);
    expect(result.gauge.totalBillableMonth).toBe(month === "2026-10" ? 2 : 1);
    expect(result.gauge.remainingBillable).toBe(result.gauge.totalBillableMonth);
    expect(result.days.filter(day => day.worked)).toHaveLength(result.gauge.totalBillableMonth);
    expect(result.kpis.projectionFinMois).toBeGreaterThan(0);
  }
});
it("counts checked past days and today, excluding later days of the current month", () => {
  const selected = { ...activity, workDays: ["2026-08-03", "2026-09-01", "2026-09-21", "2026-09-22"] };
  expect(buildMobileActivityMonth(selected, "2026-08", now).kpis.jours).toBe(1);
  const result = buildMobileActivityMonth(selected, "2026-09", now);
  expect(result.kpis.jours).toBe(2);
  expect(result.gauge).toMatchObject({ countedBillable: 2, totalBillableMonth: 3, remainingBillable: 1 });
  expect(result.kpis.caEstime).toBe(1800);
});
