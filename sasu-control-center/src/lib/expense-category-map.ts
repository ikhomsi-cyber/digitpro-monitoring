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
/** Prélèvements DGFIP hors TVA (IS, CFE, etc.). */
export const IMPOT_CATEGORY_LABEL = "Impôt";

const RAW_ENTRIES: [string, string][] = [
  ["Frais de personnel", "BNC"],
  ["Impôts et taxes", "TVA"],
  ["Travel Expenses", IK_CATEGORY_LABEL],
  ["Dépenses liées au marketing", "Repas d'affaires"],
  ["Dépenses administratives", "Hiway"],
  ["Frais de nourriture et boissons", "Repas Ilias"],
  ["AXA SOGAREP", ASSURANCE_CATEGORY_LABEL],
  ["DSN", IMPOT_CATEGORY_LABEL],
  ["PAS", IMPOT_CATEGORY_LABEL]
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
    ["depenses liees au marketing", "Repas d'affaires"],
    ["marketing expenses", "Repas d'affaires"],
    ["depenses administratives", "Hiway"],
    ["administrative expenses", "Hiway"],
    ["frais de nourriture et boissons", "Repas Ilias"],
    ["food and drink", "Repas Ilias"],
    ["apple.com bill", ICLOUD_IA_STORE_CATEGORY_LABEL],
    ["cursor, ai powered ide", ICLOUD_IA_STORE_CATEGORY_LABEL],
    ["cursor ai powered ide", ICLOUD_IA_STORE_CATEGORY_LABEL],
    ["axa sogarep", ASSURANCE_CATEGORY_LABEL],
    ["sogarep", ASSURANCE_CATEGORY_LABEL],
    ["dsn", IMPOT_CATEGORY_LABEL],
    ["pas", IMPOT_CATEGORY_LABEL]
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
  return CATEGORY_MAP.get(normKey(t)) ?? t;
}
