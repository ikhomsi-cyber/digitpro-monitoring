import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMobileOverview, expenseChangePercent, mobileBalanceComparison } from "@/lib/mobile/overview";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { analyzeLmnp } from "@/lib/lmnp-analyze";
import { summarizeNdfDigitProForMonth } from "@/lib/ndf-digitpro";
const activity = { days: [], rates: [], tjm: 820 };
const now = new Date(2026, 7, 20, 12);
const tx: DashboardTx = { id: "1", date: "2026-08-15", label: "Client", category: "Chiffre d’affaires",
  amount: 12000, balance: 24000, company: "Qonto", scope: "pro" };
afterEach(() => vi.useRealTimers());
describe("mobile business contract", () => {
  it("uses web business calculations and isolates professional turnover", () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const rows: DashboardTx[] = [tx, { ...tx, id: "personal", scope: "personal", amount: 99999 }];
    const result = buildMobileOverview(rows, activity, now);
    expect(result.dashboard).toEqual(computeDashboardHeroStats(rows, now));
    expect(result.dashboard.caMensuelEur).toBe(12000);
    expect(result.lmnp).toEqual(analyzeLmnp(rows));
    expect(result.ndf).toEqual(summarizeNdfDigitProForMonth(rows, "2026-08"));
    expect(result.balanceSource).toBe("imported");
    expect(result.version).toBe(1);
    expect(result.forecast.monthlySeries).toHaveLength(12);
    expect(result.widget).toMatchObject({ revenueTtcEur: 12000, revenueHtEur: 10000, workedDays: 0,
      securedRevenueHtEur: 0 });
    expect(result.activityMonths.at(-1)).toMatchObject({ month: "2026-08", revenueHtEur: 10000,
      workedDays: 0, tjmHtEur: 820 });
  });
  it("preserves unknown cash and empty history instead of inventing a bank balance", () => {
    const result = buildMobileOverview([], activity, now);
    expect(result.dashboard.soldeQontoEur).toBeNull();
    expect(result.transactionCount).toBe(0);
    expect(result.ndf.totalEur).toBe(0);
    expect(result.dashboard.caMensuelEur).toBe(0);
    expect(result.widget).toMatchObject({ revenueTtcEur: 0, revenueHtEur: 0, workedDays: 0,
      securedRevenueHtEur: 0, digitProExpensesEur: 0, personalExpensesEur: 0 });
    expect(result.activityMonths).toHaveLength(8);
  });
  it("uses the same worked-day and secured-revenue rules as the web activity", () => {
    const result = buildMobileOverview([], { days: ["2026-08-03", "2026-08-04", "2026-08-25"], rates: [], tjm: 820 }, now);
    expect(result.widget.workedDays).toBe(2);
    expect(result.widget.securedRevenueHtEur).toBe(1640);
  });
});

describe("widget expense comparison", () => {
  it("handles increase, decrease and zero baselines", () => {
    expect(expenseChangePercent(150, 100)).toBe(50);
    expect(expenseChangePercent(75, 100)).toBe(-25);
    expect(expenseChangePercent(0, 100)).toBe(-100);
    expect(expenseChangePercent(0, 0)).toBe(0);
    expect(expenseChangePercent(100, 0)).toBeNull();
  });
  it("uses the web calendar fallback when invoices are unavailable", () => {
    expect(buildMobileOverview([], activity, now).widget.outstandingInvoiceHtEur).toBe(0);
    expect(buildMobileOverview([], { ...activity, invoices: [] }, now).widget.outstandingInvoiceHtEur).toBe(0);
  });
});

describe("dashboard period comparisons", () => {
  it("compares Qonto balances, ignoring revenue, personal and other banks", () => {
    const rows = [tx, { ...tx, id: "previous", date: "2026-07-31", balance: 20000 },
      { ...tx, id: "other", company: "Other", date: "2026-07-31", balance: 999999 },
      { ...tx, id: "personal", scope: "personal" as const, date: "2026-07-31", balance: 777777 }];
    expect(mobileBalanceComparison(rows, now)).toEqual({ deltaEur: 4000, percent: 20 });
    expect(mobileBalanceComparison([tx], now)).toBeNull();
    expect(mobileBalanceComparison([tx, { ...tx, id: "zero", date: "2026-07-31", balance: 0 }], now))
      .toEqual({ deltaEur: 24000, percent: null });
  });
  it("compares calendar years including expenses outside the rolling window", () => {
    const expense = { ...tx, category: "Qonto", categoryManual: true, label: "Qonto", amount: -120 };
    const result = buildMobileOverview([expense, { ...expense, id: "old", date: "2025-01-10", amount: -60 }], activity, now);
    const year = result.expenses.years.find(row => row.month === "2026")!;
    expect(year.totalTtc).toBe(120);
    expect(year.digitProChangePercent).toBe(100);
    expect(result.expenses.years.find(row => row.month === "2025")!.totalTtc).toBe(60);
    expect(result.expenses.months.at(-1)!.digitProChangePercent).toBeNull();
  });
});

it("uses business meals TTC for forecast notes de frais and reconciles total payouts", () => {
  const expense = (id: string, category: string, amount: number, date = "2026-08-10"): DashboardTx =>
    ({ id, date, amount, category, label: category, categoryManual: true, company: "Qonto", scope: "pro" });
  const result = buildMobileOverview([
    expense("meal", "Repas d'affaire", -110),
    expense("other-meal", "Repas dirigeant", -55),
    expense("ndf", "NDF", -220),
    expense("old", "Repas d'affaire", -90, "2026-07-31"),
    expense("refund", "Repas d'affaire", 110),
    { ...expense("personal", "Repas d'affaire", -500), scope: "personal" },
    expense("bnc", "BNC", -1000), expense("ik", "Indemnités kilométriques", -200)
  ], activity, now);
  expect(result.treasury).toMatchObject({ ndfMois: 110, bncMois: 1000, ikMois: 200, verseCeMois: 1310 });
});

 it("matches web upcoming receipts and billed turnover including Gmail invoices", async () => {
  const { computeUpcomingInvoice } = await import("@/lib/upcoming-invoice");
  const { computeYearToDateInvoicingTotals } = await import("@/lib/invoice-worked-days-series");
  const invoices = [{ id: "gmail", date: "2026-07-20", amountEur: 6000, amountKind: "HT" as const, client: null, billedDays: 10, tjmHtEur: 600, subject: "Facture" }];
  const days = ["2026-07-01", "2026-07-02"];
  const result = buildMobileOverview([], { ...activity, days, invoices }, now);
  const web = computeUpcomingInvoice({ selectedWorkDayIsos: new Set(days), billableRatePeriods: [], fallbackTjmHt: 820, hiwayInvoices: invoices, now });
  expect(result.upcomingInvoice).toEqual(web);
  expect(result.widget.outstandingInvoiceHtEur).toBe(6000);
  expect(result.widget.nextPaymentDays).toBe(web.dueInDays);
  expect(result.widget.outstandingInvoiceHtEur).toBe(web.amountHtEur);
  expect(result.generatedRevenueHtEur).toBe(computeYearToDateInvoicingTotals([], new Set(days), [], 820, now, invoices).factureHtEur);
 });
