import "server-only";

import { computeDashboardHeroStats, type DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { BILLABLE_CLIENT_TJM_HT, type BillableRatePeriod } from "@/lib/billable-client-days";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type TxSummaryRow = {
  id: string;
  date: string;
  label: string | null;
  category: string | null;
  amount: number | string;
  balance?: number | string | null;
  company: string | null;
  bank_name?: string | null;
  scope?: "pro" | "personal" | null;
  import_sessions?: { format?: string | null } | null;
};

function mapTxSummaryRows(rows: readonly TxSummaryRow[]): DashboardTx[] {
  return rows.map((row) => ({
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

function startOfRollingHeroWindow(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function loadDashboardHeroStatsFromSupabase(
  client: SupabaseServerClient,
  now = new Date()
): Promise<{ stats: DashboardHeroStats | null; errorMessage: string | null }> {
  const since = startOfRollingHeroWindow(now);
  const { data, error } = await client
    .from("transactions")
    .select("id,date,label,category,amount,balance,company,bank_name,scope,import_sessions(format)")
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(2500);

  if (error) return { stats: null, errorMessage: error.message };
  return {
    stats: computeDashboardHeroStats(mapTxSummaryRows((data ?? []) as unknown as TxSummaryRow[]), now),
    errorMessage: null
  };
}

export async function loadTransactionYearBounds(
  client: SupabaseServerClient
): Promise<{ minYear: number; maxYear: number } | null> {
  const [oldest, newest] = await Promise.all([
    client.from("transactions").select("date").order("date", { ascending: true }).limit(1).maybeSingle(),
    client.from("transactions").select("date").order("date", { ascending: false }).limit(1).maybeSingle()
  ]);
  const d0 = oldest.data?.date;
  const d1 = newest.data?.date;
  if (oldest.error || newest.error || d0 == null || d1 == null) return null;
  const minYear = Number(String(d0).slice(0, 4));
  const maxYear = Number(String(d1).slice(0, 4));
  if (!Number.isFinite(minYear) || !Number.isFinite(maxYear) || minYear > maxYear) return null;
  return { minYear, maxYear };
}

export async function loadBillableActivitySettings(client: SupabaseServerClient, userId: string): Promise<{
  initialBillableWorkDays: string[];
  initialBillableTjmHt: number | null;
  billableRatePeriods: BillableRatePeriod[];
}> {
  const [daysRes, setRes, ratesRes] = await Promise.all([
    client
      .from("billable_work_days")
      .select("work_date")
      .eq("user_id", userId)
      .order("work_date", { ascending: true }),
    client
      .from("user_billable_settings")
      .select("tjm_ht")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("billable_rate_periods")
      .select("client_name,start_date,end_date,tjm_ht")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
  ]);

  const initialBillableWorkDays = !daysRes.error && daysRes.data
    ? daysRes.data.map((r) => String((r as { work_date: string }).work_date).slice(0, 10))
    : [];

  let initialBillableTjmHt: number | null = null;
  if (!setRes.error && setRes.data != null) {
    const raw = (setRes.data as { tjm_ht: number | string }).tjm_ht;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n !== BILLABLE_CLIENT_TJM_HT) initialBillableTjmHt = n;
    else if (Number.isFinite(n) && n > 0) initialBillableTjmHt = n;
  }

  const billableRatePeriods: BillableRatePeriod[] = !ratesRes.error && ratesRes.data
    ? ratesRes.data.map((row) => {
        const r = row as {
          client_name: string | null;
          start_date: string;
          end_date: string | null;
          tjm_ht: number | string;
        };
        return {
          clientName: String(r.client_name ?? ""),
          startDate: String(r.start_date).slice(0, 10),
          endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
          tjmHt: Number(r.tjm_ht)
        };
      })
    : [];

  return { initialBillableWorkDays, initialBillableTjmHt, billableRatePeriods };
}
