import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ExpenseNoteTag = "note_de_frais" | "repas_client";

function isValidTag(t: unknown): t is ExpenseNoteTag {
  return t === "note_de_frais" || t === "repas_client";
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured (demo mode)." }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const transactionId = url.searchParams.get("transaction_id");

  let q = supabase.from("expense_notes").select("id,transaction_id,tag,created_at,updated_at");
  if (transactionId) q = q.eq("transaction_id", transactionId);
  const res = await q.order("created_at", { ascending: false }).limit(5000);
  if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 400 });

  return NextResponse.json({ ok: true, rows: res.data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured (demo mode)." }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as null | {
    transactionId?: unknown;
    tag?: unknown;
  };
  const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
  const tag = body?.tag;
  if (!transactionId) {
    return NextResponse.json({ ok: false, error: "Missing transactionId" }, { status: 400 });
  }
  if (!isValidTag(tag)) {
    return NextResponse.json({ ok: false, error: "Invalid tag (use note_de_frais or repas_client)" }, { status: 400 });
  }

  const ins = await supabase
    .from("expense_notes")
    .upsert(
      { transaction_id: transactionId, tag },
      { onConflict: "user_id,transaction_id,tag" }
    )
    .select("id,transaction_id,tag,created_at,updated_at")
    .maybeSingle();
  if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400 });

  return NextResponse.json({ ok: true, row: ins.data });
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured (demo mode)." }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as null | {
    transactionId?: unknown;
    tag?: unknown;
  };
  const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
  const tag = body?.tag;
  if (!transactionId) {
    return NextResponse.json({ ok: false, error: "Missing transactionId" }, { status: 400 });
  }
  if (!isValidTag(tag)) {
    return NextResponse.json({ ok: false, error: "Invalid tag (use note_de_frais or repas_client)" }, { status: 400 });
  }

  const del = await supabase
    .from("expense_notes")
    .delete()
    .eq("transaction_id", transactionId)
    .eq("tag", tag);
  if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

