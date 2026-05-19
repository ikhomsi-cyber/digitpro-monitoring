import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
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
