import type { DashboardTx } from "./dashboard-metrics";
import type { BankinPiloteSnapshot } from "./pilote";

const LIMIT = 500;
export type AssistantTransaction = {
  date: string; amount: number; category: string; subcategory: string | null;
  categoryManual: boolean | null; hidden: boolean;
};
export type AssistantTransactionSource = {
  available: boolean; totalCount: number; includedCount: number; truncated: boolean;
  transactions: AssistantTransaction[];
};
export type AssistantTransactions = { digitpro: AssistantTransactionSource; bankin: AssistantTransactionSource };
const category = (value: string) => value.slice(0, 160);
function source(rows: AssistantTransaction[] | null, asOf: string): AssistantTransactionSource {
  const eligible = (rows ?? []).filter(row => row.date <= asOf && Number.isFinite(row.amount));
  eligible.sort((a, b) => b.date.localeCompare(a.date));
  return { available: rows !== null, totalCount: eligible.length, includedCount: Math.min(eligible.length, LIMIT),
    truncated: eligible.length > LIMIT, transactions: eligible.slice(0, LIMIT) };
}
/** Explicit projection: no account identifiers, merchant labels, filenames or credentials. */
export function buildAssistantTransactions(transactions: DashboardTx[] | null, snapshot: BankinPiloteSnapshot | null, asOf: string): AssistantTransactions {
  return {
    digitpro: source(transactions?.map(row => ({date: row.date, amount: row.amount,
      category: category(row.category), subcategory: null, categoryManual: row.categoryManual ?? false, hidden: false})) ?? null, asOf),
    bankin: source(snapshot?.rows?.map(row => ({date: row.date, amount: row.amount,
      category: category(row.parentCategory), subcategory: category(row.subCategory), categoryManual: null, hidden: row.hidden})) ?? null, asOf),
  };
}
