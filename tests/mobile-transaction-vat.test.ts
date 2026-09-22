import { expect, it } from "vitest";
import { mobileTransactionVat } from "@/lib/mobile/transaction-vat";
import type { DashboardTx } from "@/lib/dashboard-metrics";
const tx: DashboardTx = { id: "1", date: "2026-09-22", label: "Matériel", company: "Qonto", category: "Matériel", categoryManual: true, scope: "pro", amount: -120 };
it("uses recoverable VAT including the meal rate and cent rounding", () => {
  expect(mobileTransactionVat(tx)).toEqual({ ht: 100, ttc: 120, amount: 20, rate: 0.2, kind: "recoverable" });
  expect(mobileTransactionVat({ ...tx, category: "Repas dirigeant", label: "Restaurant", amount: -110 })).toMatchObject({ ht: 100, amount: 10, rate: 0.1 });
  const small = mobileTransactionVat({ ...tx, amount: -19.99 })!;
  expect(Math.round((small.ht + small.amount) * 100)).toBe(1999);
});
it("excludes personal transactions, exempt categories, transfers and refunds", () => {
  for (const patch of [{ scope: "personal" as const }, { category: "Assurance", company: "Assureur" }, { category: "TVA" }, { category: "BNC" }, { amount: 120 }, { amount: 0 }]) {
    expect(mobileTransactionVat({ ...tx, ...patch })).toBeNull();
  }
});
it("uses the existing collected VAT rule for professional turnover", () => {
  expect(mobileTransactionVat({ ...tx, category: "Chiffre d’affaires", amount: 1200 })).toEqual({ ht: 1000, ttc: 1200, amount: 200, rate: 0.2, kind: "collected" });
});
