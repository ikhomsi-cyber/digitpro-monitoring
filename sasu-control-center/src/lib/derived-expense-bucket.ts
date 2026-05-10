import type { DashboardTx } from "@/lib/dashboard-metrics";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";

/** Libellés affichés pour la répartition des dépenses (règles métier + libellé / société / catégorie). */
export const DERIVED_EXPENSE_BUCKETS = [
  "BNC",
  "TVA",
  "Urssaf",
  "Hiway",
  "Repas d'affaire",
  "Repas dirigeant",
  "CESU",
  "Mobile et Internet",
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

  if (b.includes("hiway")) return "Hiway";

  if (b.includes("pluxee") || b.includes("edenred")) return "CESU";

  if (/\bsfr\b/.test(b)) return "Mobile et Internet";
  if (
    /\bfree\b/.test(b) &&
    (b.includes("mobile") ||
      b.includes("freebox") ||
      b.includes("telecom") ||
      b.includes("internet") ||
      b.includes("fibre") ||
      b.includes("forfait") ||
      b.includes("telephone"))
  ) {
    return "Mobile et Internet";
  }
  if (/\bfreebox\b/.test(b)) return "Mobile et Internet";

  if (
    b.includes("urssaf") ||
    b.includes("cgss") ||
    /\bdsn\b/.test(b) ||
    b.includes("cotisation sociale") ||
    b.includes("cotisations sociales")
  ) {
    return "Urssaf";
  }

  if (
    /\btva\b/.test(b) ||
    b.includes("credit tva") ||
    b.includes("credit-tva") ||
    b.includes("debit tva") ||
    b.includes("debit-tva") ||
    b.includes("paiement tva") ||
    b.includes("taxe sur les ventes") ||
    b.includes("liquidation tva")
  ) {
    return "TVA";
  }

  if (/\bbnc\b/.test(b)) return "BNC";

  if (
    b.includes("repas dirigeant") ||
    (b.includes("dirigeant") && (b.includes("repas") || b.includes("restaurant"))) ||
    /\bilias\b/.test(b) ||
    b.includes("repas ilias")
  ) {
    return "Repas dirigeant";
  }

  if (
    b.includes("repas d affaire") ||
    b.includes("repas d’affaire") ||
    b.includes("dejeuner d affaire") ||
    b.includes("dejeuner affaire") ||
    b.includes("diner d affaire") ||
    b.includes("diner affaire") ||
    (b.includes("restaurant") && (b.includes("client") || b.includes("affaire") || b.includes("invitation")))
  ) {
    return "Repas d'affaire";
  }

  const mapped = mapExpenseCategoryLabel(tx.category);
  const mk = fold(mapped);
  if (mk === "bnc" || mapped === "BNC") return "BNC";
  if (mk === "tva" || mapped === "TVA") return "TVA";
  if (mapped === "Hiway") return "Hiway";
  if (mapped === "Repas d'affaires" || (mk.includes("repas") && mk.includes("affair"))) return "Repas d'affaire";
  if (mapped === "Repas Ilias" || mk.includes("repas ilias")) return "Repas dirigeant";

  return "Autres";
}
