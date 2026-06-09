import "server-only";

import { computeDashboardHeroStats, type DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { loadQontoLiveBalanceEur } from "@/lib/qonto/live-balance";
import { BILLABLE_CLIENT_TJM_HT, type BillableRatePeriod } from "@/lib/billable-client-days";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export async function loadDashboardHeroStatsFromSupabase(
  client: SupabaseServerClient,
  now = new Date()
): Promise<{ stats: DashboardHeroStats | null; errorMessage: string | null }> {
  const [{ transactions, errorMessage }, qontoLiveBalanceEur] = await Promise.all([
    loadAllUserTransactionsFromSupabase(client),
    loadQontoLiveBalanceEur()
  ]);
  if (errorMessage) return { stats: null, errorMessage };
  return {
    stats: computeDashboardHeroStats(transactions, now, { qontoLiveBalanceEur }),
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
  initialAnnualRevenueTargetHt: number | null;
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
      .select("tjm_ht,annual_revenue_target_ht")
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
  let initialAnnualRevenueTargetHt: number | null = null;
  if (!setRes.error && setRes.data != null) {
    const row = setRes.data as {
      tjm_ht: number | string;
      annual_revenue_target_ht?: number | string | null;
    };
    const raw = row.tjm_ht;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n !== BILLABLE_CLIENT_TJM_HT) initialBillableTjmHt = n;
    else if (Number.isFinite(n) && n > 0) initialBillableTjmHt = n;
    const targetRaw = row.annual_revenue_target_ht;
    if (targetRaw != null) {
      const target = Number(targetRaw);
      if (Number.isFinite(target) && target > 0) initialAnnualRevenueTargetHt = target;
    }
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

  return { initialBillableWorkDays, initialBillableTjmHt, initialAnnualRevenueTargetHt, billableRatePeriods };
}
