import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { loadQontoLiveBalanceEur } from "@/lib/qonto/live-balance";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const [res, qontoLiveBalanceEur] = await Promise.all([
    (async () => {
      console.time("dashboard:transactions-full");
      try {
        return await loadAllUserTransactionsFromSupabase(supabase);
      } finally {
        console.timeEnd("dashboard:transactions-full");
      }
    })(),
    loadQontoLiveBalanceEur()
  ]);
  if (res.errorMessage) {
    return NextResponse.json({ ok: false, error: res.errorMessage }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    transactions: res.transactions,
    heroStats: computeDashboardHeroStats(res.transactions, new Date(), { qontoLiveBalanceEur })
  });
}
