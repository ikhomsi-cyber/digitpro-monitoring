/**
 * Libellés Qonto (cashflow / catégorie API / CSV) → libellés affichés dans l’app.
 * Correspondance demandée côté produit (clés insensibles à la casse / accents).
 */
const RAW_ENTRIES: [string, string][] = [
  ["Frais de personnel", "BNC"],
  ["Impôts et taxes", "TVA"],
  ["Travel Expenses", "Indemnités Kilometriques et deplacement"],
  ["Dépenses liées au marketing", "Repas d'affaires"],
  ["Dépenses administratives", "Hiway"],
  ["Frais de nourriture et boissons", "Repas Ilias"],
  ["Frais bancaires", "Qonto"]
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
    ["travel expenses", "Indemnités Kilometriques et deplacement"],
    ["frais de voyage", "Indemnités Kilometriques et deplacement"],
    ["depenses liees au marketing", "Repas d'affaires"],
    ["marketing expenses", "Repas d'affaires"],
    ["depenses administratives", "Hiway"],
    ["administrative expenses", "Hiway"],
    ["frais de nourriture et boissons", "Repas Ilias"],
    ["food and drink", "Repas Ilias"],
    ["frais bancaires", "Qonto"],
    ["bank fees", "Qonto"]
  ];
  for (const [k, v] of aliases) {
    if (!m.has(k)) m.set(k, v);
  }
  return m;
}

const CATEGORY_MAP = buildMap();

/** Retourne le libellé affiché pour une catégorie Qonto / import ; sinon la chaîne d’origine (trim). */
export function mapExpenseCategoryLabel(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return t;
  return CATEGORY_MAP.get(normKey(t)) ?? t;
}
