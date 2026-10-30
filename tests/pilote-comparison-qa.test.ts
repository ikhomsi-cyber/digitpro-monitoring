import { describe, expect, it } from "vitest";
import { buildBankinPiloteSnapshot, type BankinPiloteRow } from "@/lib/pilote";
import { buildPiloteComparisonAtDate, buildPiloteMonthlyComparison, type PiloteMonthlyComparison } from "@/lib/bankin/pilote-comparison";

let nextId = 1000;
const row = (date: string, amount: number, parentCategory = "Alimentation", subCategory = "Courses", hidden = false): BankinPiloteRow => ({ sourceRow: nextId++, date, amount, parentCategory, subCategory, hidden });
const snapshot = (rows: BankinPiloteRow[]) => buildBankinPiloteSnapshot(rows, "qa-synthetic.xlsx", "qa-fixture");
function ready(value: PiloteMonthlyComparison) {
  expect(value.status).toBe("ready");
  if (value.status !== "ready") throw new Error("Expected a comparable synthetic period");
  return value;
}

describe("independent Pilote comparison QA", () => {
  it("compares 25 October with 25 September while preserving the full-month report", () => {
    const report = snapshot([row("2026-09-01", -100), row("2026-09-25", -25), row("2026-09-26", -900), row("2026-10-01", -120), row("2026-10-25", -30), row("2026-10-26", -700)]);
    const before = JSON.stringify(report);
    const comparison = ready(buildPiloteMonthlyComparison(report.months, "2026-10", ["essential"], "2026-10-25", buildPiloteComparisonAtDate(report, "2026-10-25")));
    expect(comparison.current).toMatchObject({ start: "2026-10-01", end: "2026-10-25", expenses: 150 });
    expect(comparison.previous).toMatchObject({ start: "2026-09-01", end: "2026-09-25", expenses: 125 });
    expect(comparison.delta).toBe(25); expect(comparison.percent).toBe(20);
    expect(comparison.categories).toEqual([{ name: "Alimentation", current: 150, previous: 125, delta: 25 }]);
    expect(report.months.find(month => month.month === "2026-10")?.expenses).toBe(850);
    expect(JSON.stringify(report)).toBe(before);
  });

  it.each([["2026", 28], ["2024", 29]] as const)("caps the preceding February correctly in %s", (year, lastDay) => {
    const report = snapshot([row(`${year}-02-${lastDay}`, -75), row(`${year}-03-31`, -100)]);
    const today = `${year}-03-31`;
    const comparison = ready(buildPiloteMonthlyComparison(report.months, `${year}-03`, ["essential"], today, buildPiloteComparisonAtDate(report, today)));
    expect(comparison.previous.end).toBe(`${year}-02-${lastDay}`);
    expect(comparison.previous.expenses).toBe(75); expect(comparison.current.expenses).toBe(100);
  });

  it("uses complete historical months and crosses the calendar year", () => {
    const report = snapshot([row("2025-12-31", -150), row("2026-01-01", -30), row("2026-01-31", -90)]);
    const comparison = ready(buildPiloteMonthlyComparison(report.months, "2026-01", ["essential"], "2026-10-25"));
    expect(comparison.atDate).toBe(false);
    expect(comparison.previous).toMatchObject({ month: "2025-12", start: "2025-12-01", end: "2025-12-31", expenses: 150 });
    expect(comparison.current).toMatchObject({ end: "2026-01-31", expenses: 120 });
    expect(comparison.delta).toBe(-30); expect(comparison.percent).toBe(-20);
  });

  it("never substitutes the last available month for a missing adjacent month", () => {
    const report = snapshot([row("2026-07-01", -10), row("2026-09-01", -30)]);
    expect(buildPiloteMonthlyComparison(report.months, "2026-09", ["essential"], "2026-10-25")).toEqual({ status: "unavailable", reason: "missing-month" });
    expect(buildPiloteMonthlyComparison(report.months, "2026-11", ["essential"], "2026-10-25")).toEqual({ status: "unavailable", reason: "future" });
  });

  it("requires current-day detailed aggregates and withholds percentages on a zero expense baseline", () => {
    const report = snapshot([row("2026-09-01", 200, "Autres", "Cashback"), row("2026-10-01", -30)]);
    expect(buildPiloteMonthlyComparison(report.months, "2026-10", ["essential"], "2026-10-25")).toEqual({ status: "unavailable", reason: "missing-daily" });
    const atDate = buildPiloteComparisonAtDate(report, "2026-10-25");
    const comparison = ready(buildPiloteMonthlyComparison(report.months, "2026-10", ["essential"], "2026-10-25", atDate));
    expect(comparison.previous.expenses).toBe(0); expect(comparison.delta).toBe(30); expect(comparison.percent).toBeNull();
    expect(buildPiloteMonthlyComparison(report.months, "2026-10", ["essential"], "2026-10-26", atDate)).toEqual({ status: "unavailable", reason: "missing-daily" });
    expect(buildPiloteComparisonAtDate({ ...report, rows: undefined }, "2026-10-25")).toBeNull();
  });

  it("shares exclusions, selected expense views and shifted rent rules without leaking source detail", () => {
    const duplicate = row("2026-10-04", -50);
    const report = snapshot([row("2026-09-01", -40), row("2026-09-01", -10, "Voyage", "Hôtel"), row("2026-09-29", 300, "Entrées", "Loyers reçus"), duplicate, { ...duplicate }, row("2026-10-04", -500, "Alimentation", "Courses", true), row("2026-10-04", -500, "Virements internes", "Interne"), row("2026-10-03", -200, "Voyage", "Hôtel"), row("2026-10-02", -300, "Loisirs", "Jeux"), row("2026-07-09", -1315.2, "Voyage Minorque 26", "Hôtel - 14j")]);
    const atDate = buildPiloteComparisonAtDate(report, "2026-10-25")!;
    expect(atDate.months.find(month => month.month === "2026-10")?.income).toBe(300);
    expect(atDate.months.find(month => month.month === "2026-09")?.income).toBe(0);
    const essential = ready(buildPiloteMonthlyComparison(report.months, "2026-10", ["essential"], "2026-10-25", atDate));
    expect(essential.current.expenses).toBe(50); expect(essential.previous.expenses).toBe(40);
    const travel = ready(buildPiloteMonthlyComparison(report.months, "2026-10", ["travel"], "2026-10-25", atDate));
    expect(travel.current.expenses).toBe(200); expect(travel.previous.expenses).toBe(10);
    expect(JSON.stringify(atDate)).not.toMatch(/sourceRow|identity|hidden|sourceFilename|fileHash/);
  });

  it("shows at most three category contributions and retains the unexplained remainder exactly", () => {
    const report = snapshot([row("2026-09-01", -10, "Logement", "Loyer"), row("2026-09-01", -10, "Alimentation", "Courses"), row("2026-09-01", -10, "Transports", "Bus"), row("2026-09-01", -10, "Santé", "Soins"), row("2026-10-01", -50, "Logement", "Loyer"), row("2026-10-01", -40, "Alimentation", "Courses"), row("2026-10-01", -30, "Transports", "Bus"), row("2026-10-01", -20, "Santé", "Soins")]);
    const result = ready(buildPiloteMonthlyComparison(report.months, "2026-10", ["essential"], "2026-10-25", buildPiloteComparisonAtDate(report, "2026-10-25")));
    expect(result.categories).toHaveLength(3);
    expect(result.categories.map(category => category.delta)).toEqual([40, 30, 20]);
    expect(result.otherDelta).toBe(10);
    expect(result.categories.reduce((sum, category) => sum + category.delta, result.otherDelta)).toBe(result.delta);
  });
});
