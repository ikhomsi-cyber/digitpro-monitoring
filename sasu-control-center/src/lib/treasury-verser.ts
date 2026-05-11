import type { DashboardTx } from "./dashboard-metrics";
import {
  effectiveRevenueAnalyticsDateIso,
  TVA_DERIVED_EXPENSE_BUCKET
} from "./dashboard-metrics";
import { deriveExpenseBucket } from "./derived-expense-bucket";
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
  /** Somme des prélèvements classés TVA sur le mois civil (date d’opération). */
  tvaPrelevee: number;
  /**
   * Montant à provisionner sur les encaissements du mois, net des prélèvements TVA déjà passés :
   * CSG + TVA théorique − TVA prélevée.
   */
  provisionsFiscalesNet: number;
  /** Dernier solde connu sur le périmètre (colonne Solde Qonto). */
  qontoSolde: number | null;
  /** Solde − provisions fiscales nettes (indicatif). */
  disponibleAVerser: number | null;
};

function monthKeyFromView(y: number, month0: number): string {
  return `${y}-${String(month0 + 1).padStart(2, "0")}`;
}

/**
 * Indicateur trésorerie pour le mois affiché dans le calendrier :
 * - CA encaissé (TTC / HT) : encaissements « Chiffre d’affaires » avec date analytique dans le mois.
 * - CSG : 9,7 % du HT encaissé.
 * - TVA : 20 % du HT encaissé, comparée aux sorties classées TVA du mois civil.
 * - Disponible : dernier solde Qonto − provisions nettes (CSG + TVA nette).
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

  let tvaPrelevee = 0;
  for (const tx of scoped) {
    if (tx.amount >= 0) continue;
    if (tx.date.slice(0, 7) !== monthKey) continue;
    if (deriveExpenseBucket(tx) !== TVA_DERIVED_EXPENSE_BUCKET) continue;
    tvaPrelevee += Math.abs(tx.amount);
  }

  const provisionsFiscalesNet = csgDue + tvaTheorique - tvaPrelevee;

  const withBal = scoped
    .filter((t) => t.balance != null && Number.isFinite(Number(t.balance)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)));

  const qontoSolde = withBal.length > 0 ? Number(withBal[0].balance) : null;
  const disponibleAVerser = qontoSolde != null ? qontoSolde - provisionsFiscalesNet : null;

  return {
    monthKey,
    caEncaisseTtc: caTtc,
    caEncaisseHt: caHt,
    csgDue,
    tvaTheorique,
    tvaPrelevee,
    provisionsFiscalesNet,
    qontoSolde,
    disponibleAVerser
  };
}
