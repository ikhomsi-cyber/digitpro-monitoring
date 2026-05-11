import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { powensInitUser } from "@/lib/powens/client";

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

    // If already initialized, no-op.
    const existing = await supabase.from("powens_users").select("id").maybeSingle();
    if (!existing.error && existing.data?.id) {
      return NextResponse.json({ ok: true, alreadyInitialized: true });
    }

    const { authToken, powensUserId } = await powensInitUser();
    const up = await supabase
      .from("powens_users")
      .upsert({ auth_token: authToken, powens_user_id: powensUserId }, { onConflict: "user_id" })
      .select("id")
      .maybeSingle();
    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, alreadyInitialized: false });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Powens init failed" },
      { status: 500 }
    );
  }
}

