import { mapHiwayExpenseCategory } from "@/lib/hiway-categorisation";

/**
 * Libellés Qonto (cashflow / catégorie API / CSV) → libellés affichés dans l’app.
 * Correspondance demandée côté produit (clés insensibles à la casse / accents).
 */
const IK_CATEGORY_LABEL = "Indemnités kilométriques";

/** Abonnements Apple (facturation), Cursor IDE, etc. */
export const ICLOUD_IA_STORE_CATEGORY_LABEL = "iCloud IA Store";
export const QONTO_CATEGORY_LABEL = "Qonto";
export const ASSURANCE_CATEGORY_LABEL = "Assurance";
export const MUTUELLE_CATEGORY_LABEL = "Mutuelle";
export const MATERIEL_CATEGORY_LABEL = "Matériel";
/** Prélèvements DGFIP hors TVA (IS, CFE, etc.). */
export const IMPOT_CATEGORY_LABEL = "Impôt";
/** Regroupement affiché pour frais de compta / secrétariat / outils de gestion (libellés bancaires « hiway », etc.). */
export const COMPTA_ADMIN_BUCKET_LABEL = "Compta & admin.";

const RAW_ENTRIES: [string, string][] = [
  /** Notes DigitPro (Bankin) : libellé métier distinct, mêmes règles analytiques que NDF. */
  ["NDF DigitPro", "NDF DigitPro"],
  ["Notes de frais", "NDF"],
  ["Note de frais", "NDF"],
  ["Frais de personnel", "BNC"],
  ["Impôts et taxes", "TVA"],
  ["Travel Expenses", IK_CATEGORY_LABEL],
  ["Repas d’affaires", "Repas d'affaires"],
  ["Dépenses liées au marketing", "Repas d'affaires"],
  ["Abonnement Hiway", COMPTA_ADMIN_BUCKET_LABEL],
  ["Hiway compta", COMPTA_ADMIN_BUCKET_LABEL],
  ["Dépenses administratives", COMPTA_ADMIN_BUCKET_LABEL],
  ["Frais de nourriture et boissons", "Repas dirigeant"],
  ["Repas du dirigeant", "Repas dirigeant"],
  ["Repas dirigeant", "Repas dirigeant"],
  ["Restauration pro", "Repas dirigeant"],
  ["Déjeuner", "Repas dirigeant"],
  ["Dejeuner", "Repas dirigeant"],
  ["Matériel", MATERIEL_CATEGORY_LABEL],
  ["Materiel", MATERIEL_CATEGORY_LABEL],
  ["Matériels et fournitures", MATERIEL_CATEGORY_LABEL],
  ["Materiels et fournitures", MATERIEL_CATEGORY_LABEL],
  ["Fournitures", MATERIEL_CATEGORY_LABEL],
  ["Retraite", "Retraite"],
  ["Mutuelle", MUTUELLE_CATEGORY_LABEL],
  ["Prévoyance collective", MUTUELLE_CATEGORY_LABEL],
  ["Prevoyance collective", MUTUELLE_CATEGORY_LABEL],
  ["Wemind", MUTUELLE_CATEGORY_LABEL],
  ["We Mind", MUTUELLE_CATEGORY_LABEL],
  ["Abonnement internet & mobile", "Mobile et Internet"],
  ["Assurances", ASSURANCE_CATEGORY_LABEL],
  ["Frais bancaires", QONTO_CATEGORY_LABEL],
  ["Non catégorisé", "Autres"],
  ["Non categorise", "Autres"],
  ["Abonnement logiciel", ICLOUD_IA_STORE_CATEGORY_LABEL],
  ["AXA SOGAREP", ASSURANCE_CATEGORY_LABEL]
];

function normKey(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[''`´]/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [from, to] of RAW_ENTRIES) {
    m.set(normKey(from), to);
  }
  /** Variantes fréquentes (API EN, slugs humanisés). */
  const aliases: [string, string][] = [
    ["impots et taxes", "TVA"],
    ["travel expenses", IK_CATEGORY_LABEL],
    ["frais de voyage", IK_CATEGORY_LABEL],
    ["frais kilometriques", IK_CATEGORY_LABEL],
    ["indemnites kilometriques", IK_CATEGORY_LABEL],
    ["indemnites kilometriques et deplacement", IK_CATEGORY_LABEL],
    ["indemnites ik", IK_CATEGORY_LABEL],
    ["note ik", IK_CATEGORY_LABEL],
    ["mileage", IK_CATEGORY_LABEL],
    ["repas d affaires", "Repas d'affaires"],
    ["depenses liees au marketing", "Repas d'affaires"],
    ["marketing expenses", "Repas d'affaires"],
    ["abonnement hiway", COMPTA_ADMIN_BUCKET_LABEL],
    ["hiway compta", COMPTA_ADMIN_BUCKET_LABEL],
    ["depenses administratives", COMPTA_ADMIN_BUCKET_LABEL],
    ["administrative expenses", COMPTA_ADMIN_BUCKET_LABEL],
    ["frais de nourriture et boissons", "Repas dirigeant"],
    ["food and drink", "Repas dirigeant"],
    ["repas du dirigeant", "Repas dirigeant"],
    ["repas dirigeant", "Repas dirigeant"],
    ["repas ilias", "Repas dirigeant"],
    ["restauration pro", "Repas dirigeant"],
    ["dejeuner", "Repas dirigeant"],
    ["déjeuner", "Repas dirigeant"],
    ["materiel", MATERIEL_CATEGORY_LABEL],
    ["matériel", MATERIEL_CATEGORY_LABEL],
    ["materiels et fournitures", MATERIEL_CATEGORY_LABEL],
    ["matériels et fournitures", MATERIEL_CATEGORY_LABEL],
    ["fournitures", MATERIEL_CATEGORY_LABEL],
    ["retraite", "Retraite"],
    ["mutuelle", MUTUELLE_CATEGORY_LABEL],
    ["wemind", MUTUELLE_CATEGORY_LABEL],
    ["we mind", MUTUELLE_CATEGORY_LABEL],
    ["prevoyance", MUTUELLE_CATEGORY_LABEL],
    ["prévoyance", MUTUELLE_CATEGORY_LABEL],
    ["prevoyance collective", MUTUELLE_CATEGORY_LABEL],
    ["prévoyance collective", MUTUELLE_CATEGORY_LABEL],
    ["abonnement internet mobile", "Mobile et Internet"],
    ["abonnement internet & mobile", "Mobile et Internet"],
    ["assurances", ASSURANCE_CATEGORY_LABEL],
    ["frais bancaires", QONTO_CATEGORY_LABEL],
    ["non categorise", "Autres"],
    ["non catégorisé", "Autres"],
    ["abonnement logiciel", ICLOUD_IA_STORE_CATEGORY_LABEL],
    ["apple.com bill", ICLOUD_IA_STORE_CATEGORY_LABEL],
    ["cursor, ai powered ide", ICLOUD_IA_STORE_CATEGORY_LABEL],
    ["cursor ai powered ide", ICLOUD_IA_STORE_CATEGORY_LABEL],
    ["axa sogarep", ASSURANCE_CATEGORY_LABEL],
    ["sogarep", ASSURANCE_CATEGORY_LABEL],
    ["notes de frais", "NDF"],
    ["note de frais", "NDF"]
  ];
  for (const [k, v] of aliases) {
    if (!m.has(k)) m.set(k, v);
  }
  return m;
}

const CATEGORY_MAP = buildMap();

/** Libellé dashboard pour les remboursements / notes IK (Qonto, import). */
export { IK_CATEGORY_LABEL };

/** Retourne le libellé affiché pour une catégorie Qonto / import ; sinon la chaîne d’origine (trim). */
export function mapExpenseCategoryLabel(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return t;
  const hiwayCategory = mapHiwayExpenseCategory(t);
  if (hiwayCategory) return CATEGORY_MAP.get(normKey(hiwayCategory)) ?? hiwayCategory;
  return CATEGORY_MAP.get(normKey(t)) ?? t;
}
