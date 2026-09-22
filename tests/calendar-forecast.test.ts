import { expect, it } from "vitest";
import { computeYearEndProjection } from "@/lib/year-end-projection";

const input = {
  selectedWorkDayIsos: ["2026-09-28", "2026-10-01", "2026-10-02"],
  billableRatePeriods: [], fallbackTjmHt: 800,
  tjmRepartition: { caHtEur: 1000, bncEur: 500, fraisPersoEur: 100, csgEur: 100 },
  soldeQontoEur: 10000, detteTotaleEur: 1000, statsReady: true,
  useCalendarPlan: true, now: new Date(2026, 8, 21)
};
it("projects checked days only, including the rest of the current month", () => {
  const result = computeYearEndProjection(input);
  expect(result.projectedRevenueHtEur).toBe(2400);
  expect(result.monthlySeries[8].revenueHt).toBe(800);
  expect(result.monthlySeries[9].revenueHt).toBe(1600);
  expect(result.monthlySeries[10].revenueHt).toBe(0);
  expect(result.monthlySeries.at(-1)?.cumulativeHt).toBe(result.projectedRevenueHtEur);
});
it("removing a checked day changes both the trajectory and annual total", () => {
  const result = computeYearEndProjection({ ...input, selectedWorkDayIsos: ["2026-09-28", "2026-10-01"] });
  expect(result.projectedRevenueHtEur).toBe(1600);
  expect(result.monthlySeries[9].revenueHt).toBe(800);
});
it("does not add calendar revenue twice to current month receipts", () => {
  const result = computeYearEndProjection({ ...input, transactions: [{ id: "paid", date: "2026-09-10", category: "Chiffre d’affaires", label: "Client", amount: 1200, company: "Qonto", scope: "pro" }] });
  expect(result.monthlySeries[8].revenueHt).toBe(1000);
  expect(result.projectedRevenueHtEur).toBe(2600);
});
