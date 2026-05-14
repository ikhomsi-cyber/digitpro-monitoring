import { NextResponse } from "next/server";
import { fetchWithNetworkDiagnostics } from "@/lib/fetch-network-error";
import { powensApiBaseUrl } from "@/lib/powens/cloud-api";

export const dynamic = "force-dynamic";

/**
 * POST (ou GET) /api/powens/auth-init-test
 *
 * Teste `POST …/2.0/auth/init` avec POWENS_CLIENT_ID / POWENS_CLIENT_SECRET (Budget Insight).
 * Désactivé en production (pas d’exposition du flux sur Internet).
 */
async function handleAuthInitTest() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Route désactivée en production (tests Powens uniquement en dev)." },
      { status: 403 }
    );
  }

  const client_id = process.env.POWENS_CLIENT_ID?.trim();
  const client_secret = process.env.POWENS_CLIENT_SECRET?.trim();
  if (!client_id || !client_secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "POWENS_CLIENT_ID ou POWENS_CLIENT_SECRET manquant dans .env.local"
      },
      { status: 400 }
    );
  }

  let url: string;
  try {
    url = `${powensApiBaseUrl()}/auth/init`;
  } catch (e) {
    const message = e instanceof Error ? e.message : "POWENS_DOMAIN / POWENS_API_BASE_URL manquant ou invalide.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    const response = await fetchWithNetworkDiagnostics(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id, client_secret }),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000)
      },
      "Powens auth/init"
    );

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { parseError: true, rawPreview: text.slice(0, 2000) };
    }

    return NextResponse.json({
      ok: response.ok,
      requestUrl: url,
      httpStatus: response.status,
      data
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, requestUrl: url, error: message },
      { status: 502 }
    );
  }
}

export async function GET() {
  return handleAuthInitTest();
}

export async function POST() {
  return handleAuthInitTest();
}
