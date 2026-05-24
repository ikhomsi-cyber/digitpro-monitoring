import type { DashboardTx } from "./dashboard-metrics";
import { effectiveRevenueAnalyticsDateIso } from "./dashboard-metrics";
import { computeLatestQontoBalanceEur } from "./bank";
import { deriveExpenseBucket } from "./derived-expense-bucket";
import { IK_CATEGORY_LABEL } from "./expense-category-map";
import { isRevenueCategory } from "./revenue-category";

/** Taux CSG / cotisations sur le brut des encaissements HT (paramètre métier). */
export const TREASURY_CSG_RATE = 0.097;

/** TVA facturée sur les encaissements (CA TTC = HT × 1,20). */
export const TREASURY_VAT_RATE = 0.2;

export type TreasuryVerserSnapshot = {
  monthKey: string;
  caEncaisseTtc: number;
  caEncaisseHt: number;
  csgDue: number;
  tvaTheorique: number;
  /** Dépenses du mois civil (date d’opération), montants absolus. */
  ikMois: number;
  ndfMois: number;
  bncMois: number;
  /** IK + NDF + BNC sur le mois civil. */
  verseCeMois: number;
  /** Dernier solde connu sur le périmètre (colonne Solde Qonto). */
  qontoSolde: number | null;
};

function monthKeyFromView(y: number, month0: number): string {
  return `${y}-${String(month0 + 1).padStart(2, "0")}`;
}

/**
 * Indicateur trésorerie pour le mois affiché dans le calendrier :
 * - CA encaissé (TTC / HT) : encaissements « Chiffre d’affaires » avec date analytique dans le mois.
 * - CSG : 9,7 % du HT encaissé.
 * - TVA théorique : 20 % du HT encaissé.
 * - IK / NDF / BNC : totaux des dépenses du mois civil ; « Versé ce mois » = leur somme.
 */
export function computeTreasuryVerserSnapshot(
  transactions: DashboardTx[],
  scope: "pro" | "personal",
  viewYear: number,
  viewMonth0: number
): TreasuryVerserSnapshot {
  const monthKey = monthKeyFromView(viewYear, viewMonth0);
  const scoped = transactions.filter((t) => (t.scope ?? "pro") === scope);

  let caTtc = 0;
  for (const tx of scoped) {
    if (tx.amount <= 0 || !isRevenueCategory(tx.category)) continue;
    const mk = effectiveRevenueAnalyticsDateIso(tx).slice(0, 7);
    if (mk === monthKey) caTtc += tx.amount;
  }

  const caHt = caTtc / (1 + TREASURY_VAT_RATE);
  const csgDue = caHt * TREASURY_CSG_RATE;
  const tvaTheorique = caHt * TREASURY_VAT_RATE;

  let ikMois = 0;
  let ndfMois = 0;
  let bncMois = 0;
  for (const tx of scoped) {
    if (tx.amount >= 0) continue;
    if (tx.date.slice(0, 7) !== monthKey) continue;
    const bucket = deriveExpenseBucket(tx);
    const abs = Math.abs(tx.amount);
    if (bucket === IK_CATEGORY_LABEL) ikMois += abs;
    else if (bucket === "NDF") ndfMois += abs;
    else if (bucket === "BNC") bncMois += abs;
  }

  const verseCeMois = ikMois + ndfMois + bncMois;

  const qontoSolde = computeLatestQontoBalanceEur(transactions, scope);

  return {
    monthKey,
    caEncaisseTtc: caTtc,
    caEncaisseHt: caHt,
    csgDue,
    tvaTheorique,
    ikMois,
    ndfMois,
    bncMois,
    verseCeMois,
    qontoSolde
  };
}
