import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export class SyncBusyError extends Error {
  readonly status = 429;
  constructor() { super("Synchronisation déjà en cours ou trop récente. Réessayez dans une minute."); }
}

export async function withSyncJob<T>(client: SupabaseClient<Database>, userId: string,
  integration: "qonto" | "powens" | "gmail", run: () => Promise<T>): Promise<T> {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error("Connexion requise.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Contrôle des synchronisations indisponible.");
  const lease = randomUUID();
  const args = { p_user_id: userId, p_integration: integration, p_lease: lease };
  const acquired = await admin.rpc("integration_job_acquire", args);
  if (acquired.error) throw new Error("Contrôle des synchronisations indisponible. Vérifiez la migration.");
  if (!acquired.data) throw new SyncBusyError();
  try { return await run(); }
  finally {
    const released = await admin.rpc("integration_job_release", args);
    if (released.error) console.warn("[sync] lease release failed", { integration });
  }
}
