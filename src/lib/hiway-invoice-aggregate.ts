import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import { CSG_ON_BNC_RATE } from "@/lib/valeur-reelle-analyze";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { isRevenueCategory } from "@/lib/revenue-category";

const VAT_RATE = 0.2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Montant HT d'une facture Hiway (convertit le TTC, traite « inconnu » comme HT). */
export function hiwayInvoiceHtEur(invoice: HiwayInvoice): number {
  if (invoice.amountEur == null || invoice.amountEur <= 0) return 0;
  if (invoice.amountKind === "TTC") return invoice.amountEur / (1 + VAT_RATE);
  return invoice.amountEur;
}

/** Somme HT des factures Hiway dont la date d'envoi tombe dans `monthKey` (YYYY-MM). */
export function sumHiwayInvoiceHtForMonth(
  invoices: readonly HiwayInvoice[] | null | undefined,
  monthKey: string
): number {
  if (!invoices?.length || !monthKey) return 0;
  let total = 0;
  for (const invoice of invoices) {
    if ((invoice.date ?? "").slice(0, 7) !== monthKey) continue;
    total += hiwayInvoiceHtEur(invoice);
  }
  return round2(total);
}

/**
 * CA Hiway facturé mais pas encore rapproché d'un encaissement.
 *
 * Les encaissements sont rapprochés dans leur ordre réel avec les factures déjà
 * émises (FIFO). Le décalage de deux mois utilisé par le graphique d'activité
 * n'est pas utilisé ici : il décrit le mois de prestation, pas une échéance de
 * règlement, et sinon une facture déjà encaissée peut rester provisionnée.
 */
export function sumOutstandingHiwayInvoiceHt(
  invoices: readonly HiwayInvoice[] | null | undefined,
  transactions: readonly DashboardTx[],
  now = new Date()
): number {
  if (!invoices?.length) return 0;

  const todayIso = `${localMonthKey(now)}-${String(now.getDate()).padStart(2, "0")}`;
  const issued = invoices
    .map((invoice) => ({ date: invoice.date?.slice(0, 10) ?? "", amountHt: hiwayInvoiceHtEur(invoice) }))
    .filter((invoice) => invoice.date && invoice.date <= todayIso && invoice.amountHt > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!issued.length) return 0;

  const receipts = transactions
    .filter(
      (tx) =>
        (tx.scope ?? "pro") === "pro" &&
        tx.amount > 0 &&
        isRevenueCategory(tx.category) &&
        tx.date.slice(0, 10) <= todayIso
    )
    .map((tx) => ({ date: tx.date.slice(0, 10), amountHt: tx.amount / (1 + VAT_RATE) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let receiptIndex = 0;
  let availableReceiptHt = 0;
  let outstandingHt = 0;

  for (const invoice of issued) {
    let unpaidInvoiceHt = invoice.amountHt;
    while (unpaidInvoiceHt > 0 && receiptIndex < receipts.length) {
      const receipt = receipts[receiptIndex]!;
      // Un encaissement antérieur à l'émission ne peut pas régler cette facture.
      if (receipt.date < invoice.date) {
        receiptIndex++;
        continue;
      }
      if (availableReceiptHt <= 0) availableReceiptHt = receipt.amountHt;
      const allocatedHt = Math.min(unpaidInvoiceHt, availableReceiptHt);
      unpaidInvoiceHt -= allocatedHt;
      availableReceiptHt -= allocatedHt;
      if (availableReceiptHt <= 0.005) {
        availableReceiptHt = 0;
        receiptIndex++;
      }
    }
    outstandingHt += unpaidInvoiceHt;
  }

  return round2(Math.max(0, outstandingHt));
}

/**
 * Complément de CSG produit par du CA HT facturé et non encaissé.
 *
 * Il applique le taux de CSG habituel ; les charges et réintégrations déjà
 * calculées restent inchangées.
 */
export function additionalCsgFromInvoiceCaHt(caHtEur: number): number {
  if (!Number.isFinite(caHtEur) || caHtEur <= 0) return 0;
  return round2(caHtEur * CSG_ON_BNC_RATE);
}

/** Clé de mois civil local (YYYY-MM) pour une date donnée. */
export function localMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
