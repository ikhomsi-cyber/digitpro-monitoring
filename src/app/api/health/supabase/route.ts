import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Vérifie la présence des variables d’env et la joignabilité du service Auth Supabase.
 * GET /api/health/supabase — ne renvoie jamais la clé anon, uniquement le host et des statuts HTTP.
 */
export async function GET() {
  const env = getSupabaseEnv();
  if (!env) {
    return NextResponse.json(
      {
        ok: false,
        step: "env",
        detail: "NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquant(e) ou vide"
      },
      { status: 503 }
    );
  }

  const base = env.url.replace(/\/+$/, "");
  let host: string;
  try {
    host = new URL(base).host;
  } catch {
    return NextResponse.json(
      { ok: false, step: "env", detail: "NEXT_PUBLIC_SUPABASE_URL n’est pas une URL valide" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${base}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: env.anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });

    const bodyText = await res.text();
    const healthy = res.ok;

    return NextResponse.json({
      ok: healthy,
      step: "auth_health",
      host,
      authHealthHttpStatus: res.status,
      authHealthBodyPreview: bodyText.slice(0, 120)
    }, { status: healthy ? 200 : 503 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        step: "network",
        host,
        detail: err instanceof Error ? err.message : "Échec réseau vers Supabase"
      },
      { status: 503 }
    );
  }
}
