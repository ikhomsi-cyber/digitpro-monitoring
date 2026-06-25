import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import { CSG_ON_BNC_RATE } from "@/lib/valeur-reelle-analyze";

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

/** CSG additionnel généré par un CA HT supplémentaire (même taux que la dette CSG). */
export function additionalCsgFromInvoiceCaHt(caHtEur: number): number {
  if (!Number.isFinite(caHtEur) || caHtEur <= 0) return 0;
  return round2(caHtEur * CSG_ON_BNC_RATE);
}

/** Clé de mois civil local (YYYY-MM) pour une date donnée. */
export function localMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
