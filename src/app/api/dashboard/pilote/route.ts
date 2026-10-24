import { decodePiloteReport } from "@/lib/bankin/pilote-report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { privateResponseHeaders } from "@/lib/security/http";
export async function GET() {
  const client = await createSupabaseServerClient();
  if (!client) return Response.json({ error: "Connexion requise." }, { status: 401, headers: privateResponseHeaders });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return Response.json({ error: "Connexion requise." }, { status: 401, headers: privateResponseHeaders });
  const { data, error } = await client.from("bankin_pilote_snapshots").select("snapshot").eq("user_id", user.id).maybeSingle();
  if (error) return Response.json({ error: "Le bilan Bankin est indisponible. Vérifiez la migration Pilote." }, { status: 503, headers: privateResponseHeaders });
  try {
    const snapshot = data?.snapshot == null ? null : decodePiloteReport(data.snapshot);
    return Response.json({ snapshot }, { headers: privateResponseHeaders });
  } catch {
    return Response.json({ error: "Le bilan Pilote sauvegardé est illisible." }, { status: 503, headers: privateResponseHeaders });
  }
}
