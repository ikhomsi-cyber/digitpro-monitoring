import "server-only";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export class MobileError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function mobileAuth(request: Request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new MobileError(401, "Connexion requise.");
  const env = getSupabaseEnv();
  if (!env) throw new MobileError(503, "Supabase indisponible.");
  const client = createServerClient<Database>(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
    cookies: { getAll: () => [], setAll: () => {} }
  });
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user) throw new MobileError(401, "Session expirée. Reconnectez-vous.");
  return { client, userId: data.user.id };
}

export function mobileJSON(value: unknown, status = 200) {
  return Response.json(value, { status, headers: {
    "Cache-Control": "private, no-store", Vary: "Authorization"
  } });
}
export function mobileFailure(error: unknown) {
  return mobileJSON({ error: error instanceof MobileError ? error.message : "Chargement impossible. Réessayez." },
    error instanceof MobileError ? error.status : 503);
}
