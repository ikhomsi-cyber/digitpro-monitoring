import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const url = new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  return NextResponse.redirect(url, { status: 303 });
}

