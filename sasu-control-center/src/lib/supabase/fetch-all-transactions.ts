import "server-only";

import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { createSupabaseServerClient } from "./server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const DASHBOARD_TX_PAGE_SIZE = 1000;
const DASHBOARD_TX_MAX_ROWS = 125_000;

export type SupabaseTxRow = {
  id: string;
  date: string;
  label: string | null;
  category: string | null;
  amount: number | string;
  balance?: number | string | null;
  company: string | null;
  bank_name?: string | null;
  import_sessions?: { format?: string | null } | null;
  scope?: "pro" | "personal" | null;
};

function transactionSelectMissingColumn(errMsg: string, column: string): boolean {
  if (!errMsg) return false;
  const blob = errMsg.toLowerCase();
  if (!/(could not find|schema cache|does not exist)/i.test(blob)) return false;
  return new RegExp(column, "i").test(blob);
}

async function fetchAllDashboardTransactionRows(
  client: SupabaseServerClient,
  selectColumns: string
): Promise<{ rows: SupabaseTxRow[]; errorMessage: string | null }> {
  const rows: SupabaseTxRow[] = [];
  let from = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    if (rows.length >= DASHBOARD_TX_MAX_ROWS) {
      break;
    }
    const to = from + DASHBOARD_TX_PAGE_SIZE - 1;
    const { data, error } = await client
      .from("transactions")
      .select(selectColumns)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) {
      return { rows, errorMessage: error.message };
    }
    const chunk = (data ?? []) as unknown as SupabaseTxRow[];
    if (chunk.length === 0) {
      return { rows, errorMessage: null };
    }
    rows.push(...chunk);
    from += chunk.length;
    if (chunk.length < DASHBOARD_TX_PAGE_SIZE) {
      return { rows, errorMessage: null };
    }
  }
  return { rows, errorMessage: null };
}

function mapRowsToDashboardTx(rawRows: SupabaseTxRow[]): DashboardTx[] {
  return rawRows.map((row) => ({
    id: String(row.id),
    date: String(row.date).slice(0, 10),
    label: String(row.label ?? ""),
    category: mapExpenseCategoryLabel(String(row.category ?? "")),
    amount: Number(row.amount),
    balance: row.balance == null ? null : Number(row.balance),
    company: String(row.company ?? "").trim(),
    bankName: row.bank_name == null ? null : String(row.bank_name).trim(),
    importFormat: row.import_sessions?.format == null ? null : String(row.import_sessions.format).trim(),
    scope: row.scope === "personal" ? "personal" : "pro"
  }));
}

/**
 * Charge toutes les transactions utilisateur (pagination PostgREST), avec repli si colonnes absentes.
 */
export async function loadAllUserTransactionsFromSupabase(
  client: SupabaseServerClient
): Promise<{ transactions: DashboardTx[]; errorMessage: string | null }> {
  const selectVariants = [
    "id,date,label,category,amount,balance,company,bank_name,scope,import_sessions(format)",
    "id,date,label,category,amount,balance,company,bank_name,scope",
    "id,date,label,category,amount,balance,company,scope",
    "id,date,label,category,amount,company,bank_name,scope",
    "id,date,label,category,amount,company,scope",
    "id,date,label,category,amount,balance,company",
    "id,date,label,category,amount,company"
  ] as const;

  for (const selectStr of selectVariants) {
    const { rows, errorMessage } = await fetchAllDashboardTransactionRows(client, selectStr);
    if (!errorMessage) {
      return { transactions: mapRowsToDashboardTx(rows), errorMessage: null };
    }
    const err = errorMessage;
    if (transactionSelectMissingColumn(err, "balance") && selectStr.includes("balance")) {
      continue;
    }
    if (transactionSelectMissingColumn(err, "scope") && selectStr.includes("scope")) {
      continue;
    }
    if (transactionSelectMissingColumn(err, "bank_name") && selectStr.includes("bank_name")) {
      continue;
    }
    return { transactions: [], errorMessage: err };
  }
  return { transactions: [], errorMessage: "Aucun schéma transactions compatible." };
}

export async function loadRecentUserTransactionsFromSupabase(
  client: SupabaseServerClient,
  limit = 2000
): Promise<{ transactions: DashboardTx[]; errorMessage: string | null }> {
  const selectVariants = [
    "id,date,label,category,amount,balance,company,bank_name,scope,import_sessions(format)",
    "id,date,label,category,amount,balance,company,bank_name,scope",
    "id,date,label,category,amount,balance,company,scope",
    "id,date,label,category,amount,company,bank_name,scope",
    "id,date,label,category,amount,company,scope",
    "id,date,label,category,amount,balance,company",
    "id,date,label,category,amount,company"
  ] as const;

  for (const selectStr of selectVariants) {
    const { data, error } = await client
      .from("transactions")
      .select(selectStr)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (!error) {
      return {
        transactions: mapRowsToDashboardTx((data ?? []) as unknown as SupabaseTxRow[]),
        errorMessage: null
      };
    }
    const err = error.message;
    if (transactionSelectMissingColumn(err, "balance") && selectStr.includes("balance")) continue;
    if (transactionSelectMissingColumn(err, "scope") && selectStr.includes("scope")) continue;
    if (transactionSelectMissingColumn(err, "bank_name") && selectStr.includes("bank_name")) continue;
    return { transactions: [], errorMessage: err };
  }
  return { transactions: [], errorMessage: "Aucun schéma transactions compatible." };
}
