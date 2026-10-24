import { decodePiloteReport } from "@/lib/bankin/pilote-report";
import { buildPiloteDaily } from "@/lib/bankin/pilote-daily";
import { decodePiloteStorage, type StoredPiloteSnapshot } from "@/lib/bankin/pilote-storage";
import type { BankinPiloteSnapshot } from "@/lib/pilote";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { privateResponseHeaders } from "@/lib/security/http";
export async function GET() {
  const started=performance.now();
  const client = await createSupabaseServerClient();
  if (!client) return Response.json({ error: "Connexion requise." }, { status: 401, headers: privateResponseHeaders });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return Response.json({ error: "Connexion requise." }, { status: 401, headers: privateResponseHeaders });
  const authenticated=performance.now();
  const { data, error } = await client.from("bankin_pilote_snapshots").select("snapshot").eq("user_id", user.id).maybeSingle();
  if (error) return Response.json({ error: "Le bilan Bankin est indisponible. Vérifiez la migration Pilote." }, { status: 503, headers: privateResponseHeaders });
  const loaded=performance.now();
  try {
    const decoded = data?.snapshot ? decodePiloteStorage(data.snapshot as unknown as BankinPiloteSnapshot | StoredPiloteSnapshot) : null;
    const snapshot = decoded ? decodePiloteReport(decoded) : null;
    const daily=decoded?buildPiloteDaily(decoded):null;
    const computed=performance.now();
    const timings={auth:Math.round(authenticated-started),database:Math.round(loaded-authenticated),report:Math.round(computed-loaded)};
    if(process.env.NODE_ENV==="development")console.info("[pilote] load timings (ms)",timings);
    return Response.json({ snapshot, daily }, { headers: {...privateResponseHeaders,"Server-Timing":`auth;dur=${timings.auth}, database;dur=${timings.database}, report;dur=${timings.report}`} });
  } catch {
    return Response.json({ error: "Le bilan Pilote sauvegardé est illisible." }, { status: 503, headers: privateResponseHeaders });
  }
}
