import type { DashboardTx } from "@/lib/dashboard-metrics";
import { deriveExpenseBucket, type DerivedExpenseBucket } from "@/lib/derived-expense-bucket";
import { resolveSasuSimplifiedExpenseGroup } from "@/lib/valeur-reelle-analyze";

function fold(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function txBlob(tx: DashboardTx): string {
  return fold(`${tx.label} ${tx.company} ${tx.category}`);
}

export function recoverableVatRule(
  tx: DashboardTx,
  bucket: DerivedExpenseBucket | null
): { label: string; rate: number } | null {
  const b = txBlob(tx);
  if (
    bucket === "Urssaf" ||
    bucket === "Impôt" ||
    bucket === "Indemnités kilométriques" ||
    bucket === "CESU" ||
    bucket === "BNC" ||
    bucket === "TVA"
  ) {
    return null;
  }
  // iGraal (cashback) : remboursement sans TVA → aucune TVA récupérable (HT = TTC).
  if (b.includes("igraal")) return null;
  if (b.includes("hiway") || bucket === "Compta & admin.") return { label: "Hiway / admin", rate: 0.2 };
  if (b.includes("wemind") || b.includes("we mind") || bucket === "Mutuelle") return null;
  if (bucket === "NDF" || bucket === "Repas dirigeant" || bucket === "Repas d'affaire") {
    return { label: "Repas & NDF", rate: 0.1 };
  }
  if (bucket === "iCloud IA Store" || b.includes("logiciel") || b.includes("software") || b.includes("cursor")) {
    return { label: "Logiciels & Apple", rate: 0.2 };
  }
  if (bucket === "Mobile et Internet") return { label: "Télécom", rate: 0.2 };
  if (bucket === "Qonto") return { label: "Qonto", rate: 0.2 };
  if (bucket === "Matériel") return { label: "Matériel", rate: 0.2 };
  if (bucket === "Assurance") return null;
  return null;
}

export function vatIncludedInGross(grossEur: number, rate: number): number {
  if (!Number.isFinite(grossEur) || grossEur <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((grossEur * rate / (1 + rate)) * 100) / 100;
}

export function amountNetOfRecoverableVat(
  tx: DashboardTx,
  bucket: DerivedExpenseBucket | null,
  grossEur: number
): number {
  const rule = recoverableVatRule(tx, bucket);
  if (!rule) return grossEur;
  return Math.max(0, Math.round((grossEur - vatIncludedInGross(grossEur, rule.rate)) * 100) / 100);
}

/** Montant HT si la ligne a une TVA récupérable (sinon HT = TTC). */
export function expenseAmountHasRecoverableVat(amountEur: number, grossAmountEur?: number): boolean {
  const gross = grossAmountEur ?? amountEur;
  return gross > amountEur + 0.004;
}

export function isDigitProExpense(tx: DashboardTx): boolean {
  if (tx.amount >= 0) return false;
  const bucket = deriveExpenseBucket(tx);
  return resolveSasuSimplifiedExpenseGroup(tx, bucket) === "Frais DigitPro";
}

/** Montant affiché : HT pour DigitPro + TVA récupérable, TTC sinon. */
export function dashboardSasuExpenseAmountHt(tx: DashboardTx): number {
  if (tx.amount >= 0) return 0;
  const grossEur = Math.abs(tx.amount);
  if (!isDigitProExpense(tx)) return grossEur;
  const bucket = deriveExpenseBucket(tx);
  return amountNetOfRecoverableVat(tx, bucket, grossEur);
}

/** Montant dépense SASU dashboard : alias explicite. */
export function dashboardSasuExpenseDisplayAmount(tx: DashboardTx): number {
  return dashboardSasuExpenseAmountHt(tx);
}
