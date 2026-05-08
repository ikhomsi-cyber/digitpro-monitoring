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
