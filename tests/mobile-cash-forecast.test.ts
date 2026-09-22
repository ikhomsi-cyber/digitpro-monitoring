import { expect, it } from "vitest";
import { mobileCashForecast } from "@/lib/mobile/cash-forecast";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
const tx = (date: string, amount: number, label = "Frais"): DashboardTx => ({ id: date + label, date, amount, label, category: label, company: "Qonto", scope: "pro" });
const invoice = (date: string, amountEur: number): HiwayInvoice => ({ id: date, date, amountEur, amountKind: "HT", client: null, billedDays: null, tjmHtEur: null, subject: "Facture" });
const base = { transactions: [] as DashboardTx[], invoices: [] as HiwayInvoice[], days: [] as string[], rates: [], tjm: 1000, balance: 10000, now: new Date(2026, 8, 30) };
it("shows actual BNC paid YTD, excluding future, prior year and personal entries", () => {
  const result = mobileCashForecast({ ...base, transactions: [tx("2026-01-15", -1000, "BNC"), tx("2026-09-30", -2000, "BNC"), tx("2026-12-01", -5000, "BNC"), tx("2025-01-01", -6000, "BNC"), { ...tx("2026-01-16", -7000, "BNC"), scope: "personal" }] });
  expect(result.bncPaidYtdEur).toBe(3000);
});
it("projects bank cash with TTC receipts minus all average outflows including BNC and tax", () => {
  const result = mobileCashForecast({ ...base, transactions: [tx("2026-06-01", -100, "Frais"), tx("2026-07-01", -200, "BNC"), tx("2026-08-01", -300, "TVA")], invoices: [invoice("2026-09-01", 1000)], days: ["2026-10-01", "2026-12-01"] });
  expect(result.expectedReceiptsTtcEur).toBe(2400); // outstanding + October; December paid next year
  expect(result.expectedExpensesTtcEur).toBe(600);
  expect(result.projectedBalanceEur).toBe(11800);
});
it("does not add invoiced or already collected amounts twice to the calendar plan", () => {
  const result = mobileCashForecast({ ...base, days: ["2026-09-01"], invoices: [invoice("2026-09-10", 1000)], transactions: [tx("2026-09-20", 1200, "Chiffre d’affaires")] });
  expect(result.expectedReceiptsTtcEur).toBe(0);
  expect(result.projectedBalanceEur).toBe(10000);
});
it("excludes invoices payable next year and preserves unknown data", () => {
  expect(mobileCashForecast({ ...base, now: new Date(2026, 11, 20), invoices: [invoice("2026-12-10", 1000)] }).expectedReceiptsTtcEur).toBe(0);
  expect(mobileCashForecast({ ...base, balance: null }).projectedBalanceEur).toBeNull();
  expect(mobileCashForecast({ ...base, invoices: undefined }).projectedBalanceEur).toBeNull();
});
it("prorates remaining days without subtracting already-paid expenses again", () => {
  const result = mobileCashForecast({ ...base, now: new Date(2026, 8, 15), transactions: [tx("2026-06-01", -300), tx("2026-07-01", -300), tx("2026-08-01", -300), tx("2026-09-01", -10000)] });
  expect(result.expectedExpensesTtcEur).toBe(1050);
  expect(result.projectedBalanceEur).toBe(8950);
});
it("includes December 31 receipts but excludes January payments from the cash balance", () => {
  const result = mobileCashForecast({ ...base, now: new Date(2026, 10, 1), days: ["2026-11-02", "2026-12-01"], invoices: [invoice("2026-10-20", 500)] });
  expect(result.receiptSchedule).toEqual([
    { date: "2026-11-19", amountTtcEur: 600, source: "invoice" },
    { date: "2026-12-31", amountTtcEur: 1200, source: "calendar" }
  ]);
  expect(result.expectedReceiptsTtcEur).toBe(1800);
  expect(result.projectedBalanceEur).toBe(11800);
});
