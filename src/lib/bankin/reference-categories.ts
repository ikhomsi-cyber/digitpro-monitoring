import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { normalizeNdfMerchantForDedupe } from "@/lib/ndf-digitpro";
import { isBankinUncategorizedCategory } from "./categorize";

export const BANKIN_CORE_REFERENCE_CATEGORIES = [
  "BNC",
  "NDF DigitPro",
  "NDF",
  "Indemnités kilométriques",
  "CESU",
  "TVA",
  "Impôt",
  "Urssaf",
  "Qonto",
  "Assurance",
  "Mutuelle",
  "Mobile et Internet",
  "Compta & admin.",
  "Repas d'affaire",
  "Repas dirigeant",
  "iCloud IA Store"
] as const;

export function normalizeBankinReferenceCategory(category: string | null | undefined): string {
  return mapExpenseCategoryLabel(String(category ?? "").trim());
}

export function buildBankinReferenceCategoryList(categories: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const category of BANKIN_CORE_REFERENCE_CATEGORIES) {
    set.add(normalizeBankinReferenceCategory(category));
  }
  for (const raw of categories) {
    const category = normalizeBankinReferenceCategory(raw);
    if (category && !isBankinUncategorizedCategory(category)) set.add(category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}

export type BankinReferenceTransaction = {
  label: string | null | undefined;
  category: string | null | undefined;
};

export type BankinPersonalReferenceModel = {
  categories: Set<string>;
  categoryByMerchant: Map<string, string>;
};

/**
 * Dictionnaire déterministe appris depuis les exports Bankin privés.
 * Une enseigne ambiguë n'est volontairement pas retenue : elle restera à catégoriser.
 */
export function buildBankinPersonalReferenceModel(
  transactions: Iterable<BankinReferenceTransaction>
): BankinPersonalReferenceModel {
  const categories = new Set<string>();
  const votesByMerchant = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    const category = String(transaction.category ?? "").trim();
    if (!category || isBankinUncategorizedCategory(category)) continue;
    // Les anciens raccourcis métier ne font pas partie de la taxonomie privée Bankin.
    if (!category.includes(" › ")) continue;
    categories.add(category);

    const merchant = normalizeNdfMerchantForDedupe(String(transaction.label ?? ""));
    if (!merchant) continue;
    const votes = votesByMerchant.get(merchant) ?? new Map<string, number>();
    votes.set(category, (votes.get(category) ?? 0) + 1);
    votesByMerchant.set(merchant, votes);
  }

  const categoryByMerchant = new Map<string, string>();
  for (const [merchant, votes] of votesByMerchant) {
    const ranked = Array.from(votes.entries()).sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((sum, [, count]) => sum + count, 0);
    const winner = ranked[0];
    const runnerUp = ranked[1];
    if (!winner) continue;
    const confidence = winner[1] / total;
    if (confidence >= 0.75 && (!runnerUp || winner[1] > runnerUp[1])) {
      categoryByMerchant.set(merchant, winner[0]);
    }
  }

  return { categories, categoryByMerchant };
}

export function resolveBankinPersonalCategory(
  model: BankinPersonalReferenceModel,
  candidateCategory: string | null | undefined,
  label: string | null | undefined
): string | null {
  const candidate = String(candidateCategory ?? "").trim();
  if (candidate && model.categories.has(candidate)) return candidate;
  const merchant = normalizeNdfMerchantForDedupe(String(label ?? ""));
  return merchant ? model.categoryByMerchant.get(merchant) ?? null : null;
}
