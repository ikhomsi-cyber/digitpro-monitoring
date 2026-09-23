import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import { outstandingHiwayInvoices, sumHiwayInvoiceHtForMonth } from "@/lib/hiway-invoice-aggregate";
import { resolveBillableTjmForMonth, type BillableRatePeriod } from "@/lib/billable-client-days";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";

const round = (n: number) => Math.round(n * 100) / 100;
const dayMs = 86400000;
/** Cash movements in TTC. Existing debt is not deducted again from the bank balance. */
export function mobileCashForecast(input: {
  transactions: DashboardTx[]; invoices?: HiwayInvoice[]; days: string[];
  rates: BillableRatePeriod[]; tjm: number; balance: number | null; now: Date;
}) {
  const { now } = input;
  const year = now.getFullYear(), month = now.getMonth();
  const today = `${year}-${String(month + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const end = Date.UTC(year, 11, 31);
  const pro = input.transactions.filter(tx => (tx.scope ?? "pro") === "pro");
  const bncPaidYtdEur = round(pro.filter(tx => tx.date >= `${year}-01-01` && tx.date.slice(0, 10) <= today && tx.amount < 0 && deriveExpenseBucket(tx) === "BNC")
    .reduce((sum, tx) => sum - tx.amount, 0));
  const receiptSchedule: Array<{ date: string; amountTtcEur: number; source: string }> = [];
  for (const invoice of outstandingHiwayInvoices(input.invoices, pro, now)) {
    // Hiway invoices are payable 30 days after their recorded issue date.
    const due = Date.parse(invoice.date + "T00:00:00Z") + 30 * dayMs;
    if (due > end) continue;
    receiptSchedule.push({ date: new Date(due).toISOString().slice(0, 10),
      amountTtcEur: round(invoice.amountHt * 1.2), source: "invoice" });
  }
  // Same payment calendar as the web: issue on the first of the next month,
  // then 30 calendar days. Revenue payable next year is excluded from cash.
  // Issued invoices replace the corresponding plan; they are not counted twice.
  for (let m = month; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    const due = Date.UTC(year, m + 1, 1) + 30 * dayMs;
    if (due > end) continue;
    const count = new Set(input.days.filter(day => day.startsWith(key + "-"))).size;
    const plannedHt = count * resolveBillableTjmForMonth(input.rates, key, input.tjm);
    const amountTtcEur = round(Math.max(0, plannedHt - sumHiwayInvoiceHtForMonth(input.invoices?.filter(i => i.date <= today), key)) * 1.2);
    if (amountTtcEur > 0) receiptSchedule.push({ date: new Date(due).toISOString().slice(0, 10), amountTtcEur, source: "calendar" });
  }
  const baselineStart = new Date(year, month - 3, 1);
  const since = `${baselineStart.getFullYear()}-${String(baselineStart.getMonth() + 1).padStart(2, "0")}-01`;
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthlyExpenses = pro.filter(tx => tx.date >= since && tx.date < monthStart && tx.amount < 0)
    .reduce((sum, tx) => sum - tx.amount, 0) / 3;
  const remainingFraction = (new Date(year, month + 1, 0).getDate() - now.getDate()) / new Date(year, month + 1, 0).getDate();
  const expectedExpensesTtcEur = round(monthlyExpenses * (11 - month + remainingFraction));
  const expectedReceiptsTtcEur = round(receiptSchedule.reduce((sum, receipt) => sum + receipt.amountTtcEur, 0));
  return {
    bncPaidYtdEur, expectedReceiptsTtcEur: input.invoices == null ? null : expectedReceiptsTtcEur,
    expectedExpensesTtcEur,
    receiptSchedule: input.invoices == null ? [] : receiptSchedule.sort((a, b) => a.date.localeCompare(b.date)),
    projectedBalanceEur: input.balance == null || input.invoices == null ? null : round(input.balance + expectedReceiptsTtcEur - expectedExpensesTtcEur),
    basis: "Solde actuel + paiements TTC attendus d’ici le 31 décembre − sorties estimées. Factures déjà encaissées exclues ; factures impayées à 30 jours et jours cochés facturés le 1er du mois suivant, payables 30 jours après. Paiements de l’année suivante exclus. Les factures en retard restent attendues, sans date de règlement garantie. Sorties : moyenne des 3 derniers mois complets, BNC et paiements fiscaux inclus, prorata du mois restant."
  };
}
