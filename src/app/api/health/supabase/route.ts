import { getSupabaseEnv } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export function GET() {
  const ready = getSupabaseEnv() !== null;
  return Response.json({ ok: ready }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
