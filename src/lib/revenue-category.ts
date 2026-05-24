/**
 * Single source of truth for what "Chiffre d'affaires" means in the dashboard.
 * All KPIs, charts, IA context and exports MUST go through these helpers
 * so the totals always stay aligned.
 *
 * Matching rules:
 *   - Case insensitive
 *   - Accents stripped ("affaires" / "affäires" → same)
 *   - Apostrophes (typographic or straight) treated as spaces
 *   - Singular AND plural accepted ("chiffre d'affaire" or "chiffre d'affaires")
 *   - Prefix match accepted, so sub-categories like
 *     "Chiffre d'affaires - Client X" still count
 */

function normalize(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REVENUE_PREFIX_RE = /^chiffre d ?affaires?\b/;

export function isRevenueCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return REVENUE_PREFIX_RE.test(normalize(category));
}

/** Display label used by the dashboard (canonical French spelling). */
export const REVENUE_CATEGORY_LABEL = "Chiffre d’affaires";

/**
 * Contreparties connues : si le libellé bancaire les contient, on regroupe sous un nom court
 * (ex. « Virement Skylab Consulting · REF-42 » → « Skylab Consulting »).
 */
const REVENUE_COUNTERPARTY_CANONICAL: Array<{ re: RegExp; display: string }> = [
  { re: /\bskylab\s+consulting\b/i, display: "Skylab Consulting" },
  { re: /\bsyrtals\b/i, display: "Syrtals" }
];

function canonicalCounterpartyFromLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  for (const { re, display } of REVENUE_COUNTERPARTY_CANONICAL) {
    if (re.test(trimmed)) return display;
  }
  return null;
}

/**
 * Libellé pour regrouper les encaissements CA par **contrepartie / client**.
 *
 * En pratique (Qonto, CSV) le nom du payeur ou du libellé métier (ex. virement **Syrtals**,
 * **Skylab**, facture client) est porté par le **libellé d’opération** — colonnes type
 * « Libellé », « Contrepartie », `label` côté API — pas par `company`, qui correspond au
 * **compte bancaire** (« Nom du compte »).
 */
export function revenueCounterpartyDisplayName(tx: {
  label?: string | null;
  company?: string | null;
}): string {
  const fromLabel = (tx.label ?? "").trim();
  if (fromLabel) {
    const short = canonicalCounterpartyFromLabel(fromLabel);
    if (short) return short;
    return fromLabel;
  }
  const fromCo = (tx.company ?? "").trim();
  if (fromCo) return fromCo;
  return "Contrepartie non renseignée";
}
