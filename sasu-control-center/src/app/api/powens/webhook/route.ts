import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { powensListAccounts, powensListTransactions } from "@/lib/powens/client";
import type { Json } from "@/lib/supabase/types";

/**
 * Optional Powens webhook endpoint.
 *
 * NOTE: signature verification depends on Powens configuration. This endpoint
 * currently relies on "security by unguessable URL + RLS + per-user token fetch".
 * If you have a webhook secret/signature, add verification here.
 */

function pickLabel(a: { name?: string | null; original_name?: string | null }) {
  const t = String(a.name ?? "").trim();
  if (t) return t;
  const o = String(a.original_name ?? "").trim();
  if (o) return o;
  return "";
}

function looksLikeCheckingAccount(acc: { type?: { name?: string } | null; name?: string | null; original_name?: string | null }): boolean {
  const typeName = String(acc.type?.name ?? "").toLowerCase();
  const label = `${acc.name ?? ""} ${acc.original_name ?? ""}`.toLowerCase();
  if (/(checking|current|courant|compte)/.test(typeName)) return true;
  if (/\bcourant\b/.test(label)) return true;
  return false;
}

export async function POST(req: Request) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as null | {
    user?: { id?: number };
  };
  const powensUserId = typeof body?.user?.id === "number" ? body.user.id : null;
  if (!powensUserId) return NextResponse.json({ ok: false, error: "Missing webhook user.id" }, { status: 400 });

  const tok = await supabase.from("powens_users").select("user_id,auth_token").eq("powens_user_id", powensUserId).maybeSingle();
  if (tok.error) return NextResponse.json({ ok: false, error: tok.error.message }, { status: 400 });
  const authToken = String(tok.data?.auth_token ?? "").trim();
  const userId = tok.data?.user_id ?? null;
  if (!authToken || !userId) return NextResponse.json({ ok: false, error: "Unknown powens_user_id" }, { status: 404 });

  const accounts = await powensListAccounts(authToken);
  const checkingAccounts = accounts.filter((a) => looksLikeCheckingAccount(a) && !a.deleted);
  const allowedAccountIds = new Set(checkingAccounts.map((a) => String(a.id)));

  const accountRows = checkingAccounts.map((a) => ({
    user_id: userId,
    powens_account_id: String(a.id),
    connection_id: a.id_connection == null ? null : String(a.id_connection),
    label: pickLabel(a),
    iban: a.iban ?? null,
    balance: a.balance == null ? null : Number(a.balance),
    currency: (a.currency as { code?: string } | null)?.code ?? "EUR",
    raw: a as unknown as Json
  }));

  if (accountRows.length) {
    const upAcc = await supabase.from("lcl_accounts").upsert(accountRows, { onConflict: "user_id,powens_account_id" });
    if (upAcc.error) return NextResponse.json({ ok: false, error: upAcc.error.message }, { status: 400 });
  }

  const txs = await powensListTransactions(authToken, { limit: 1000 });
  const filtered = txs.filter((t) => allowedAccountIds.has(String(t.id_account)) && !t.deleted);

  const txRows = filtered.map((t) => ({
    user_id: userId,
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
    const upTx = await supabase.from("lcl_transactions").upsert(txRows, { onConflict: "user_id,powens_transaction_id" });
    if (upTx.error) return NextResponse.json({ ok: false, error: upTx.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, powensUserId, accounts: checkingAccounts.length, transactions: txRows.length });
}

