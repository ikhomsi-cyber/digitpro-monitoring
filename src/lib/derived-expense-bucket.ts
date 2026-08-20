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
import {
  categorizeHiwayExpense,
  labelStartsWithDgfipTva,
  mapHiwayExpenseCategory
} from "@/lib/hiway-categorisation";

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
  "Cadeau client",
  "ANCV",
  "Repas dirigeant",
  "CESU",
  "Mobile et Internet",
  ICLOUD_IA_STORE_CATEGORY_LABEL,
  "Retraite",
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

function hiwayCategoryToBucket(hiway: ReturnType<typeof categorizeHiwayExpense>): DerivedExpenseBucket {
  switch (hiway) {
    case "Indemnités kilométriques":
      return IK_CATEGORY_LABEL;
    case "CESU":
      return "CESU";
    case "ANCV":
      return "ANCV";
    case "Repas d’affaires":
      return "Repas d'affaire";
    case "Cadeau client":
      return "Cadeau client";
    case "Repas du dirigeant":
      return "Repas dirigeant";
    case "Abonnement Hiway":
    case "Hiway compta":
      return COMPTA_ADMIN_BUCKET_LABEL;
    case "Urssaf":
      return "Urssaf";
    case "Mutuelle":
      return MUTUELLE_CATEGORY_LABEL;
    case "Retraite":
      return "Retraite";
    case "Abonnement internet & mobile":
      return "Mobile et Internet";
    case "Assurances":
      return ASSURANCE_CATEGORY_LABEL;
    case "Frais bancaires":
      return QONTO_CATEGORY_LABEL;
    case "Matériels et fournitures":
      return MATERIEL_CATEGORY_LABEL;
    case "Paiement TVA":
      return "TVA";
    case "Impôt":
      return IMPOT_CATEGORY_LABEL;
    case "Abonnement logiciel":
      return ICLOUD_IA_STORE_CATEGORY_LABEL;
    default:
      return "Autres";
  }
}

/** Résout le bucket uniquement depuis la catégorie stockée (choix manuel). */
export function deriveExpenseBucketFromStoredCategory(category: string): DerivedExpenseBucket {
  const mapped = mapExpenseCategoryLabel(category);
  const mk = fold(mapped);

  if (mapped === "NDF" || mapped === "NDF DigitPro") return "NDF";
  if (mk === "bnc" || mapped === "BNC") return "BNC";
  if (mk === "tva" || mapped === "TVA") return "TVA";
  if (mapped === QONTO_CATEGORY_LABEL) return QONTO_CATEGORY_LABEL;
  if (mapped === IMPOT_CATEGORY_LABEL || mk === "impot") return IMPOT_CATEGORY_LABEL;
  if (mapped === IK_CATEGORY_LABEL) return IK_CATEGORY_LABEL;
  if (mapped === MUTUELLE_CATEGORY_LABEL) return MUTUELLE_CATEGORY_LABEL;
  if (mapped === "CESU") return "CESU";
  if (mapped === "ANCV") return "ANCV";
  if (mapped === "Repas d'affaire") return "Repas d'affaire";
  if (mapped === "Cadeau client") return "Cadeau client";
  if (mapped === "Repas dirigeant") return "Repas dirigeant";
  if (mapped === "Mobile et Internet") return "Mobile et Internet";
  if (mapped === ICLOUD_IA_STORE_CATEGORY_LABEL) return ICLOUD_IA_STORE_CATEGORY_LABEL;
  if (mapped === "Retraite") return "Retraite";
  if (mapped === ASSURANCE_CATEGORY_LABEL) return ASSURANCE_CATEGORY_LABEL;
  if (mapped === MATERIEL_CATEGORY_LABEL) return MATERIEL_CATEGORY_LABEL;
  if (mapped === COMPTA_ADMIN_BUCKET_LABEL) return COMPTA_ADMIN_BUCKET_LABEL;
  if (mapped === "Urssaf") return "Urssaf";

  const hiway = mapHiwayExpenseCategory(mapped) ?? mapHiwayExpenseCategory(category);
  if (hiway && hiway !== "Non catégorisé") {
    return hiwayCategoryToBucket(hiway);
  }

  return "Autres";
}

/**
 * Catégorie d’affichage pour une dépense (montant &lt; 0).
 * Ordre des règles : plus spécifique d’abord.
 */
export function deriveExpenseBucket(tx: DashboardTx): DerivedExpenseBucket {
  if (tx.amount >= 0) return "Autres";

  const b = txBlob(tx);

  if (
    b.includes("impot-pas") ||
    b.includes("impot pas") ||
    b.includes("pasdsn") ||
    b.includes("pas-dsn") ||
    (b.includes("impot") && b.includes("pas") && b.includes("dsn"))
  ) {
    return IMPOT_CATEGORY_LABEL;
  }

  if (tx.categoryManual) {
    return deriveExpenseBucketFromStoredCategory(tx.category);
  }

  if (
    b.includes("cesu") ||
    b.includes("achat cesu") ||
    b.includes("ticket cesu") ||
    b.includes("domiserve") ||
    b.includes("cheque domicile") ||
    b.includes("chèque domicile") ||
    b.includes("up cesu") ||
    b.includes("bimpli")
  ) {
    return "CESU";
  }

  if (
    b.includes("wemind") ||
    b.includes("we mind") ||
    b.includes("mutuelle") ||
    b.includes("prevoyance") ||
    b.includes("prévoyance")
  ) {
    return MUTUELLE_CATEGORY_LABEL;
  }

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
  if (mapped === QONTO_CATEGORY_LABEL) return QONTO_CATEGORY_LABEL;
  if (mapped === IMPOT_CATEGORY_LABEL || mk === "impot") {
    return IMPOT_CATEGORY_LABEL;
  }

  const hiway = categorizeHiwayExpense(tx);
  if (hiway === "Paiement TVA") {
    return labelStartsWithDgfipTva(tx) ? "TVA" : "Autres";
  }
  return hiwayCategoryToBucket(hiway);
}
