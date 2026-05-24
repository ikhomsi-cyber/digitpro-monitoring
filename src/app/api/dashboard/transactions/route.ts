import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const res = await loadAllUserTransactionsFromSupabase(supabase);
  if (res.errorMessage) {
    return NextResponse.json({ ok: false, error: res.errorMessage }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    transactions: res.transactions,
    heroStats: computeDashboardHeroStats(res.transactions)
  });
}
