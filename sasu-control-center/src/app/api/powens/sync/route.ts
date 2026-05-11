import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { powensListAccounts, powensListTransactions } from "@/lib/powens/client";
import type { Json } from "@/lib/supabase/types";

function pickLabel(a: { name?: string | null; original_name?: string | null }) {
  const t = String(a.name ?? "").trim();
  if (t) return t;
  const o = String(a.original_name ?? "").trim();
  if (o) return o;
  return "";
}

/**
 * Filter "compte courant uniquement".
 * Powens exposes `usage` (PRIV/ORGA) and `type.name` (technical). We accept:
 * - type.name contains "checking" or "current" or "compte" or "courant"
 * - or label contains "courant"
 *
 * This is a heuristic; can be refined once we see real payloads in `raw`.
 */
function looksLikeCheckingAccount(acc: { type?: { name?: string } | null; name?: string | null; original_name?: string | null }): boolean {
  const typeName = String(acc.type?.name ?? "").toLowerCase();
  const label = `${acc.name ?? ""} ${acc.original_name ?? ""}`.toLowerCase();
  if (/(checking|current|courant|compte)/.test(typeName)) return true;
  if (/\bcourant\b/.test(label)) return true;
  return false;
}

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase not configured (demo mode)." }, { status: 400 });
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const tokenRes = await supabase.from("powens_users").select("auth_token").maybeSingle();
    if (tokenRes.error) return NextResponse.json({ ok: false, error: tokenRes.error.message }, { status: 400 });
    const token = String(tokenRes.data?.auth_token ?? "").trim();
    if (!token) return NextResponse.json({ ok: false, error: "Powens user not initialized." }, { status: 400 });

    const accounts = await powensListAccounts(token);
    const checkingAccounts = accounts.filter((a) => looksLikeCheckingAccount(a) && !a.deleted);

    // Upsert accounts first.
    const accountRows = checkingAccounts.map((a) => ({
      powens_account_id: String(a.id),
      connection_id: a.id_connection == null ? null : String(a.id_connection),
      label: pickLabel(a),
      iban: a.iban ?? null,
      balance: a.balance == null ? null : Number(a.balance),
      currency: (a.currency as { code?: string } | null)?.code ?? "EUR",
      raw: a as unknown as Json
    }));

    if (accountRows.length) {
      const upAcc = await supabase
        .from("lcl_accounts")
        .upsert(accountRows, { onConflict: "user_id,powens_account_id" });
      if (upAcc.error) return NextResponse.json({ ok: false, error: upAcc.error.message }, { status: 400 });
    }

    // Transactions: pull one page (up to 1000). For larger history, we can loop `_links.next` later.
    const txs = await powensListTransactions(token, { limit: 1000 });

    const allowedAccountIds = new Set(checkingAccounts.map((a) => String(a.id)));
    const filtered = txs.filter((t) => allowedAccountIds.has(String(t.id_account)) && !t.deleted);

    const txRows = filtered.map((t) => ({
      powens_transaction_id: String(t.id),
      powens_account_id: String(t.id_account),
      connection_id: t.id_connection == null ? null : String(t.id_connection),
      date: String(t.date).slice(0, 10),
      rdate: t.rdate ? String(t.rdate).slice(0, 10) : null,
      label: String(t.wording ?? t.simplified_wording ?? t.original_wording ?? "").trim(),
      amount: Number(t.value ?? 0),
      category: Array.isArray(t.categories) ? String(t.categories[0]?.code ?? "") || null : null,
      raw: t as unknown as Json
    }));

    if (txRows.length) {
      const upTx = await supabase
        .from("lcl_transactions")
        .upsert(txRows, { onConflict: "user_id,powens_transaction_id" });
      if (upTx.error) return NextResponse.json({ ok: false, error: upTx.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      accounts: { total: accounts.length, kept: checkingAccounts.length },
      transactions: { total: txs.length, kept: filtered.length, upserted: txRows.length }
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Powens sync failed" },
      { status: 500 }
    );
  }
}

