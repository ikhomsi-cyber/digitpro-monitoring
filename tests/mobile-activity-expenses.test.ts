import { expect, it } from "vitest";
import { mobileActivityExpenses } from "@/lib/mobile/activity-expenses";
import { annualMileageAllowanceEur } from "@/lib/pluxee-commute-indemnity";
import type { MobileActivityInput } from "@/lib/mobile/activity";
import type { DashboardTx } from "@/lib/dashboard-metrics";
const now = new Date(2026, 8, 22);
const activity: MobileActivityInput = { workDays: [], vacationDays: [], commuteDays: ["2026-09-01", "2026-09-01", "2026-09-25"], mileageExtraKmByMonth: { "2026-08": 4990, "2026-09": 10, "2026-10": 100 }, tjm: 820, annualTarget: null, rates: [] };
it("uses annual mileage tiers and excludes future or duplicate commute dates", () => {
  const data = mobileActivityExpenses([], activity, "2026-09", now);
  expect(data["2026-09"].commuteDays).toBe(1);
  expect(data["2026-09"].km).toBe(53.9);
  expect(data["2026-09"].ikEur).toBe(Math.round((annualMileageAllowanceEur(5043.9) - annualMileageAllowanceEur(4990)) * 100) / 100);
  expect(data["2026-10"].ikEur).toBe(0);
  expect(data["2026-10"].km).toBe(0);
});
it("shows only validated personal NDF of the month, deduplicated like the web", () => {
  const tx: DashboardTx = { id: "a", date: "2026-09-10", label: "Restaurant", amount: -22, category: "NDF DigitPro", categoryManual: true, scope: "personal", company: "Powens" };
  const result = mobileActivityExpenses([tx, { ...tx, id: "duplicate" }, { ...tx, id: "pro", scope: "pro", amount: -100 }, { ...tx, id: "unvalidated", categoryManual: false, amount: -200 }, { ...tx, id: "future", date: "2026-09-28", amount: -300 }], activity, "2026-09", now);
  expect(result["2026-09"].ndf.totalEur).toBe(22);
  expect(result["2026-09"].ndf.transactions).toHaveLength(1);
});
