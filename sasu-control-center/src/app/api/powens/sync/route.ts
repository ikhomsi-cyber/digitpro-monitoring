import { NextResponse } from "next/server";
import { syncRevolutPersonalPowensFromApi } from "@/app/dashboard/actions";

/**
 * POST — synchronise Revolut **personnel** via Powens (comptes détectés + import dashboard).
 */
export async function POST() {
  try {
    const result = await syncRevolutPersonalPowensFromApi();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Powens sync failed";
    const isUser = /Powens|Revolut|initialis|Aucun compte|non authentifié|désactivées/i.test(msg);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: isUser ? 400 : 500 }
    );
  }
}
