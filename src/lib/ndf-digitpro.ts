import type { DashboardTx } from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { amountNetOfRecoverableVat } from "@/lib/recoverable-expense-vat";

/** Libellé métier de la note de frais DigitPro (tag manuel depuis l'onglet Catégorisation). */
export const NDF_DIGITPRO_CATEGORY = "NDF DigitPro";

/**
 * Vrai si la transaction est une note de frais DigitPro taguée manuellement
 * (carte du dirigeant à rembourser, reclassée « NDF DigitPro » dans Catégorisation).
 */
export function isNdfDigitProTx(tx: DashboardTx): boolean {
  if (tx.amount >= 0) return false;
  return mapExpenseCategoryLabel(tx.category) === NDF_DIGITPRO_CATEGORY;
}

/** Nettoie un libellé bancaire (retire CB / dates / numéros) pour un affichage lisible. */
/** Montant HT d’une NDF DigitPro (TVA repas 10 % déduite quand récupérable). */
export function ndfDigitProAmountHtEur(tx: DashboardTx): number {
  const grossEur = Math.abs(tx.amount);
  const bucket = deriveExpenseBucket(tx);
  return amountNetOfRecoverableVat(tx, bucket, grossEur);
}

export function cleanNdfMerchantLabel(raw: string): string {
  return (
    raw
      .replace(/\b(cb|carte|card|cblm|paiement|payment)\b/gi, " ")
      .replace(/\b\d{2,}\/\d{2,}\/\d{2,4}\b/g, " ")
      .replace(/\b\d{3,}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim() || raw
  );
}

export type NdfDigitProMonthSummary = {
  /** Somme TTC des NDF DigitPro du mois (valeur absolue). */
  totalEur: number;
  /** Transactions NDF DigitPro du mois, dédoublonnées, triées par date décroissante. */
  transactions: DashboardTx[];
};

/**
 * Agrège les notes de frais DigitPro pour un mois civil (YYYY-MM).
 * Dédoublonnage sur (libellé nettoyé + date + montant) pour éviter les doublons d'import.
 */
export function summarizeNdfDigitProForMonth(
  transactions: readonly DashboardTx[],
  monthKey: string
): NdfDigitProMonthSummary {
  const dedupe = new Set<string>();
  const kept: DashboardTx[] = [];
  let totalEur = 0;

  for (const tx of transactions) {
    if (tx.date.slice(0, 7) !== monthKey) continue;
    if (!isNdfDigitProTx(tx)) continue;
    const amt = Math.abs(tx.amount);
    const key = `${cleanNdfMerchantLabel(tx.label).toLowerCase()}|${tx.date}|${amt.toFixed(2)}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    totalEur += amt;
    kept.push(tx);
  }

  kept.sort((a, b) => b.date.localeCompare(a.date));
  return { totalEur: Math.round(totalEur * 100) / 100, transactions: kept };
}
