import { isBankinUncategorizedCategory } from "@/lib/bankin/categorize";
import { dashboardMonthKeyNowLocal } from "@/lib/dashboard-period";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { NDF_DIGITPRO_CATEGORY } from "@/lib/ndf-digitpro";

export type CategorisationCandidateRow = {
  id: string;
  date: string;
  label: string | null;
  amount: number | string;
  company: string | null;
  bank_name: string | null;
  category?: string | null;
};

export type CategorisationCandidateTx = {
  id: string;
  date: string;
  label: string;
  amount: number;
  company: string;
  bankName: string | null;
  category: string;
};

export function isTransactionInCategorisationMonth(isoDate: string, monthKey: string): boolean {
  return isoDate.slice(0, 7) === monthKey;
}

/** Bornes ISO inclusives pour filtrer les transactions d'un mois civil (YYYY-MM). */
export function categorisationMonthBounds(monthKey: string): { startIso: string; endIso: string } {
  const [year, month1] = monthKey.split("-").map(Number);
  const startIso = `${monthKey}-01`;
  const lastDay = new Date(year, month1, 0).getDate();
  const endIso = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  return { startIso, endIso };
}

export function currentCategorisationMonthKey(now = new Date()): string {
  return dashboardMonthKeyNowLocal(now);
}

export function normalizeCategory(raw: unknown): string {
  return String(raw ?? "").trim();
}

function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function isAlreadyTaggedNdfDigitPro(category: string | null | undefined): boolean {
  return mapExpenseCategoryLabel(normalizeCategory(category)) === NDF_DIGITPRO_CATEGORY;
}

/** Catégories Powens/Bankin où l’utilisateur doit encore valider une NDF DigitPro. */
export function isPendingNdfCategorization(category: string | null | undefined): boolean {
  const raw = normalizeCategory(category);
  if (!raw) return true;
  if (isAlreadyTaggedNdfDigitPro(raw)) return false;
  if (isBankinUncategorizedCategory(raw)) return true;

  const f = fold(raw);
  if (f.includes("infere") || f.includes("inféré")) {
    if (
      f.includes("alimentation") ||
      f.includes("restau") ||
      f.includes("fast food") ||
      f.includes("cafe") ||
      f.includes("café")
    ) {
      return true;
    }
  }
  if (f.includes("alimentation") && f.includes("restau")) return true;
  return false;
}

/** Paiement carte Powens / Qonto (libellés variés, pas toujours « CB »). */
export function isCardPowensLabel(raw: string): boolean {
  const label = fold(raw);
  if (label.startsWith("[en cours]")) return true;
  if (/\b(cb|carte|card|cblm|paiement carte|payment card)\b/.test(label)) return true;
  if (/\bpayment\b/.test(label) && !/\b(virement|vir\.|transfer|wise)\b/.test(label)) return true;
  if (/\b(visa|mastercard|mc\s)/.test(label)) return true;
  return false;
}

export function isLikelyNdfDigitProCandidate(raw: string): boolean {
  const label = fold(raw);
  if (
    /\b(quick|domino|dominos|tacos|boucherie|boucheries|auchan|grand frais|carrefour|leclerc|lidl|intermarche|super u|supermarche)\b/.test(
      label
    )
  ) {
    return false;
  }
  return /\b(repas|dejeuner|dej|restaurant|resto|brasserie|bistrot|cafe|burger|pizza|sushi|monoprix|franprix|deliveroo|uber\s*eats|just\s*eat|club|snack|boulangerie|traiteur|bar\b|kebab|wok|ramen|poke|gourmet)/.test(
    label
  );
}

export function isNdfCategorisationCandidate(tx: {
  label: string;
  amount: number;
  company: string;
  category?: string | null;
}): boolean {
  if (tx.amount >= 0) return false;
  if (isAlreadyTaggedNdfDigitPro(tx.category)) return false;
  if (!isPendingNdfCategorization(tx.category)) return false;

  const blob = `${tx.label} ${tx.company}`;
  if (isLikelyNdfDigitProCandidate(blob)) return true;
  if (isBankinUncategorizedCategory(tx.category ?? "") && isCardPowensLabel(blob)) return true;
  return false;
}

const NDF_REJECTION_PREFERENCES = ["Repas dirigeant", "Matériel", "Mobile et Internet", "Repas d'affaire"] as const;

/** Catégorie appliquée quand l'utilisateur exclut un paiement de la file NDF. */
export function resolveNdfRejectionCategory(
  tx: { label: string; company: string },
  categories: readonly string[]
): string {
  const blob = `${tx.label} ${tx.company}`;
  const preferred = isLikelyNdfDigitProCandidate(blob) ? "Repas dirigeant" : "Matériel";
  const exact = categories.find((c) => fold(c) === fold(preferred));
  if (exact) return exact;

  for (const pref of NDF_REJECTION_PREFERENCES) {
    const match = categories.find((c) => fold(c) === fold(pref));
    if (match) return match;
  }

  return (
    categories.find((c) => fold(c) !== fold(NDF_DIGITPRO_CATEGORY)) ??
    preferred
  );
}

export function mapCategorisationCandidateRows(
  rows: readonly CategorisationCandidateRow[],
  monthKey: string = currentCategorisationMonthKey()
): CategorisationCandidateTx[] {
  return rows
    .map((row) => ({
      id: String(row.id),
      date: String(row.date).slice(0, 10),
      label: String(row.label ?? ""),
      amount: Number(row.amount),
      company: String(row.company ?? "").trim(),
      bankName: row.bank_name ? String(row.bank_name).trim() : null,
      category: normalizeCategory(row.category)
    }))
    .filter(
      (tx) => isTransactionInCategorisationMonth(tx.date, monthKey) && isNdfCategorisationCandidate(tx)
    );
}
