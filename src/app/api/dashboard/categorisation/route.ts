import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildBankinReferenceCategoryList } from "@/lib/bankin/reference-categories";
import {
  categorisationMonthBounds,
  currentCategorisationMonthKey,
  mapCategorisationCandidateRows,
  normalizeCategory,
  type CategorisationCandidateRow
} from "@/lib/categorisation-candidates";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 400 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const monthKey = currentCategorisationMonthKey();
  const { startIso, endIso } = categorisationMonthBounds(monthKey);

  const [categoryRes, txRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("category,import_sessions!inner(format)")
      .eq("import_sessions.format", "bankin")
      .order("category", { ascending: true }),
    supabase
      .from("transactions")
      .select("id,date,label,amount,company,bank_name,category,import_sessions!inner(format)")
      .eq("import_sessions.format", "powens")
      .lt("amount", 0)
      .gte("date", startIso)
      .lte("date", endIso)
      .order("date", { ascending: false })
      .limit(200)
  ]);

  if (categoryRes.error || txRes.error) {
    return NextResponse.json(
      { ok: false, error: categoryRes.error?.message ?? txRes.error?.message ?? "Chargement impossible." },
      { status: 400 }
    );
  }

  const categories = buildBankinReferenceCategoryList(
    (categoryRes.data ?? []).map((row) => normalizeCategory((row as { category?: unknown }).category))
  );
  const transactions = mapCategorisationCandidateRows(
    (txRes.data ?? []) as unknown as CategorisationCandidateRow[],
    monthKey
  );

  return NextResponse.json({ ok: true, categories, transactions, monthKey });
}
