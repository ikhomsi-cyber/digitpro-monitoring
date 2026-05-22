import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  ASSURANCE_CATEGORY_LABEL,
  ICLOUD_IA_STORE_CATEGORY_LABEL,
  IK_CATEGORY_LABEL,
  IMPOT_CATEGORY_LABEL,
  COMPTA_ADMIN_BUCKET_LABEL,
  MATERIEL_CATEGORY_LABEL,
  mapExpenseCategoryLabel,
  MUTUELLE_CATEGORY_LABEL,
  QONTO_CATEGORY_LABEL
} from "@/lib/expense-category-map";
import { categorizeHiwayExpense, labelStartsWithDgfipTva } from "@/lib/hiway-categorisation";

/** Libellés affichés pour la répartition des dépenses (règles métier + libellé / société / catégorie). */
export const DERIVED_EXPENSE_BUCKETS = [
  "BNC",
  "TVA",
  IMPOT_CATEGORY_LABEL,
  "Urssaf",
  COMPTA_ADMIN_BUCKET_LABEL,
  /** Notes de frais (libellé / catégorie). */
  "NDF",
  IK_CATEGORY_LABEL,
  "Repas d'affaire",
  "Repas dirigeant",
  "CESU",
  "Mobile et Internet",
  ICLOUD_IA_STORE_CATEGORY_LABEL,
  "Retraite",
  "PAS DSN",
  QONTO_CATEGORY_LABEL,
  ASSURANCE_CATEGORY_LABEL,
  MATERIEL_CATEGORY_LABEL,
  MUTUELLE_CATEGORY_LABEL,
  "Autres"
] as const;

export type DerivedExpenseBucket = (typeof DERIVED_EXPENSE_BUCKETS)[number];

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

/**
 * Catégorie d’affichage pour une dépense (montant &lt; 0).
 * Ordre des règles : plus spécifique d’abord.
 */
export function deriveExpenseBucket(tx: DashboardTx): DerivedExpenseBucket {
  if (tx.amount >= 0) return "Autres";

  const b = txBlob(tx);

  if (
    b.includes("urssaf") ||
    b.includes("cgss") ||
    b.includes("cotisation sociale") ||
    b.includes("cotisations sociales")
  ) {
    return "Urssaf";
  }

  if (b.includes("dgfip")) {
    if (labelStartsWithDgfipTva(tx)) return "TVA";
    if (categorizeHiwayExpense(tx) === "Retraite") return "Retraite";
    return IMPOT_CATEGORY_LABEL;
  }

  if (/\bbnc\b/.test(b)) return "BNC";

  const mapped = mapExpenseCategoryLabel(tx.category);
  const mk = fold(mapped);
  if (mk === "bnc" || mapped === "BNC") return "BNC";
  if (mk === "tva" || mapped === "TVA") return labelStartsWithDgfipTva(tx) ? "TVA" : "Autres";
  if (mapped === IMPOT_CATEGORY_LABEL || mk === "impot") {
    return IMPOT_CATEGORY_LABEL;
  }

  switch (categorizeHiwayExpense(tx)) {
    case "Indemnités kilométriques":
      return IK_CATEGORY_LABEL;
    case "CESU":
      return "CESU";
    case "Repas d’affaires":
      return "Repas d'affaire";
    case "Repas du dirigeant":
      return "Repas dirigeant";
    case "Abonnement Hiway":
    case "Hiway compta":
      return COMPTA_ADMIN_BUCKET_LABEL;
    case "Mutuelle":
      return MUTUELLE_CATEGORY_LABEL;
    case "Retraite":
      return "Retraite";
    case "PAS DSN":
      return "PAS DSN";
    case "Abonnement internet & mobile":
      return "Mobile et Internet";
    case "Assurances":
      return ASSURANCE_CATEGORY_LABEL;
    case "Frais bancaires":
      return QONTO_CATEGORY_LABEL;
    case "Paiement TVA":
      return labelStartsWithDgfipTva(tx) ? "TVA" : "Autres";
    case "Abonnement logiciel":
      return ICLOUD_IA_STORE_CATEGORY_LABEL;
    default:
      return "Autres";
  }
}
