import { NextResponse } from "next/server";
import { getPowensEnvDiagnostics } from "@/lib/powens/env-check";

export const dynamic = "force-dynamic";

/**
 * GET /api/powens/config-check
 *
 * Dev : vérifie que les variables Powens sont cohérentes (sans afficher client_secret ni tokens).
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Route désactivée en production." },
      { status: 403 }
    );
  }

  return NextResponse.json(getPowensEnvDiagnostics());
}
