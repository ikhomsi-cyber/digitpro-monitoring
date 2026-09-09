import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import {
  appendAgendaWorkedDayMonths,
  buildInvoiceWorkedDaysPastMonthsSeries,
  INVOICE_WORKED_DAYS_FIRST_BAR_MONTH_KEY,
  mergeIssuedHiwayInvoicesIntoWorkedDays,
  resolveRevenueEncashmentBillableDays
} from "@/lib/invoice-worked-days-series";
import { analyzeValeurReelle } from "@/lib/valeur-reelle-analyze";

const START_YEAR = 2022;
const money = (value: number) => Math.round(value * 100) / 100;

/** Montants annuels avant la correction globale de 1 200 €, commune aux deux taux. */
function comparePeriod(transactions: DashboardTx[], year: number, now: Date) {
  const tree = analyzeValeurReelle(transactions, { years: [year], now }).cashTree;
  const csg97Eur = tree.csgEur;
  // Même assiette à 17,2 % que le dashboard, sans réintégration sociale.
  const csg172Eur = money(Math.max(0, tree.caFactureEur - tree.mandatoryFeesEur - tree.personalChargesEur) * 0.172);
  return { generatedCaHtEur: tree.caFactureEur, csg97Eur, csg172Eur, differenceEur: money(csg172Eur - csg97Eur) };
}

export function computeGeneratedCaHtToDate(
  transactions: DashboardTx[],
  selectedWorkDays: ReadonlySet<string>,
  billableRatePeriods: readonly BillableRatePeriod[],
  fallbackTjmHt: number,
  invoices: readonly HiwayInvoice[] | null | undefined,
  now = new Date()
): number {
  const encaissees = buildInvoiceWorkedDaysPastMonthsSeries(
    transactions,
    "pro",
    now,
    undefined,
    billableRatePeriods,
    fallbackTjmHt
  );
  const avecActivite = appendAgendaWorkedDayMonths(
    encaissees,
    selectedWorkDays,
    billableRatePeriods,
    fallbackTjmHt,
    now
  );
  const rapprochees = mergeIssuedHiwayInvoicesIntoWorkedDays(
    avecActivite,
    invoices,
    billableRatePeriods,
    fallbackTjmHt,
    now
  );
  const prefix = `${now.getFullYear()}-`;
  return money(
    rapprochees
      .filter((row) => row.monthKey.startsWith(prefix) && row.monthKey <= now.toISOString().slice(0, 7))
      .reduce((sum, row) => sum + row.caHt, 0)
  );
}

export function buildCsgHistory(
  transactions: DashboardTx[],
  now = new Date(),
  currentYearGeneratedCaHtEur?: number
) {
  const byYear = new Map<number, DashboardTx[]>([[START_YEAR, []]]);
  for (const tx of transactions) {
    if ((tx.scope ?? "pro") !== "pro") continue;
    const { prestationMonthKey } = resolveRevenueEncashmentBillableDays(tx, []);
    if (prestationMonthKey && prestationMonthKey < INVOICE_WORKED_DAYS_FIRST_BAR_MONTH_KEY) continue;
    // Réutilise le mois de prestation de « Jours facturés ». Le premier du
    // mois évite d'appliquer une seconde fois le report analytique des jours 27+.
    // Copie locale uniquement : les dates bancaires et celles des charges restent intactes.
    const periodTx = prestationMonthKey ? { ...tx, date: `${prestationMonthKey}-01` } : tx;
    const year = Number(periodTx.date.slice(0, 4));
    if (!Number.isInteger(year) || year < START_YEAR) continue;
    const rows = byYear.get(year) ?? [];
    rows.push(periodTx);
    byYear.set(year, rows);
  }
  byYear.set(now.getFullYear(), byYear.get(now.getFullYear()) ?? []);
  return Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, rows]) => {
      let comparison = comparePeriod(rows, year, now);
      if (year === now.getFullYear() && currentYearGeneratedCaHtEur != null) {
        const deltaCaHtEur = money(currentYearGeneratedCaHtEur - comparison.generatedCaHtEur);
        comparison = {
          generatedCaHtEur: currentYearGeneratedCaHtEur,
          csg97Eur: money(Math.max(0, comparison.csg97Eur + deltaCaHtEur * 0.097)),
          csg172Eur: money(Math.max(0, comparison.csg172Eur + deltaCaHtEur * 0.172)),
          differenceEur: 0
        };
        comparison.differenceEur = money(comparison.csg172Eur - comparison.csg97Eur);
      }
      // Hypothèse de suivi demandée : 2022 prescrite, provision à 9,7 %
      // libérée pour compenser les autres années, uniquement si sélectionnée.
      const prescribed = year === 2022;
      const csg172Eur = prescribed ? 0 : comparison.csg172Eur;
      return { year, prescribed, generatedCaHtEur: comparison.generatedCaHtEur, csg97Eur: comparison.csg97Eur, csg172Eur,
        differenceEur: money(csg172Eur - comparison.csg97Eur) };
    });
}

export function summarizeCsgHistory(rows: ReturnType<typeof buildCsgHistory>) {
  const csg97Eur = money(rows.reduce((sum, row) => sum + row.csg97Eur, 0));
  const csg172Eur = money(rows.reduce((sum, row) => sum + row.csg172Eur, 0));
  const compensationEur = money(rows.filter((row) => row.prescribed).reduce((sum, row) => sum + row.csg97Eur, 0));
  const differenceBeforeCompensationEur = money(rows.filter((row) => !row.prescribed).reduce((sum, row) => sum + row.differenceEur, 0));
  const differenceEur = money(csg172Eur - csg97Eur);
  return { csg97Eur, csg172Eur, compensationEur, differenceBeforeCompensationEur,
    amountToCoverEur: Math.max(0, differenceEur), surplusEur: Math.max(0, -differenceEur) };
}
