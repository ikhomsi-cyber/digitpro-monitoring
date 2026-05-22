import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BANKIN_UNCATEGORIZED_CATEGORY } from "@/lib/bankin/categorize";
import { buildBankinReferenceCategoryList } from "@/lib/bankin/reference-categories";

type TxRow = {
  id: string;
  date: string;
  label: string | null;
  amount: number | string;
  company: string | null;
  bank_name: string | null;
  category: string | null;
};

function normalizeCategory(raw: unknown): string {
  return String(raw ?? "").trim();
}

function fold(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function isCardPowensLabel(raw: string): boolean {
  return /\b(cb|carte|card)\b/.test(fold(raw));
}

function isLikelyNdfDigitProCandidate(raw: string): boolean {
  const label = fold(raw);
  if (/\b(quick|domino|dominos|tacos|boucherie|boucheries|auchan|grand frais|carrefour)\b/.test(label)) {
    return false;
  }
  return /\b(repas|dejeuner|dej|restaurant|resto|brasserie|bistrot|cafe|burger|pizza|sushi|monoprix|franprix)\b/.test(label);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 400 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

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
      .eq("category", BANKIN_UNCATEGORIZED_CATEGORY)
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
  const transactions = ((txRes.data ?? []) as unknown as TxRow[])
    .map((row) => ({
      id: String(row.id),
      date: String(row.date).slice(0, 10),
      label: String(row.label ?? ""),
      amount: Number(row.amount),
      company: String(row.company ?? "").trim(),
      bankName: row.bank_name ? String(row.bank_name).trim() : null
    }))
    .filter((tx) => {
      const blob = `${tx.label} ${tx.company}`;
      return isCardPowensLabel(blob) && isLikelyNdfDigitProCandidate(blob);
    });

  return NextResponse.json({ ok: true, categories, transactions });
}
