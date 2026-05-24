import { bankinSubcategoryLabel } from "@/lib/bankin/categorize";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { firstDayOfNextCalendarMonthIso, isPersonalInternalTransferMovement } from "@/lib/dashboard-metrics";
import {
  LMNP_APPART_ARGENTEUIL_MARKERS,
  LMNP_EXPENSE_KEYWORD_GROUPS,
  LMNP_LOYER_ANALYTIC_MONTH_AFTER_DAY,
  LMNP_LOYERS_RECUS_MARKERS,
  LMNP_PROPERTY,
  type LmnpTransactionScopeFilter
} from "@/lib/lmnp-config";

function fold(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function txBlob(tx: DashboardTx): string {
  return fold(`${tx.label} ${tx.company} ${tx.category}`);
}

function matchesScope(tx: DashboardTx, mode: LmnpTransactionScopeFilter): boolean {
  if (mode === "all") return true;
  return (tx.scope ?? "pro") === "personal";
}

function hasLocationHint(blob: string): boolean {
  const c = fold(LMNP_PROPERTY.cityLabel);
  const pc = fold(LMNP_PROPERTY.postalCode);
  return blob.includes(c) || blob.includes(pc);
}

function hasLmnpTag(blob: string): boolean {
  return /\blmnp\b/.test(blob) || blob.includes("lmnp ");
}

/**
 * Sous-catégorie Bankin « Loyers Reçus » / « Loyers Recus » (libellé après ` › ` ou catégorie pleine).
 */
export function matchesLoyersRecusSubcategory(tx: DashboardTx): boolean {
  const sub = fold(bankinSubcategoryLabel(tx.category));
  const full = fold(tx.category);
  for (const marker of LMNP_LOYERS_RECUS_MARKERS) {
    const m = fold(marker);
    if (sub.includes(m) || full.includes(m)) return true;
  }
  return false;
}

/**
 * Sous-catégorie Bankin « Appart Argenteuil » (tolérance typo « Argneteuil »).
 * Les débits dans cette sous-catégorie alimentent le prix d’achat agrégé (`purchasePriceEur`).
 */
export function matchesAppartArgenteuilSubcategory(tx: DashboardTx): boolean {
  const sub = fold(bankinSubcategoryLabel(tx.category));
  const full = fold(tx.category);
  for (const marker of LMNP_APPART_ARGENTEUIL_MARKERS) {
    const m = fold(marker);
    if (sub.includes(m) || full.includes(m)) return true;
  }
  return false;
}

/**
 * Loyers reçus : encaissement classé en sous-catégorie « Loyers Reçus » / « Loyers Recus ».
 */
export function isLmnpRentalIncome(tx: DashboardTx): boolean {
  if (!matchesScope(tx, LMNP_PROPERTY.transactionScope)) return false;
  if (tx.amount <= 0) return false;
  if (isPersonalInternalTransferMovement(tx)) return false;
  return matchesLoyersRecusSubcategory(tx);
}

/**
 * Achat de l’appart (débit) : sous-catégorie « Appart Argenteuil ».
 */
export function isLmnpApartmentPurchase(tx: DashboardTx): boolean {
  if (!matchesScope(tx, LMNP_PROPERTY.transactionScope)) return false;
  if (tx.amount >= 0) return false;
  if (isPersonalInternalTransferMovement(tx)) return false;
  return matchesAppartArgenteuilSubcategory(tx);
}

/**
 * Autres dépenses LMNP (charges), hors achat immobilier.
 */
export function isLmnpExpense(tx: DashboardTx): boolean {
  if (!matchesScope(tx, LMNP_PROPERTY.transactionScope)) return false;
  if (tx.amount >= 0) return false;
  if (isPersonalInternalTransferMovement(tx)) return false;
  if (isLmnpApartmentPurchase(tx)) return false;

  const blob = txBlob(tx);
  const loc = hasLocationHint(blob);
  const lmnp = hasLmnpTag(blob);
  const appart = matchesAppartArgenteuilSubcategory(tx);
  if (!loc && !lmnp && !appart) return false;

  for (const kw of LMNP_EXPENSE_KEYWORD_GROUPS) {
    if (blob.includes(fold(kw))) return true;
  }
  return false;
}

export type LmnpMovement = {
  id: string;
  date: string;
  label: string;
  category: string;
  amount: number;
  company: string;
};

function toMovement(tx: DashboardTx): LmnpMovement {
  return {
    id: tx.id,
    date: tx.date,
    label: tx.label,
    category: tx.category,
    amount: tx.amount,
    company: tx.company
  };
}

export type LmnpMonthlyRow = {
  month: string;
  loyers: number;
  depenses: number;
  net: number;
};

export type LmnpAnalysis = {
  purchaseDateIso: string;
  /** Somme des |montants| des débits en sous-cat. « Appart Argenteuil » (toutes dates chargées). */
  purchasePriceEur: number;
  /** Somme des loyers reçus (sous-cat. Loyers Reçus). */
  totalLoyers: number;
  /** Total des débits classés « achat immobilier » (valeur absolue, pour affichage). */
  totalAchatAbsolu: number;
  /** Dépenses LMNP (hors achat immobilier). */
  totalDepenses: number;
  revenuNet: number;
  loyersAnnualises: number | null;
  netAnnualise: number | null;
  rentabiliteBrutePct: number | null;
  rentabiliteNettePct: number | null;
  anneesPossession: number;
  months: LmnpMonthlyRow[];
  /** Loyers reçus depuis l’achat. */
  loyersRecusTx: LmnpMovement[];
  /** Achat appartement (même sous-catégorie). */
  achatAppartTx: LmnpMovement[];
  depensesTx: LmnpMovement[];
};

function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Mois civil utilisé pour les **agrégats** des loyers reçus : fin de mois (après le seuil) → mois suivant.
 * La date d’opération en base ne change pas (listes détaillées).
 */
export function effectiveLmnpLoyerAnalyticMonthKey(dateIso: string): string {
  const d = Number(dateIso.slice(8, 10));
  if (!Number.isFinite(d) || dateIso.length < 10) return dateIso.slice(0, 7);
  const n = Math.max(1, LMNP_LOYER_ANALYTIC_MONTH_AFTER_DAY);
  if (d > n) {
    const next = firstDayOfNextCalendarMonthIso(dateIso);
    return next ? next.slice(0, 7) : dateIso.slice(0, 7);
  }
  return dateIso.slice(0, 7);
}

export function analyzeLmnp(transactions: readonly DashboardTx[]): LmnpAnalysis {
  const purchase = parseYmd(LMNP_PROPERTY.purchaseDateIso) ?? new Date(2020, 0, 1);
  const purchaseIso = LMNP_PROPERTY.purchaseDateIso;

  const loyersRecusTx: LmnpMovement[] = [];
  const achatAppartTx: LmnpMovement[] = [];
  const depensesTx: LmnpMovement[] = [];

  let purchasePriceEur = 0;
  for (const tx of transactions) {
    if (isLmnpApartmentPurchase(tx)) purchasePriceEur += Math.abs(tx.amount);
  }

  for (const tx of transactions) {
    if (tx.date < purchaseIso) continue;
    if (isLmnpRentalIncome(tx)) loyersRecusTx.push(toMovement(tx));
    else if (isLmnpApartmentPurchase(tx)) achatAppartTx.push(toMovement(tx));
    else if (isLmnpExpense(tx)) depensesTx.push(toMovement(tx));
  }

  const sortByDate = (a: LmnpMovement, b: LmnpMovement) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  loyersRecusTx.sort(sortByDate);
  achatAppartTx.sort(sortByDate);
  depensesTx.sort(sortByDate);

  const totalLoyers = loyersRecusTx.reduce((s, t) => s + t.amount, 0);
  const totalAchatAbsolu = achatAppartTx.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalDepenses = depensesTx.reduce((s, t) => s + Math.abs(t.amount), 0);
  const revenuNet = totalLoyers - totalDepenses;

  const now = new Date();
  const elapsedYears = Math.max(
    (now.getTime() - purchase.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    1 / 365
  );

  const loyersAnnualises = totalLoyers / elapsedYears;
  const netAnnualise = revenuNet / elapsedYears;

  const rentabiliteBrutePct =
    purchasePriceEur > 0 && Number.isFinite(loyersAnnualises)
      ? (loyersAnnualises / purchasePriceEur) * 100
      : null;
  const rentabiliteNettePct =
    purchasePriceEur > 0 && Number.isFinite(netAnnualise) ? (netAnnualise / purchasePriceEur) * 100 : null;

  const monthMap = new Map<string, { loyers: number; depenses: number }>();
  const add = (iso: string, field: "loyers" | "depenses", v: number) => {
    const mk = iso.slice(0, 7);
    if (mk < purchaseIso.slice(0, 7)) return;
    const cur = monthMap.get(mk) ?? { loyers: 0, depenses: 0 };
    cur[field] += v;
    monthMap.set(mk, cur);
  };

  for (const t of loyersRecusTx) add(effectiveLmnpLoyerAnalyticMonthKey(t.date), "loyers", t.amount);
  for (const t of depensesTx) add(t.date, "depenses", Math.abs(t.amount));

  const months = Array.from(monthMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({
      month,
      loyers: v.loyers,
      depenses: v.depenses,
      net: v.loyers - v.depenses
    }));

  return {
    purchaseDateIso: purchaseIso,
    purchasePriceEur,
    totalLoyers,
    totalAchatAbsolu,
    totalDepenses,
    revenuNet,
    loyersAnnualises,
    netAnnualise,
    rentabiliteBrutePct,
    rentabiliteNettePct,
    anneesPossession: elapsedYears,
    months,
    loyersRecusTx,
    achatAppartTx,
    depensesTx
  };
}
