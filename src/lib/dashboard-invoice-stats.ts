import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import { additionalCsgFromInvoiceCaHt, outstandingHiwayInvoices } from "@/lib/hiway-invoice-aggregate";

/** Complète les dettes encaissées avec les factures émises encore à régler. */
export function withOutstandingInvoiceCsg(
  stats: DashboardHeroStats,
  invoices: readonly HiwayInvoice[] | null | undefined,
  transactions: readonly DashboardTx[],
  now = new Date()
): DashboardHeroStats {
  const outstanding = outstandingHiwayInvoices(invoices, transactions, now);
  if (!outstanding.length) return stats;

  const round2 = (amount: number) => Math.round(amount * 100) / 100;
  const outstandingHt = round2(outstanding.reduce((sum, invoice) => sum + invoice.amountHt, 0));
  const csg97 = additionalCsgFromInvoiceCaHt(outstandingHt);
  const csg172 = round2(outstanding
    .filter((invoice) => invoice.date >= "2023-01-01")
    .reduce((sum, invoice) => sum + invoice.amountHt, 0) * 0.172);
  const totalDebt = round2(stats.detteTotaleDepuisDebutEur + csg97);

  return {
    ...stats,
    detteCsgDepuisDebutEur: round2(stats.detteCsgDepuisDebutEur + csg97),
    csgComparaison172Eur: round2(stats.csgComparaison172Eur + csg172),
    detteTotaleDepuisDebutEur: totalDebt,
    resteAVerserApresCashEur: Math.max(0, round2(totalDebt - Math.max(0, stats.soldeQontoEur ?? 0)))
  };
}
