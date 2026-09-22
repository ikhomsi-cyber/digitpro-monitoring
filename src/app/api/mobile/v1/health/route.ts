import { getSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
/** Public readiness probe: no account, financial data or configuration values. */
export function GET() {
  const ready = getSupabaseEnv() !== null;
  return Response.json({ service: "digitpro-mobile", version: 1, ready }, {
    status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" }
  });
}
