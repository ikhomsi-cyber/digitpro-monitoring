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
  // Exclude pre-2023 invoices before matching receipts: they must not consume
  // payments used by the 17.2% scenario starting on 1 January 2023.
  const outstanding172 = outstandingHiwayInvoices(
    invoices?.filter(invoice=>invoice.date>="2023-01-01"),
    transactions.filter(transaction=>transaction.date.slice(0,10)>="2023-01-01"),now
  );
  const csg172 = round2(outstanding172
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
