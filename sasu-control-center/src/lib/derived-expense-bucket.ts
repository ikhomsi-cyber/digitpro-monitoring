import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  ASSURANCE_CATEGORY_LABEL,
  ICLOUD_IA_STORE_CATEGORY_LABEL,
  IK_CATEGORY_LABEL,
  IMPOT_CATEGORY_LABEL,
  COMPTA_ADMIN_BUCKET_LABEL,
  mapExpenseCategoryLabel,
  MUTUELLE_CATEGORY_LABEL,
  QONTO_CATEGORY_LABEL
} from "@/lib/expense-category-map";

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
  QONTO_CATEGORY_LABEL,
  ASSURANCE_CATEGORY_LABEL,
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

/** Abonnement Qonto offre solo_basic (ex. libellé « Qonto · solo_basic »). */
function textLooksLikeQontoSoloBasic(b: string): boolean {
  if (!b.includes("qonto")) return false;
  return b.includes("solo_basic") || b.includes("solo basic");
}

/**
 * Prélèvement à la source (PAS) : le mot « pas » seul est ambigu en français (« ce n’est pas »).
 */
function textLooksLikePasImpot(b: string): boolean {
  if (!/\bpas\b/.test(b)) return false;
  return (
    b.includes("prelevement") ||
    b.includes("prlv") ||
    b.includes("dgfip") ||
    b.includes("gfip") ||
    b.includes("a la source") ||
    b.includes("retenue") ||
    b.includes("liberatoire") ||
    b.includes("impot") ||
    b.includes("dts") ||
    /^pas[-\s]/.test(b) ||
    b.startsWith("pas ")
  );
}

/** Indemnités kilométriques / IK (libellé, catégorie ou mention « IK »). */
function textLooksLikeIndemniteKilometrique(b: string): boolean {
  if (/\bik\b/.test(b)) return true;
  if (b.includes("indemnite") && b.includes("kilomet")) return true;
  if (b.includes("indemnites") && b.includes("kilomet")) return true;
  if (b.includes("kilometrique") && b.includes("indemn")) return true;
  if (b.includes("frais kilomet") || b.includes("note kilomet")) return true;
  return false;
}

/**
 * Catégorie d’affichage pour une dépense (montant &lt; 0).
 * Ordre des règles : plus spécifique d’abord.
 */
export function deriveExpenseBucket(tx: DashboardTx): DerivedExpenseBucket {
  if (tx.amount >= 0) return "Autres";

  const b = txBlob(tx);

  if (b.includes("note de frais") || b.includes("notes de frais") || /\bndf\b/.test(b)) return "NDF";

  if (b.includes("hiway")) return COMPTA_ADMIN_BUCKET_LABEL;

  if (textLooksLikeIndemniteKilometrique(b)) return IK_CATEGORY_LABEL;

  if (
    b.includes("apple.com/bill") ||
    b.includes("apple com bill") ||
    b.includes("apple.com bill") ||
    (b.includes("cursor") && (b.includes("ai powered") || /\bide\b/.test(b)))
  ) {
    return ICLOUD_IA_STORE_CATEGORY_LABEL;
  }

  if (textLooksLikeQontoSoloBasic(b)) return QONTO_CATEGORY_LABEL;

  /** AXA / SOGAREP (ex. « AXA SOGAREP », SOGAREP seul, ou AXA assurance). */
  if (b.includes("sogarep") || /\baxa\b/.test(b)) return ASSURANCE_CATEGORY_LABEL;

  if (b.includes("wemind")) return MUTUELLE_CATEGORY_LABEL;

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

  if (/\bdsn\b/.test(b) || textLooksLikePasImpot(b)) return IMPOT_CATEGORY_LABEL;

  if (
    b.includes("urssaf") ||
    b.includes("cgss") ||
    b.includes("cotisation sociale") ||
    b.includes("cotisations sociales")
  ) {
    return "Urssaf";
  }

  if (b.includes("dgfip")) {
    if (b.includes("tva")) return "TVA";
    return IMPOT_CATEGORY_LABEL;
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
    (b.includes("restaurant") && (b.includes("affaire") || b.includes("invitation")))
  ) {
    return "Repas d'affaire";
  }

  const mapped = mapExpenseCategoryLabel(tx.category);
  const mk = fold(mapped);
  if (mapped === "NDF" || mk.includes("note de frais") || mk === "ndf") return "NDF";
  if (mk === "bnc" || mapped === "BNC") return "BNC";
  if (mk === "tva" || mapped === "TVA") return "TVA";
  if (
    mapped === IMPOT_CATEGORY_LABEL ||
    mk === "impot" ||
    /\bdsn\b/.test(mk) ||
    textLooksLikePasImpot(mk) ||
    textLooksLikePasImpot(b)
  ) {
    return IMPOT_CATEGORY_LABEL;
  }
  if (mapped === COMPTA_ADMIN_BUCKET_LABEL) return COMPTA_ADMIN_BUCKET_LABEL;
  if (mapped === IK_CATEGORY_LABEL || textLooksLikeIndemniteKilometrique(mk)) return IK_CATEGORY_LABEL;
  if (mapped === ICLOUD_IA_STORE_CATEGORY_LABEL || mk.includes("icloud ia store")) {
    return ICLOUD_IA_STORE_CATEGORY_LABEL;
  }
  if (
    mapped === ASSURANCE_CATEGORY_LABEL ||
    mk === "assurance" ||
    (mk.includes("axa") && mk.includes("sogarep")) ||
    mk.includes("sogarep")
  ) {
    return ASSURANCE_CATEGORY_LABEL;
  }
  if (mapped === MUTUELLE_CATEGORY_LABEL || mk === "mutuelle") return MUTUELLE_CATEGORY_LABEL;
  if (mapped === "Repas d'affaires" || (mk.includes("repas") && mk.includes("affair"))) return "Repas d'affaire";
  if (mapped === "Repas Ilias" || mk.includes("repas ilias")) return "Repas dirigeant";

  return "Autres";
}
