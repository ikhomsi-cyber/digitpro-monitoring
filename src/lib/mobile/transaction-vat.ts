import type { DashboardTx } from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { recoverableVatRule, vatIncludedInGross } from "@/lib/recoverable-expense-vat";
import { isRevenueCategory } from "@/lib/revenue-category";

/** Existing web category rules, not a second tax engine in Swift. */
export function mobileTransactionVat(tx: DashboardTx) {
  if (tx.scope === "personal" || !Number.isFinite(tx.amount) || tx.amount === 0) return null;
  const rate = tx.amount < 0 ? recoverableVatRule(tx, deriveExpenseBucket(tx))?.rate
    : isRevenueCategory(tx.category) ? 0.2 : undefined;
  if (!rate) return null;
  const ttc = Math.round(Math.abs(tx.amount) * 100) / 100;
  const amount = vatIncludedInGross(ttc, rate);
  return { rate, amount, ht: Math.round((ttc - amount) * 100) / 100, ttc,
    kind: tx.amount < 0 ? "recoverable" : "collected" };
}
