import type { DashboardTx } from "@/lib/dashboard-metrics";
import { isNdfCategorisationCandidate } from "@/lib/categorisation-candidates";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { amountNetOfRecoverableVat } from "@/lib/recoverable-expense-vat";

/** Libellé métier de la note de frais DigitPro (tag manuel depuis l'onglet Catégorisation). */
export const NDF_DIGITPRO_CATEGORY = "NDF DigitPro";

/** Fenêtre (jours) pour fusionner imports Bankin/Powens d'un même paiement carte. */
const NDF_MERCHANT_DEDUPE_DAY_WINDOW = 3;

/**
 * Tokens de fin de libellé qui ne sont pas un nom de porteur de carte
 * (ville, enseigne, type de commerce…).
 */
const MERCHANT_TAIL_TOKENS = new Set(
  [
    "paris",
    "lyon",
    "marseille",
    "lille",
    "bordeaux",
    "toulouse",
    "nantes",
    "nice",
    "strasbourg",
    "montpellier",
    "rennes",
    "market",
    "city",
    "centre",
    "nord",
    "sud",
    "est",
    "ouest",
    "club",
    "cafe",
    "restaurant",
    "resto",
    "brasserie",
    "bistrot",
    "sushi",
    "pizza",
    "burger",
    "express",
    "shop",
    "store",
    "france",
    "digitpro"
  ].map((w) => w.toLowerCase())
);

/**
 * Vrai si la transaction est une note de frais DigitPro taguée manuellement
 * (carte du dirigeant à rembourser, reclassée « NDF DigitPro » dans Catégorisation).
 */
export function isNdfDigitProTx(tx: DashboardTx): boolean {
  if (tx.amount >= 0) return false;
  return mapExpenseCategoryLabel(tx.category) === NDF_DIGITPRO_CATEGORY;
}

/** Montant HT d'une NDF DigitPro (TVA repas 10 % déduite quand récupérable). */
export function ndfDigitProAmountHtEur(tx: DashboardTx): number {
  const grossEur = Math.abs(tx.amount);
  const bucket = deriveExpenseBucket(tx);
  return amountNetOfRecoverableVat(tx, bucket, grossEur);
}

function foldMerchantToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function looksLikePersonNameToken(token: string): boolean {
  const folded = foldMerchantToken(token);
  if (folded.length < 2 || !/^[a-z]+$/.test(folded)) return false;
  if (MERCHANT_TAIL_TOKENS.has(folded)) return false;
  return true;
}

/**
 * Retire le nom du porteur de carte souvent suffixé par Powens / la banque
 * (ex. « SUSHI CLUB ILIASS KHOMSI » → « SUSHI CLUB »).
 */
export function stripTrailingCardholderFromMerchant(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return label.trim();

  const last = words[words.length - 1]!;
  const beforeLast = words[words.length - 2]!;
  if (looksLikePersonNameToken(last) && looksLikePersonNameToken(beforeLast)) {
    return words.slice(0, -2).join(" ").trim();
  }

  return label.trim();
}

/** Nettoie un libellé bancaire (CB, dates, numéros, nom porteur) pour affichage et dédup. */
export function cleanNdfMerchantLabel(raw: string): string {
  const stripped = raw
    .replace(/\b(cb|carte|card|cblm|paiement|payment)\b/gi, " ")
    .replace(/\b\d{2,}\/\d{2,}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = stripTrailingCardholderFromMerchant(stripped);
  return normalized || raw.trim();
}

/** Clé commerçant normalisée pour le dédoublonnage inter-imports. */
export function normalizeNdfMerchantForDedupe(raw: string): string {
  return cleanNdfMerchantLabel(raw).toLowerCase();
}

function daysBetweenIso(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T12:00:00`);
  const db = new Date(`${b.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(da.getTime() - db.getTime()) / 86_400_000);
}

function isNearDuplicateNdf(
  merchant: string,
  amountEur: number,
  date: string,
  kept: readonly DashboardTx[]
): boolean {
  for (const existing of kept) {
    const existingMerchant = normalizeNdfMerchantForDedupe(existing.label);
    const existingAmount = Math.abs(existing.amount);
    if (existingMerchant !== merchant) continue;
    if (Math.abs(existingAmount - amountEur) > 0.005) continue;
    if (daysBetweenIso(existing.date, date) <= NDF_MERCHANT_DEDUPE_DAY_WINDOW) return true;
  }
  return false;
}

export type NdfDigitProMonthSummary = {
  /** Somme TTC des NDF DigitPro du mois (valeur absolue). */
  totalEur: number;
  /** Transactions NDF DigitPro du mois, dédoublonnées, triées par date décroissante. */
  transactions: DashboardTx[];
};

/**
 * Agrège les notes de frais DigitPro pour un mois civil (YYYY-MM).
 * Dédoublonnage : commerçant normalisé + montant + dates à ±3 jours (imports Bankin/Powens).
 */
export function summarizeNdfDigitProForMonth(
  transactions: readonly DashboardTx[],
  monthKey: string
): NdfDigitProMonthSummary {
  const kept: DashboardTx[] = [];
  let totalEur = 0;

  for (const tx of transactions) {
    if (tx.date.slice(0, 7) !== monthKey) continue;
    if (!isNdfDigitProTx(tx)) continue;
    const amt = Math.abs(tx.amount);
    const merchant = normalizeNdfMerchantForDedupe(tx.label);
    if (isNearDuplicateNdf(merchant, amt, tx.date, kept)) continue;
    totalEur += amt;
    kept.push(tx);
  }

  kept.sort((a, b) => b.date.localeCompare(a.date));
  return { totalEur: Math.round(totalEur * 100) / 100, transactions: kept };
}

/** Libellé date relatif pour la liste NDF (Aujourd’hui, Hier, ou date courte). */
export function formatNdfTxDateLabel(iso: string, now = new Date()): string {
  const day = iso.slice(0, 10);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;
  if (day === today) return "Aujourd’hui";
  if (day === yesterday) return "Hier";
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1)
  );
}

/** Paiements carte du mois encore à valider en NDF DigitPro (onglet Catégorisation). */
export function listPendingNdfCandidatesForMonth(
  transactions: readonly DashboardTx[],
  monthKey: string,
  scope: "pro" | "personal" = "pro"
): DashboardTx[] {
  return transactions
    .filter((tx) => {
      if (tx.date.slice(0, 7) !== monthKey) return false;
      if ((tx.scope ?? "pro") !== scope) return false;
      return isNdfCategorisationCandidate({
        label: tx.label,
        amount: tx.amount,
        company: "",
        category: tx.category
      });
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
