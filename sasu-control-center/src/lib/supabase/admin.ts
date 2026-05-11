import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function trimEnv(raw: string | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  return t.length ? t : null;
}

export function createSupabaseAdminClient(): ReturnType<typeof createClient<Database>> | null {
  const url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) return null;
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

