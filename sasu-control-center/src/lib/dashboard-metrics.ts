import { importDedupePayload } from "./import-dedupe-payload";
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
};

export type MonthlyFinanceMetric = {
  month: string; // YYYY-MM
  revenue: number;
  expenses: number;
};

const EXPENSE_CATEGORY_STACK_PALETTE = [
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#65a30d",
  "#059669",
  "#0d9488",
  "#0284c7",
  "#4f46e5",
  "#7c3aed",
  "#db2777",
  "#64748b",
  "#78716c"
] as const;

/** Stable color per category for stacked expense charts (palette slot from string hash). */
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

/**
 * Per-month expense totals by `tx.category` for outgoing flows only (`amount < 0`).
 * Same transaction window as dashboard charts (`filteredTx` + year vs trailing 12).
 */
export function computeExpenseCategoryMonthlyBreakdown(
  filteredTxs: DashboardTx[],
  opts: { yearMode: number | null },
  now = new Date()
): ExpenseCategoryMonthlyBreakdown {
  const monthKeys = getAnalyticsMonthKeys(opts.yearMode, now);
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

/** Month bucket keys aligned with `computeDashboardMonthlyMetrics` (jan–déc or trailing 12). */
export function getAnalyticsMonthKeys(yearMode: number | null, now = new Date()): string[] {
  if (yearMode != null) {
    const y = String(yearMode);
    return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  }
  return last12MonthsKeys(now);
}

/**
 * Revenue/expenses per calendar month for the trailing 12 months (UTC bucket keys).
 *
 * Definitions (kept in sync with KPI cards):
 *   - revenue  = sum of transactions whose category is "Chiffre d'affaires"
 *   - expenses = sum of |amount| for ALL transactions where amount < 0
 *               (every outgoing flow counts as an expense, regardless of category)
 */
export function computeMetricsFromTransactions(
  transactions: DashboardTx[],
  now = new Date()
): MonthlyFinanceMetric[] {
  const months = last12MonthsKeys(now);
  const map = new Map<string, { revenue: number; expenses: number }>();
  for (const m of months) map.set(m, { revenue: 0, expenses: 0 });

  for (const tx of transactions) {
    const bucketKey = toYYYYMM(tx.date);
    const bucket = map.get(bucketKey);
    if (!bucket) continue;
    if (isRevenueCategory(tx.category)) bucket.revenue += tx.amount;
    if (tx.amount < 0) bucket.expenses += Math.abs(tx.amount);
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
  }>,
  idSeed = Date.now()
): DashboardTx[] {
  return rows.map((t, i) => ({
    id: `${IMPORT_ID_PREFIX}_${idSeed}_${i}`,
    date: t.date,
    label: t.label,
    category: t.category,
    amount: t.amount,
    balance: t.balance ?? null,
    company: (t.company ?? "").trim()
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
  year: number | null;
};

export function filterDashboardTransactions(
  txs: DashboardTx[],
  filter: DashboardAnalyticsFilter,
  now = new Date()
): DashboardTx[] {
  if (filter.year != null) {
    return txs.filter((t) => Number(t.date.slice(0, 4)) === filter.year);
  }
  // Trailing 12 months: keep only transactions in the last 12 calendar months,
  // so the KPI totals stay aligned with what the charts plot.
  const months = new Set(last12MonthsKeys(now));
  return txs.filter((t) => months.has(t.date.slice(0, 7)));
}

/**
 * Monthly series filtered by year (jan–déc) or trailing 12 months when yearMode is null.
 * Uses the same revenue/expense definitions as the KPI cards (see file header).
 */
export function computeDashboardMonthlyMetrics(
  filteredTxs: DashboardTx[],
  opts: { yearMode: number | null },
  now = new Date()
): MonthlyFinanceMetric[] {
  if (opts.yearMode != null) {
    const months = getAnalyticsMonthKeys(opts.yearMode, now);
    const revenueExpenses = new Map<string, { revenue: number; expenses: number }>();
    for (const m of months) revenueExpenses.set(m, { revenue: 0, expenses: 0 });
    for (const tx of filteredTxs) {
      const key = tx.date.slice(0, 7);
      const bucket = revenueExpenses.get(key);
      if (!bucket) continue;
      if (isRevenueCategory(tx.category)) bucket.revenue += tx.amount;
      if (tx.amount < 0) bucket.expenses += Math.abs(tx.amount);
    }
    return months.map((m) => ({ month: m, ...revenueExpenses.get(m)! }));
  }
  return computeMetricsFromTransactions(filteredTxs, now);
}
