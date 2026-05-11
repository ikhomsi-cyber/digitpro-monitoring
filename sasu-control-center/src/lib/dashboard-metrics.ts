import { importDedupePayload } from "./import-dedupe-payload";
import { deriveExpenseBucket } from "./derived-expense-bucket";
import { getFrenchPublicHolidaysForYear } from "./fr-public-holidays";
import { isRevenueCategory } from "./revenue-category";
import { revenueAnalyticsDateOverride } from "./transaction-analytics-overrides";

export type DashboardTx = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  category: string;
  amount: number;
  /** Solde du compte juste après l’opération (col. « Solde »). null si inconnu. */
  balance?: number | null;
  /** Société / compte (import Qonto « Nom du compte », saisie manuelle, etc.). */
  company: string;
  /** Périmètre des transactions : pro (SASU) vs personal (privé). */
  scope?: "pro" | "personal";
};

/**
 * Encaissements « Chiffre d’affaires » (montant &gt; 0) : jours civils **1 à N** (inclus) →
 * rattachés au **mois de la date bancaire** ; au-delà → **1er jour du mois suivant** (agrégats dashboard).
 * La date en base ne change pas — uniquement filtres et agrégats analytiques.
 */
export const REVENUE_STAYS_IN_CURRENT_MONTH_THROUGH_DAY = 26;

function parseUtcYmd(iso: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m0: mo - 1, d };
}

/** 1er jour du mois civil suivant `iso` (UTC). */
export function firstDayOfNextCalendarMonthIso(iso: string): string | null {
  const p = parseUtcYmd(iso);
  if (!p) return null;
  const next = new Date(Date.UTC(p.y, p.m0 + 1, 1));
  return next.toISOString().slice(0, 10);
}

/**
 * True si l’encaissement CA (date `YYYY-MM-DD` en UTC) doit être rattaché au **mois suivant**
 * (1er jour) : jours civils **strictement après** `REVENUE_STAYS_IN_CURRENT_MONTH_THROUGH_DAY`.
 */
export function isRevenueRollToNextMonthDay(iso: string): boolean {
  const p = parseUtcYmd(iso);
  if (!p) return false;
  const n = Math.max(1, REVENUE_STAYS_IN_CURRENT_MONTH_THROUGH_DAY);
  return p.d > n;
}

/** @deprecated Utiliser `isRevenueRollToNextMonthDay` (seuil au jour 26). */
export function isRevenueEndOfMonthCalendarDay(iso: string): boolean {
  return isRevenueRollToNextMonthDay(iso);
}

/** Date analytique pour les encaissements CA (corrections métier, puis jours 27+ → mois suivant). */
export function effectiveRevenueAnalyticsDateIso(tx: DashboardTx): string {
  if (!isRevenueCategory(tx.category) || tx.amount <= 0) return tx.date;
  const forced = revenueAnalyticsDateOverride(tx);
  if (forced) return forced;
  if (!isRevenueRollToNextMonthDay(tx.date)) return tx.date;
  return firstDayOfNextCalendarMonthIso(tx.date) ?? tx.date;
}

/**
 * Date utilisée pour filtres / années : dépenses = date réelle ;
 * encaissements CA = date décalée si jour &gt; 26 (rattaché au 1er du mois suivant).
 */
export function transactionAnalyticsDayIso(tx: DashboardTx): string {
  if (tx.amount < 0) return tx.date;
  if (isRevenueCategory(tx.category) && tx.amount > 0) {
    return effectiveRevenueAnalyticsDateIso(tx);
  }
  return tx.date;
}

function localCalendarYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInCalendarYear(year: number): number {
  const start = new Date(year, 0, 1);
  const nextJan1 = new Date(year + 1, 0, 1);
  return Math.round((nextJan1.getTime() - start.getTime()) / 86400000);
}

function dayOfCalendarYearLocal(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  return Math.floor((noon.getTime() - start.getTime()) / 86400000) + 1;
}

/** Tous les ISO YYYY-MM-DD du 1er janv. au 31 déc. (calendrier local). */
function iterLocalIsosInCalendarYear(year: number): string[] {
  const out: string[] = [];
  for (let m0 = 0; m0 < 12; m0++) {
    const dim = new Date(year, m0 + 1, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      out.push(
        `${year}-${String(m0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      );
    }
  }
  return out;
}

function isWeekendLocalIso(iso: string): boolean {
  const p = parseUtcYmd(iso);
  if (!p) return false;
  const wd = new Date(p.y, p.m0, p.d).getDay();
  return wd === 0 || wd === 6;
}

/**
 * Jours « utiles » pour extrapoler le CA sur l’année : chaque date cochée au calendrier,
 * plus tous les **jours ouvrés** FR (lun–ven hors jours fériés métropole) non encore couverts.
 */
export function buildYearRevenueCapacityDaySet(
  year: number,
  calendarSelected: ReadonlySet<string>
): Set<string> {
  const holidays = getFrenchPublicHolidaysForYear(year);
  const capacity = new Set<string>();
  for (const iso of iterLocalIsosInCalendarYear(year)) {
    if (calendarSelected.has(iso)) {
      capacity.add(iso);
      continue;
    }
    if (!isWeekendLocalIso(iso) && !holidays.has(iso)) {
      capacity.add(iso);
    }
  }
  return capacity;
}

function countCapacityDaysNotAfter(capacity: ReadonlySet<string>, lastIsoInclusive: string): number {
  let n = 0;
  for (const iso of capacity) {
    if (iso <= lastIsoInclusive) n++;
  }
  return n;
}

export type RevenueYearProjection = {
  calendarYear: number;
  /** CA encaissé (TTC) depuis le 1er janv., date analytique ≤ aujourd’hui (calendrier local). */
  ytdTtc: number;
  ytdHt: number;
  /** Estimation au 31/12 si le rythme observé se poursuit (extrapolation au prorata de l’année civile). */
  projectedYearEndTtc: number;
  projectedYearEndHt: number;
  /** Part utilisée pour l’extrapolation (jours ouvrés + calendrier, ou à défaut prorata calendaire). */
  fractionOfYearElapsed: number;
  /** Jour civil dans l’année (1…365/366), indicatif. */
  dayOfYear: number;
  daysInYear: number;
  /** Base du dénominateur de la fraction. */
  projectionBasis: "calendar" | "workdays";
  /** Jours écoulés / total retenus pour la fraction (calendaire ou capacité). */
  capacityDaysElapsed: number;
  capacityDaysTotal: number;
};

/**
 * Projection linéaire du CA jusqu’à fin d’année civile : CA_YTD / fraction écoulée.
 * Si `billableWorkDayIsos` est fourni : fraction = jours de capacité écoulés / total capacité sur l’année,
 * où la capacité = **saisies calendrier** ∪ **jours ouvrés** (lun–ven, fériés FR métropole exclus).
 * Sinon : fraction = jour civil / nombre de jours de l’année (comportement historique).
 *
 * Mêmes règles de catégorie et de date analytique que le reste du dashboard.
 */
export function computeRevenueYearToDateProjection(
  transactions: DashboardTx[],
  options: {
    now?: Date;
    vatRate?: number;
    /** Jours cochés « jours travaillés » ; fusionnés avec les jours ouvrés FR pour le prorata. */
    billableWorkDayIsos?: readonly string[];
  } = {}
): RevenueYearProjection {
  const now = options.now ?? new Date();
  const vatRate = options.vatRate ?? 0.2;
  const calendarYear = now.getFullYear();
  const todayIso = localCalendarYmd(now);
  const yearPrefix = `${calendarYear}-`;

  let ytdTtc = 0;
  for (const tx of transactions) {
    if (!isRevenueCategory(tx.category) || tx.amount <= 0) continue;
    const revIso = effectiveRevenueAnalyticsDateIso(tx);
    if (!revIso.startsWith(yearPrefix)) continue;
    if (revIso > todayIso) continue;
    ytdTtc += tx.amount;
  }

  const daysInYear = daysInCalendarYear(calendarYear);
  const dayOfYear = dayOfCalendarYearLocal(now);
  const calendarFraction = Math.min(1, Math.max(1 / daysInYear, dayOfYear / daysInYear));

  let fraction: number;
  let projectionBasis: "calendar" | "workdays";
  let capacityDaysElapsed: number;
  let capacityDaysTotal: number;

  if (options.billableWorkDayIsos !== undefined) {
    const selectedInYear = new Set(
      options.billableWorkDayIsos.filter((iso) => iso.startsWith(yearPrefix))
    );
    const capacitySet = buildYearRevenueCapacityDaySet(calendarYear, selectedInYear);
    capacityDaysTotal = capacitySet.size;
    capacityDaysElapsed = countCapacityDaysNotAfter(capacitySet, todayIso);
    if (capacityDaysTotal > 0) {
      projectionBasis = "workdays";
      fraction = Math.min(
        1,
        Math.max(1 / capacityDaysTotal, capacityDaysElapsed / capacityDaysTotal)
      );
    } else {
      projectionBasis = "calendar";
      capacityDaysElapsed = dayOfYear;
      capacityDaysTotal = daysInYear;
      fraction = calendarFraction;
    }
  } else {
    projectionBasis = "calendar";
    capacityDaysElapsed = dayOfYear;
    capacityDaysTotal = daysInYear;
    fraction = calendarFraction;
  }

  const ytdHt = ytdTtc / (1 + vatRate);
  const projectedYearEndTtc = ytdTtc / fraction;
  const projectedYearEndHt = projectedYearEndTtc / (1 + vatRate);

  return {
    calendarYear,
    ytdTtc,
    ytdHt,
    projectedYearEndTtc,
    projectedYearEndHt,
    fractionOfYearElapsed: fraction,
    dayOfYear,
    daysInYear,
    projectionBasis,
    capacityDaysElapsed,
    capacityDaysTotal
  };
}

export type MonthlyFinanceMetric = {
  month: string; // YYYY-MM
  revenue: number;
  expenses: number;
};

/**
 * Palette large pour catégories non mappées — teintes saturées, contrastes distincts en empilement.
 */
const EXPENSE_CATEGORY_VIBRANT_FALLBACK: readonly string[] = [
  "#e11d48",
  "#f97316",
  "#ca8a04",
  "#16a34a",
  "#059669",
  "#0d9488",
  "#0891b2",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#9333ea",
  "#c026d3",
  "#db2777",
  "#dc2626",
  "#65a30d",
  "#0ea5e9",
  "#6366f1",
  "#d97706",
  "#15803d",
  "#be185d",
  "#0f766e",
  "#1d4ed8",
  "#6d28d9",
  "#b45309"
] as const;

function normExpenseCategoryKey(category: string): string {
  return category
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[''`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Couleur d’accent par catégorie (libellé affiché dashboard).
 * Libellés connus → teinte dédiée ; sinon hachage stable sur une palette étendue.
 */
export function expenseCategoryColor(category: string): string {
  const n = normExpenseCategoryKey(category);

  if (n === "bnc") return "#6366f1";
  if (n === "tva") return "#64748b";
  if (n === "autres") return "#78716c";
  if (n.startsWith("compta") && n.includes("admin")) return "#2563eb";
  if (n === "ndf") return "#0f766e";
  if (n === "urssaf") return "#e11d48";
  if (n === "cesu") return "#a855f7";
  if (n === "qonto") return "#14b8a6";
  if (n.includes("icloud ia store")) return "#5856d6";
  if (n === "assurance") return "#0284c7";
  if (n === "mutuelle") return "#db2777";
  if (n.includes("repas d'affaire") || n.includes("repas d affaire") || n.includes("repas daffaire"))
    return "#ea580c";
  if (n.includes("repas dirigeant")) return "#f59e0b";
  if (n.includes("repas ilias") || n.includes("repas ilia")) return "#fb7185";
  if (n.includes("mobile et internet")) return "#0ea5e9";
  if (n.includes("indemnit") && n.includes("kilomet")) return "#22c55e";
  if (n.includes("indemnit")) return "#10b981";
  if (n.includes("loyer") || n.includes("logement")) return "#8b5cf6";
  if (n.includes("transport") || n.includes("essence") || n.includes("parking")) return "#0891b2";
  if (n.includes("shopping") || n.includes("fourniture")) return "#ec4899";
  if (n.includes("sante") || n.includes("mutuelle")) return "#f43f5e";
  if (n.includes("impot") || n.includes("taxe") || n.includes("cfe")) return "#dc2626";
  if (n.includes("logiciel") || n.includes("saas") || n.includes("abonnement")) return "#7c3aed";

  let h = 0;
  for (let i = 0; i < category.length; i++) {
    h = (Math.imul(31, h) + category.charCodeAt(i)) >>> 0;
  }
  return EXPENSE_CATEGORY_VIBRANT_FALLBACK[h % EXPENSE_CATEGORY_VIBRANT_FALLBACK.length];
}

export type ExpenseCategoryMonthRow = {
  monthKey: string;
  /** Absolute expense totals per category name for this month */
  values: Record<string, number>;
};

export type ExpenseCategoryMonthlyBreakdown = {
  /** Categories sorted by total expense (descending) on the filtered period */
  categories: string[];
  rows: ExpenseCategoryMonthRow[];
};

/** Catégorie isolée dans le bloc BNC du tableau de bord (dépenses pro). */
export const BNC_PAYROLL_EXPENSE_CATEGORY = "BNC";

/** Bucket TVA (paiements / crédits TVA), exclu des KPI « Total expenses » comme le BNC. */
export const TVA_DERIVED_EXPENSE_BUCKET = "TVA";

/** Buckets dérivés exclus des totaux dépenses dashboard (KPI, courbes, camembert centre). */
export function isDerivedBucketExcludedFromExpenseKpis(bucket: string): boolean {
  return bucket === BNC_PAYROLL_EXPENSE_CATEGORY || bucket === TVA_DERIVED_EXPENSE_BUCKET;
}

/** Dépenses comptées dans les KPI « Total expenses » et séries mensuelles (hors BNC et TVA). */
export function countsTowardDashboardExpenseTotal(tx: DashboardTx): boolean {
  if (tx.amount >= 0) return false;
  return !isDerivedBucketExcludedFromExpenseKpis(deriveExpenseBucket(tx));
}

/** Retire des catégories du breakdown (ex. pour le graphique « dépenses hors BNC »). */
export function omitExpenseCategoriesFromBreakdown(
  breakdown: ExpenseCategoryMonthlyBreakdown,
  omit: readonly string[]
): ExpenseCategoryMonthlyBreakdown {
  const omitSet = new Set(omit);
  const categories = breakdown.categories.filter((c) => !omitSet.has(c));
  const rows = breakdown.rows.map((r) => {
    const values: Record<string, number> = {};
    for (const c of categories) values[c] = r.values[c] ?? 0;
    return { monthKey: r.monthKey, values };
  });
  return { categories, rows };
}

/**
 * Une seule catégorie sur toute la série (pour le graphique BNC). `categories` a toujours une entrée.
 */
export function singleCategoryExpenseBreakdown(
  breakdown: ExpenseCategoryMonthlyBreakdown,
  category: string
): ExpenseCategoryMonthlyBreakdown {
  const rows = breakdown.rows.map((r) => ({
    monthKey: r.monthKey,
    values: { [category]: r.values[category] ?? 0 }
  }));
  return { categories: [category], rows };
}

/**
 * Per-month expense totals by `tx.category` for outgoing flows only (`amount < 0`).
 * Same transaction window as dashboard charts (`filteredTx` + year vs trailing 12).
 */
export function computeExpenseCategoryMonthlyBreakdown(
  filteredTxs: DashboardTx[],
  opts: { years: number[] | null },
  now = new Date()
): ExpenseCategoryMonthlyBreakdown {
  const monthKeys = analyticsMonthKeysForDashboard(opts.years, now);
  const perMonth = new Map<string, Map<string, number>>();
  for (const m of monthKeys) perMonth.set(m, new Map());

  const catTotals = new Map<string, number>();

  for (const tx of filteredTxs) {
    if (tx.amount >= 0) continue;
    const mk = tx.date.slice(0, 7);
    const bucket = perMonth.get(mk);
    if (!bucket) continue;
    const raw = (tx.category ?? "").trim();
    const cat = raw.length ? raw : "Sans catégorie";
    const amt = Math.abs(tx.amount);
    bucket.set(cat, (bucket.get(cat) ?? 0) + amt);
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + amt);
  }

  const categories = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const rows: ExpenseCategoryMonthRow[] = monthKeys.map((monthKey) => {
    const bucket = perMonth.get(monthKey)!;
    const values: Record<string, number> = {};
    for (const c of categories) {
      values[c] = bucket.get(c) ?? 0;
    }
    return { monthKey, values };
  });

  return { categories, rows };
}

/**
 * Répartition des dépenses par buckets dérivés (libellé / société / catégorie),
 * voir `deriveExpenseBucket` dans `derived-expense-bucket.ts`.
 */
export function computeDerivedExpenseCategoryMonthlyBreakdown(
  filteredTxs: DashboardTx[],
  opts: { years: number[] | null },
  now = new Date()
): ExpenseCategoryMonthlyBreakdown {
  const monthKeys = analyticsMonthKeysForDashboard(opts.years, now);
  const perMonth = new Map<string, Map<string, number>>();
  for (const m of monthKeys) perMonth.set(m, new Map());

  const catTotals = new Map<string, number>();

  for (const tx of filteredTxs) {
    if (tx.amount >= 0) continue;
    const mk = tx.date.slice(0, 7);
    const bucket = perMonth.get(mk);
    if (!bucket) continue;
    const cat = deriveExpenseBucket(tx);
    const amt = Math.abs(tx.amount);
    bucket.set(cat, (bucket.get(cat) ?? 0) + amt);
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + amt);
  }

  const categories = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const rows: ExpenseCategoryMonthRow[] = monthKeys.map((monthKey) => {
    const b = perMonth.get(monthKey)!;
    const values: Record<string, number> = {};
    for (const c of categories) {
      values[c] = b.get(c) ?? 0;
    }
    return { monthKey, values };
  });

  return { categories, rows };
}

function toYYYYMM(dateIso: string) {
  return dateIso.slice(0, 7);
}

export function last12MonthsKeys(now = new Date()) {
  const out: string[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}

/**
 * Mois civils couverts par une ou plusieurs années (ordre chronologique : janv. Y1 … déc. Yn).
 */
export function getAnalyticsMonthKeysForYears(years: number[]): string[] {
  const sorted = [...new Set(years.map((y) => Number(y)))]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
  const out: string[] = [];
  for (const y of sorted) {
    const ys = String(y);
    for (let i = 1; i <= 12; i++) {
      out.push(`${ys}-${String(i).padStart(2, "0")}`);
    }
  }
  return out;
}

function analyticsMonthKeysForDashboard(years: number[] | null, now: Date): string[] {
  if (years != null && years.length > 0) {
    return getAnalyticsMonthKeysForYears(years);
  }
  return last12MonthsKeys(now);
}

/** Month bucket keys aligned with `computeDashboardMonthlyMetrics` (jan–déc ou 12 mois glissants). */
export function getAnalyticsMonthKeys(yearMode: number | null, now = new Date()): string[] {
  if (yearMode != null) {
    return getAnalyticsMonthKeysForYears([yearMode]);
  }
  return last12MonthsKeys(now);
}

/**
 * Revenue/expenses per calendar month for the trailing 12 months (UTC bucket keys).
 *
 * Definitions (kept in sync with KPI cards):
 *   - revenue  = sum of transactions whose category is "Chiffre d'affaires"
 *   - expenses = sum of |amount| pour sorties (amount &lt; 0) sauf buckets dérivés **BNC** et **TVA**
 *               (voir `deriveExpenseBucket`)
 */
export function computeMetricsFromTransactions(
  transactions: DashboardTx[],
  now = new Date()
): MonthlyFinanceMetric[] {
  const months = last12MonthsKeys(now);
  const map = new Map<string, { revenue: number; expenses: number }>();
  for (const m of months) map.set(m, { revenue: 0, expenses: 0 });

  for (const tx of transactions) {
    if (isRevenueCategory(tx.category)) {
      const bucketKey = toYYYYMM(effectiveRevenueAnalyticsDateIso(tx));
      const bucket = map.get(bucketKey);
      if (!bucket) continue;
      bucket.revenue += tx.amount;
    }
    if (countsTowardDashboardExpenseTotal(tx)) {
      const bucketKey = toYYYYMM(tx.date);
      const bucket = map.get(bucketKey);
      if (!bucket) continue;
      bucket.expenses += Math.abs(tx.amount);
    }
  }

  return months.map((m) => ({ month: m, ...map.get(m)! }));
}

/** First calendar month (YYYY-MM) included in the trailing-12-month window. */
export function trailingTwelveMonthStartDateIso(now = new Date()): string {
  const keys = last12MonthsKeys(now);
  return `${keys[0]}-01`;
}

/** KPI buckets from raw movements (same rules as full transactions). */
export function computeMonthlyMetricsFromMovements(
  rows: Array<{ date: string; amount: number }>,
  now = new Date()
): MonthlyFinanceMetric[] {
  const txs: DashboardTx[] = rows.map((r, i) => ({
    id: `_m_${i}`,
    date: r.date.slice(0, 10),
    label: "",
    category: "",
    amount: Number(r.amount),
    company: ""
  }));
  return computeMetricsFromTransactions(txs, now);
}

const IMPORT_ID_PREFIX = "import";

export function importedRowsToTransactions(
  rows: Array<{
    date: string;
    label: string;
    category: string;
    amount: number;
    balance?: number | null;
    company?: string;
    scope?: "pro" | "personal";
  }>,
  idSeed = Date.now(),
  defaultScope: "pro" | "personal" = "pro"
): DashboardTx[] {
  return rows.map((t, i) => ({
    id: `${IMPORT_ID_PREFIX}_${idSeed}_${i}`,
    date: t.date,
    label: t.label,
    category: t.category,
    amount: t.amount,
    balance: t.balance ?? null,
    company: (t.company ?? "").trim(),
    scope: t.scope ?? defaultScope
  }));
}

/** Demo/local merge: same clé métier que serveur (date + libellé + montant) → met à jour la catégorie. */
export function mergeImportedWithTransactions(
  existing: DashboardTx[],
  imported: DashboardTx[]
): DashboardTx[] {
  const map = new Map<string, DashboardTx>();

  const put = (t: DashboardTx) => {
    const key = importDedupePayload({
      date: t.date,
      label: t.label,
      amount: t.amount
    });
    if (!key) return;
    map.set(key, t);
  };

  for (const t of existing) put(t);
  for (const t of imported) {
    const key = importDedupePayload({
      date: t.date,
      label: t.label,
      amount: t.amount
    });
    if (!key) continue;
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        ...prev,
        category: t.category,
        company: (t.company ?? "").trim() || prev.company,
        label: t.label,
        date: t.date,
        amount: t.amount,
        balance: t.balance ?? prev.balance ?? null
      });
    } else {
      map.set(key, t);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id.localeCompare(b.id);
  });
}

export type DashboardAnalyticsFilter = {
  /** null = 12 mois glissants ; sinon une ou plusieurs années civiles incluses. */
  years: number[] | null;
};

export function filterDashboardTransactions(
  txs: DashboardTx[],
  filter: DashboardAnalyticsFilter,
  now = new Date()
): DashboardTx[] {
  if (filter.years != null && filter.years.length > 0) {
    const set = new Set(filter.years);
    return txs.filter((t) => set.has(Number(transactionAnalyticsDayIso(t).slice(0, 4))));
  }
  // Trailing 12 months: keep only transactions in the last 12 calendar months,
  // so the KPI totals stay aligned with what the charts plot.
  const months = new Set(last12MonthsKeys(now));
  return txs.filter((t) => months.has(transactionAnalyticsDayIso(t).slice(0, 7)));
}

/**
 * Monthly series : 12 mois glissants, ou mois civils pour une ou plusieurs années.
 * Uses the same revenue/expense definitions as the KPI cards (see file header).
 */
export function computeDashboardMonthlyMetrics(
  filteredTxs: DashboardTx[],
  opts: { years: number[] | null },
  now = new Date()
): MonthlyFinanceMetric[] {
  if (opts.years != null && opts.years.length > 0) {
    const months = analyticsMonthKeysForDashboard(opts.years, now);
    const revenueExpenses = new Map<string, { revenue: number; expenses: number }>();
    for (const m of months) revenueExpenses.set(m, { revenue: 0, expenses: 0 });
    for (const tx of filteredTxs) {
      if (isRevenueCategory(tx.category)) {
        const key = effectiveRevenueAnalyticsDateIso(tx).slice(0, 7);
        const bucket = revenueExpenses.get(key);
        if (bucket) bucket.revenue += tx.amount;
      }
      if (countsTowardDashboardExpenseTotal(tx)) {
        const key = tx.date.slice(0, 7);
        const bucket = revenueExpenses.get(key);
        if (bucket) bucket.expenses += Math.abs(tx.amount);
      }
    }
    return months.map((m) => ({ month: m, ...revenueExpenses.get(m)! }));
  }
  return computeMetricsFromTransactions(filteredTxs, now);
}
