import {
  computeDerivedExpenseCategoryMonthlyBreakdown, countsTowardDashboardExpenseTotal,
  expenseCategoryColor, filterDashboardTransactions, type DashboardTx
} from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { dashboardSasuExpenseAmountHt, amountNetOfRecoverableVat } from "@/lib/recoverable-expense-vat";

const round = (amount: number) => Math.round(amount * 100) / 100;
/** Half-open calendar range; filtering happens before transferring rows from Supabase. */
export function mobileExpenseDateRange(period: string, now = new Date()) {
  const year = period === "all" ? now.getFullYear() : Number(period.slice(0, 4));
  const month = period === "all" ? now.getMonth() : Number(period.slice(5, 7)) - 1;
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  return period.length === 4
    ? { since: `${period}-01-01`, until: `${year + 1}-01-01` }
    : { since: iso(new Date(year, month - (period === "all" ? 11 : 0), 1)), until: iso(new Date(year, month + 1, 1)) };
}
export function mobileExpenseTransactions(transactions: DashboardTx[], now = new Date()) {
  return filterDashboardTransactions(transactions.filter(tx =>
    (tx.scope ?? "pro") === "pro" && countsTowardDashboardExpenseTotal(tx)
  ), { years: null }, now);
}

/** Same grouping, VAT recovery and colors as the professional web Dashboard. */
export function buildMobileExpenses(transactions: DashboardTx[], now = new Date(), years: number[] | null = null) {
  const scoped = filterDashboardTransactions(transactions.filter(tx =>
    (tx.scope ?? "pro") === "pro" && countsTowardDashboardExpenseTotal(tx)
  ), { years }, now);
  const ht = computeDerivedExpenseCategoryMonthlyBreakdown(scoped, { years, useExpenseHt: true }, now);
  const ttc = computeDerivedExpenseCategoryMonthlyBreakdown(scoped, { years }, now);
  const counts = new Map<string, number>();
  for (const tx of scoped) {
    const key = `${tx.date.slice(0, 7)}|${deriveExpenseBucket(tx)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    months: ht.rows.map((row, index) => {
      const categories = ht.categories.map(name => ({
        name, color: expenseCategoryColor(name),
        amountHt: round(row.values[name] ?? 0),
        amountTtc: round(ttc.rows[index]?.values[name] ?? 0),
        count: counts.get(`${row.monthKey}|${name}`) ?? 0
      })).filter(category => category.count > 0)
        .sort((a, b) => b.amountHt - a.amountHt || a.name.localeCompare(b.name));
      return {
        month: row.monthKey,
        totalHt: round(categories.reduce((sum, c) => sum + c.amountHt, 0)),
        totalTtc: round(categories.reduce((sum, c) => sum + c.amountTtc, 0)),
        categories
      };
    })
  };
}

export function mobileExpenseDetail(transactions: DashboardTx[], category: string, month: string, page: number, now = new Date()) {
  const annual = /^\d{4}$/.test(month);
  const scoped = annual ? filterDashboardTransactions(transactions.filter(tx =>
    (tx.scope ?? "pro") === "pro" && countsTowardDashboardExpenseTotal(tx)
  ), { years: [Number(month)] }, now) : mobileExpenseTransactions(transactions, now);
  const rows = scoped
    .filter(tx => (annual || month === "all" || tx.date.slice(0, 7) === month) && deriveExpenseBucket(tx) === category)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return {
    category, month, total: rows.length,
    totalHt: round(rows.reduce((sum, tx) => sum + dashboardSasuExpenseAmountHt(tx), 0)),
    totalTtc: round(rows.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)),
    taxNetTotal: round(rows.reduce((sum, tx) => sum + amountNetOfRecoverableVat(tx, deriveExpenseBucket(tx), Math.abs(tx.amount)), 0)),
    recoverableVat: round(rows.reduce((sum, tx) => sum + Math.abs(tx.amount) - amountNetOfRecoverableVat(tx, deriveExpenseBucket(tx), Math.abs(tx.amount)), 0)),
    transactions: rows.slice(page * 100, (page + 1) * 100).map(tx => ({
      id: tx.id, date: tx.date, label: tx.label, bankName: tx.bankName ?? tx.company,
      amountHt: dashboardSasuExpenseAmountHt(tx), amountTtc: Math.abs(tx.amount)
    })),
    nextPage: (page + 1) * 100 < rows.length ? page + 1 : null
  };
}
