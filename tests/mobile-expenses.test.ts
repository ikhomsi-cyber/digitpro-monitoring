import { describe, it, expect } from "vitest";
import { buildMobileExpenses, mobileExpenseDetail } from "@/lib/mobile/expenses";
import { computeDerivedExpenseCategoryMonthlyBreakdown, expenseCategoryColor, type DashboardTx } from "@/lib/dashboard-metrics";
const now = new Date(2026, 8, 21, 12);
const tx = (id: string, category: string, amount: number, patch: Partial<DashboardTx> = {}): DashboardTx => ({
  id, date: "2026-09-10", label: category, category, amount, company: "Qonto", scope: "pro", categoryManual: true, ...patch
});
describe("mobile expense categories", () => {
  it("shares HT/TTC grouping with the web and excludes personal, BNC, TVA and credits", () => {
    const rows = [tx("admin", "Compta & admin.", -120), tx("meal", "Repas dirigeant", -110),
      tx("bnc", "BNC", -500), tx("vat", "TVA", -200), tx("personal", "Compta & admin.", -900, { scope: "personal" }),
      tx("credit", "Compta & admin.", 120), tx("old", "Compta & admin.", -400, { date: "2025-08-10" })];
    const result = buildMobileExpenses(rows, now);
    const month = result.months.at(-1)!;
    expect(result.months).toHaveLength(12);
    // The web intentionally keeps meals TTC in Dashboard amounts.
    expect(month.totalHt).toBe(210);
    expect(month.totalTtc).toBe(230);
    expect(month.categories.map(c => c.name).sort()).toEqual(["Compta & admin.", "Repas dirigeant"]);
    const web = computeDerivedExpenseCategoryMonthlyBreakdown(rows.filter(r => r.scope === "pro"), { years: null, useExpenseHt: true }, now);
    for (const category of month.categories) {
      expect(category.amountHt).toBe(web.rows.at(-1)!.values[category.name]);
      expect(category.color).toBe(expenseCategoryColor(category.name));
      expect(category.count).toBe(1);
    }
  });
  it("preserves manual categories over merchant heuristics and reconciles detail to summary", () => {
    const rows = [tx("a", "Matériel", -120, { label: "Hiway", date: "2026-08-31" }), tx("b", "Matériel", -60)];
    const data = buildMobileExpenses(rows, now);
    const detail = mobileExpenseDetail(rows, "Matériel", "all", 0, now);
    expect(detail.totalHt).toBe(data.months.reduce((sum, month) => sum + month.totalHt, 0));
    expect(detail.totalTtc).toBe(180);
    expect(detail.transactions.map(t => t.id)).toEqual(["b", "a"]);
    expect(mobileExpenseDetail(rows, "Matériel", "2026-09", 0, now).totalTtc).toBe(60);
  });
  it("paginates details deterministically with full-category totals", () => {
    const rows = Array.from({ length: 101 }, (_, i) => tx(String(i).padStart(3, "0"), "Qonto", -12));
    const first = mobileExpenseDetail(rows, "Qonto", "2026-09", 0, now);
    const next = mobileExpenseDetail(rows, "Qonto", "2026-09", 1, now);
    expect(first.transactions).toHaveLength(100);
    expect(first.nextPage).toBe(1);
    expect(next.transactions).toHaveLength(1);
    expect(next.nextPage).toBeNull();
    expect(first.totalHt).toBe(1010);
    expect(next.totalTtc).toBe(1212);
    expect(new Set([...first.transactions, ...next.transactions].map(t => t.id)).size).toBe(101);
  });
  it("returns twelve empty months without invented categories or amounts", () => {
    const result = buildMobileExpenses([], now);
    expect(result.months).toHaveLength(12);
    expect(result.months.every(m => m.totalHt === 0 && m.totalTtc === 0 && !m.categories.length)).toBe(true);
  });
});

it("returns annual detail and recoverable VAT recap, including meals and exempt expenses", () => {
  const rows = [tx("meal", "Repas dirigeant", -110, { date: "2025-01-12" }),
    tx("insurance", "Assurance", -100, { date: "2025-01-13", company: "Assureur" })];
  const meal = mobileExpenseDetail(rows, "Repas dirigeant", "2025", 0, now);
  expect(meal).toMatchObject({ total: 1, totalTtc: 110, taxNetTotal: 100, recoverableVat: 10 });
  expect(mobileExpenseDetail(rows, "Assurance", "2025", 0, now))
    .toMatchObject({ totalTtc: 100, taxNetTotal: 100, recoverableVat: 0 });
  expect(mobileExpenseDetail(rows, "Repas dirigeant", "all", 0, now).total).toBe(0);
});
