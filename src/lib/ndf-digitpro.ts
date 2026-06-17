import type { DashboardTx } from "@/lib/dashboard-metrics";
import { isNdfCategorisationCandidate } from "@/lib/categorisation-candidates";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { amountNetOfRecoverableVat } from "@/lib/recoverable-expense-vat";

/** Libellé métier de la note de frais DigitPro (tag manuel depuis l'onglet Catégorisation). */
export const NDF_DIGITPRO_CATEGORY = "NDF DigitPro";

/** Fenêtre (jours) pour fusionner imports Bankin/Powens d'un même paiement carte. */
export const NDF_MERCHANT_DEDUPE_DAY_WINDOW = 3;

/** Autorisation Powens → débit comptabilisé (souvent J/J+1). */
export const POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW = 7;

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
  const stripped = stripPowensOperationalPrefix(raw)
    .replace(/\b(cb|carte|card|cblm|paiement|payment)\b/gi, " ")
    .replace(/\b\d{2,}\/\d{2,}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const withoutDaySuffix = stripBankRelativeDaySuffix(stripped);
  const normalized = stripTrailingCardholderFromMerchant(withoutDaySuffix);
  return normalized || stripPowensOperationalPrefix(raw).trim() || raw.trim();
}

/** Préfixes Powens ([En cours], [Carte], …). */
function stripPowensOperationalPrefix(label: string): string {
  return label.replace(/^(\[[^\]]+\]\s*)+/i, "").trim();
}

/** Suffixes banque (AUJ., HIER.) — pas le nom du commerçant. */
function stripBankRelativeDaySuffix(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return label.trim();
  const last = foldMerchantToken(words[words.length - 1] ?? "");
  if (last === "auj" || last === "hier") {
    return words.slice(0, -1).join(" ").trim();
  }
  return label.trim();
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

/** Libellé stocké issu d'une autorisation Powens « en cours ». */
export function isPowensComingStoredLabel(label: string): boolean {
  return /^\[en cours\]/i.test(label.trim());
}

/** Comparaison souple (YAKA vs YAKA AUJ.). */
export function ndfMerchantsMatch(normalizedA: string, normalizedB: string): boolean {
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (normalizedA.length >= 3 && normalizedB.includes(normalizedA)) return true;
  if (normalizedB.length >= 3 && normalizedA.includes(normalizedB)) return true;
  const tokenA = normalizedA.split(/\s+/)[0] ?? "";
  const tokenB = normalizedB.split(/\s+/)[0] ?? "";
  return tokenA.length >= 3 && tokenA === tokenB;
}

/** Même paiement carte à ±N jours (autorisation + débit comptabilisé). */
export function isNearDuplicateCardPayment(
  labelA: string,
  amountA: number,
  dateA: string,
  labelB: string,
  amountB: number,
  dateB: string,
  dayWindow = NDF_MERCHANT_DEDUPE_DAY_WINDOW
): boolean {
  if (Math.abs(Math.abs(amountA) - Math.abs(amountB)) > 0.005) return false;
  const effectiveWindow =
    isPowensComingStoredLabel(labelA) || isPowensComingStoredLabel(labelB)
      ? Math.max(dayWindow, POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW)
      : dayWindow;
  if (daysBetweenIso(dateA, dateB) > effectiveWindow) return false;
  return ndfMerchantsMatch(
    normalizeNdfMerchantForDedupe(labelA),
    normalizeNdfMerchantForDedupe(labelB)
  );
}

function findNearDuplicateNdfIndex(
  tx: DashboardTx,
  kept: readonly DashboardTx[]
): number {
  for (let i = 0; i < kept.length; i++) {
    const existing = kept[i]!;
    if (
      isNearDuplicateCardPayment(
        existing.label,
        existing.amount,
        existing.date,
        tx.label,
        tx.amount,
        tx.date
      )
    ) {
      return i;
    }
  }
  return -1;
}

/** Préfère la version comptabilisée à l'autorisation [En cours]. */
function shouldReplaceNdfWithCandidate(existing: DashboardTx, candidate: DashboardTx): boolean {
  if (isPowensComingStoredLabel(existing.label) && !isPowensComingStoredLabel(candidate.label)) {
    return true;
  }
  if (!isPowensComingStoredLabel(existing.label) && isPowensComingStoredLabel(candidate.label)) {
    return false;
  }
  return candidate.date.localeCompare(existing.date) > 0;
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
  const candidates = transactions
    .filter((tx) => tx.date.slice(0, 7) === monthKey && isNdfDigitProTx(tx))
    .sort((a, b) => {
      const comingA = isPowensComingStoredLabel(a.label) ? 1 : 0;
      const comingB = isPowensComingStoredLabel(b.label) ? 1 : 0;
      if (comingA !== comingB) return comingA - comingB;
      return b.date.localeCompare(a.date);
    });

  const kept: DashboardTx[] = [];
  let totalEur = 0;

  for (const tx of candidates) {
    const amt = Math.abs(tx.amount);
    const dupIndex = findNearDuplicateNdfIndex(tx, kept);
    if (dupIndex >= 0) {
      const existing = kept[dupIndex]!;
      if (shouldReplaceNdfWithCandidate(existing, tx)) {
        totalEur -= Math.abs(existing.amount);
        totalEur += amt;
        kept[dupIndex] = tx;
      }
      continue;
    }
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
  const validatedNdf = summarizeNdfDigitProForMonth(transactions, monthKey).transactions;
  return transactions
    .filter((tx) => {
      if (tx.date.slice(0, 7) !== monthKey) return false;
      if ((tx.scope ?? "pro") !== scope) return false;
      if (isPowensComingStoredLabel(tx.label)) return false;
      return isNdfCategorisationCandidate({
        label: tx.label,
        amount: tx.amount,
        company: "",
        category: tx.category
      });
    })
    .filter(
      (tx) =>
        !validatedNdf.some((validated) =>
          isNearDuplicateCardPayment(
            validated.label,
            validated.amount,
            validated.date,
            tx.label,
            tx.amount,
            tx.date,
            POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW
          )
        )
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
