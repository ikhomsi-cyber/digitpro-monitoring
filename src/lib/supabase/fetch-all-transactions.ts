import "server-only";

import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { createSupabaseServerClient } from "./server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const DASHBOARD_TX_PAGE_SIZE = 1000;
const DASHBOARD_TX_MAX_ROWS = 125_000;
const DASHBOARD_TX_FETCH_CONCURRENCY = 4;
/** Fenêtre chargée au premier paint (mois civils glissants, inclus le mois courant). */
export const DASHBOARD_TX_INITIAL_MONTHS = 24;

const TX_SELECT_VARIANTS = [
  "id,date,label,category,category_manual,amount,balance,company,bank_name,scope,import_sessions(format)",
  "id,date,label,category,amount,balance,company,bank_name,scope,import_sessions(format)",
  "id,date,label,category,category_manual,amount,balance,company,bank_name,scope",
  "id,date,label,category,amount,balance,company,bank_name,scope",
  "id,date,label,category,amount,balance,company,scope",
  "id,date,label,category,amount,company,bank_name,scope",
  "id,date,label,category,amount,company,scope",
  "id,date,label,category,amount,balance,company",
  "id,date,label,category,amount,company"
] as const;

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
  category_manual?: boolean | null;
};

function transactionSelectMissingColumn(errMsg: string, column: string): boolean {
  if (!errMsg) return false;
  const blob = errMsg.toLowerCase();
  if (!/(could not find|schema cache|does not exist)/i.test(blob)) return false;
  return new RegExp(column, "i").test(blob);
}

async function fetchDashboardTransactionPage(
  client: SupabaseServerClient,
  selectColumns: string,
  pageIndex: number,
  sinceIso?: string
): Promise<{ rows: SupabaseTxRow[]; errorMessage: string | null; complete: boolean }> {
  const from = pageIndex * DASHBOARD_TX_PAGE_SIZE;
  const to = from + DASHBOARD_TX_PAGE_SIZE - 1;
  let query = client
    .from("transactions")
    .select(selectColumns)
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (sinceIso) {
    query = query.gte("date", sinceIso);
  }
  const { data, error } = await query.range(from, to);
  if (error) {
    return { rows: [], errorMessage: error.message, complete: true };
  }
  const chunk = (data ?? []) as unknown as SupabaseTxRow[];
  return {
    rows: chunk,
    errorMessage: null,
    complete: chunk.length < DASHBOARD_TX_PAGE_SIZE
  };
}

async function fetchAllDashboardTransactionRows(
  client: SupabaseServerClient,
  selectColumns: string,
  sinceIso?: string
): Promise<{ rows: SupabaseTxRow[]; errorMessage: string | null }> {
  const firstPage = await fetchDashboardTransactionPage(client, selectColumns, 0, sinceIso);
  if (firstPage.errorMessage) {
    return { rows: firstPage.rows, errorMessage: firstPage.errorMessage };
  }

  const rows = [...firstPage.rows];
  if (firstPage.complete || rows.length >= DASHBOARD_TX_MAX_ROWS) {
    return { rows, errorMessage: null };
  }

  let nextPageIndex = 1;
  while (rows.length < DASHBOARD_TX_MAX_ROWS) {
    const pageIndices = Array.from(
      { length: DASHBOARD_TX_FETCH_CONCURRENCY },
      (_, offset) => nextPageIndex + offset
    );
    nextPageIndex += DASHBOARD_TX_FETCH_CONCURRENCY;

    const batch = await Promise.all(
      pageIndices.map((pageIndex) =>
        fetchDashboardTransactionPage(client, selectColumns, pageIndex, sinceIso)
      )
    );

    let reachedEnd = false;
    for (const page of batch) {
      if (page.errorMessage) {
        return { rows, errorMessage: page.errorMessage };
      }
      if (page.rows.length === 0) {
        reachedEnd = true;
        break;
      }
      rows.push(...page.rows);
      if (page.complete || rows.length >= DASHBOARD_TX_MAX_ROWS) {
        reachedEnd = true;
        break;
      }
    }
    if (reachedEnd) {
      break;
    }
  }

  return {
    rows: rows.slice(0, DASHBOARD_TX_MAX_ROWS),
    errorMessage: null
  };
}

function resolveCompatibleTransactionSelect(
  loader: (selectStr: string) => Promise<{ rows: SupabaseTxRow[]; errorMessage: string | null }>
): Promise<{ transactions: DashboardTx[]; errorMessage: string | null }> {
  return (async () => {
    for (const selectStr of TX_SELECT_VARIANTS) {
      const { rows, errorMessage } = await loader(selectStr);
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
      if (transactionSelectMissingColumn(err, "category_manual") && selectStr.includes("category_manual")) {
        continue;
      }
      return { transactions: [], errorMessage: err };
    }
    return { transactions: [], errorMessage: "Aucun schéma transactions compatible." };
  })();
}

/** Date ISO (YYYY-MM-DD) du 1er jour du mois le plus ancien inclus dans la fenêtre initiale. */
export function dashboardInitialTransactionsSinceIso(now = new Date()): string {
  const anchor = new Date(now.getFullYear(), now.getMonth(), 1);
  anchor.setMonth(anchor.getMonth() - (DASHBOARD_TX_INITIAL_MONTHS - 1));
  return anchor.toISOString().slice(0, 10);
}

export function needsDashboardFullHistorySync(
  transactions: readonly DashboardTx[],
  minDateIso: string | null | undefined
): boolean {
  if (!minDateIso || !transactions.length) return false;
  const oldestLoadedIso = transactions[transactions.length - 1]?.date;
  if (!oldestLoadedIso) return false;
  return oldestLoadedIso > minDateIso;
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
    scope: row.scope === "personal" ? "personal" : "pro",
    categoryManual: row.category_manual === true
  }));
}

/**
 * Charge toutes les transactions utilisateur (pagination PostgREST), avec repli si colonnes absentes.
 */
export async function loadAllUserTransactionsFromSupabase(
  client: SupabaseServerClient
): Promise<{ transactions: DashboardTx[]; errorMessage: string | null }> {
  return resolveCompatibleTransactionSelect((selectStr) =>
    fetchAllDashboardTransactionRows(client, selectStr)
  );
}

/**
 * Charge les transactions des N derniers mois civils (voir DASHBOARD_TX_INITIAL_MONTHS) pour le premier paint.
 */
export async function loadInitialUserTransactionsFromSupabase(
  client: SupabaseServerClient,
  now = new Date()
): Promise<{ transactions: DashboardTx[]; errorMessage: string | null; sinceIso: string }> {
  const sinceIso = dashboardInitialTransactionsSinceIso(now);
  const result = await resolveCompatibleTransactionSelect((selectStr) =>
    fetchAllDashboardTransactionRows(client, selectStr, sinceIso)
  );
  return { ...result, sinceIso };
}

export async function loadRecentUserTransactionsFromSupabase(
  client: SupabaseServerClient,
  limit = 2000
): Promise<{ transactions: DashboardTx[]; errorMessage: string | null }> {
  for (const selectStr of TX_SELECT_VARIANTS) {
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
    if (transactionSelectMissingColumn(err, "category_manual") && selectStr.includes("category_manual")) continue;
    return { transactions: [], errorMessage: err };
  }
  return { transactions: [], errorMessage: "Aucun schéma transactions compatible." };
}
