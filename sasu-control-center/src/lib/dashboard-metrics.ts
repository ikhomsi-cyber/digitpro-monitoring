import { importDedupePayload } from "./import-dedupe-payload";
import { deriveExpenseBucket } from "./derived-expense-bucket";
import { isRevenueCategory } from "./revenue-category";

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
 * Encaissements « Chiffre d’affaires » (montant &gt; 0) dont la date tombe sur l’un des
 * **N derniers jours civils du mois** sont rattachés, pour tout le dashboard, au **1er jour du mois suivant**.
 * La date en base ne change pas — uniquement filtres et agrégats analytiques.
 */
export const REVENUE_END_OF_MONTH_ROLL_DAYS = 4;

function parseUtcYmd(iso: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m0: mo - 1, d };
}

function utcLastDayOfMonth(y: number, monthIndex0: number): number {
  return new Date(Date.UTC(y, monthIndex0 + 1, 0)).getUTCDate();
}

/** 1er jour du mois civil suivant `iso` (UTC). */
export function firstDayOfNextCalendarMonthIso(iso: string): string | null {
  const p = parseUtcYmd(iso);
  if (!p) return null;
  const next = new Date(Date.UTC(p.y, p.m0 + 1, 1));
  return next.toISOString().slice(0, 10);
}

/** True si le jour est parmi les `REVENUE_END_OF_MONTH_ROLL_DAYS` derniers du mois (UTC). */
export function isRevenueEndOfMonthCalendarDay(iso: string): boolean {
  const p = parseUtcYmd(iso);
  if (!p) return false;
  const n = Math.max(1, REVENUE_END_OF_MONTH_ROLL_DAYS);
  const last = utcLastDayOfMonth(p.y, p.m0);
  return p.d > last - n;
}

/** Date analytique pour les encaissements CA (fin de mois → mois suivant). */
export function effectiveRevenueAnalyticsDateIso(
  tx: Pick<DashboardTx, "date" | "category" | "amount">
): string {
  if (!isRevenueCategory(tx.category) || tx.amount <= 0) return tx.date;
  if (!isRevenueEndOfMonthCalendarDay(tx.date)) return tx.date;
  return firstDayOfNextCalendarMonthIso(tx.date) ?? tx.date;
}

/**
 * Date utilisée pour filtres / années : dépenses = date réelle ;
 * encaissements CA = date décalée si fin de mois.
 */
export function transactionAnalyticsDayIso(tx: DashboardTx): string {
  if (tx.amount < 0) return tx.date;
  if (isRevenueCategory(tx.category) && tx.amount > 0) {
    return effectiveRevenueAnalyticsDateIso(tx);
  }
  return tx.date;
}

export type MonthlyFinanceMetric = {
  month: string; // YYYY-MM
  revenue: number;
  expenses: number;
};

/** Trois tons seulement (indigo analyse + deux ardoises) — lisible sans arc-en-ciel. */
const EXPENSE_CATEGORY_STACK_PALETTE = ["#4f46e5", "#64748b", "#475569"] as const;

/** Couleur stable par catégorie (cycle court sur 3 teintes). */
export function expenseCategoryColor(category: string): string {
  let h = 0;
  for (let i = 0; i < category.length; i++) {
    h = (Math.imul(31, h) + category.charCodeAt(i)) >>> 0;
  }
  return EXPENSE_CATEGORY_STACK_PALETTE[h % EXPENSE_CATEGORY_STACK_PALETTE.length];
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

/** Dépenses prises en compte dans les KPI « Total expenses » (hors bucket BNC). */
function countsTowardDashboardExpenseTotal(tx: DashboardTx): boolean {
  return tx.amount < 0 && deriveExpenseBucket(tx) !== BNC_PAYROLL_EXPENSE_CATEGORY;
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
 *   - expenses = sum of |amount| for outgoing flows (amount &lt; 0) sauf bucket dérivé **BNC**
 *               (voir `deriveExpenseBucket` — aligné avec le détail hors BNC du dashboard)
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
