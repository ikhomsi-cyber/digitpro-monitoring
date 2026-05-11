import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { powensConnectWebviewUrl, powensTemporaryCode } from "@/lib/powens/client";

export async function GET() {
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

    const code = await powensTemporaryCode(token);
    const url = powensConnectWebviewUrl({ code });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Powens connect-url failed" },
      { status: 500 }
    );
  }
}

