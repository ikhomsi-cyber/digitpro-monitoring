import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Auth } from "googleapis";
import type { Database } from "@/lib/supabase/types";
import { createGmailOAuthClient } from "@/lib/gmail/oauth";
import { isInvalidGrantError } from "@/lib/gmail/oauth-grant";

type SupabaseDb = SupabaseClient<Database>;

const MIGRATION_HINT =
  "Table « gmail_oauth_tokens » introuvable : appliquez la migration Supabase (20260609140000_gmail_oauth_tokens.sql).";

function isMissingTableError(message: string | undefined): boolean {
  return /gmail_oauth_tokens|does not exist|schema cache|42P01/i.test(message ?? "");
}

export type GmailTokenRow = Database["public"]["Tables"]["gmail_oauth_tokens"]["Row"];

export async function loadGmailTokenRow(
  supabase: SupabaseDb,
  userId: string
): Promise<GmailTokenRow | null> {
  const res = await supabase
    .from("gmail_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (res.error) {
    if (isMissingTableError(res.error.message)) throw new Error(MIGRATION_HINT);
    throw new Error(res.error.message);
  }
  return res.data ?? null;
}

export async function saveGmailToken(
  supabase: SupabaseDb,
  userId: string,
  values: {
    email?: string | null;
    refreshToken: string;
    accessToken?: string | null;
    expiryDate?: number | null;
    scope?: string | null;
  }
): Promise<void> {
  const res = await supabase.from("gmail_oauth_tokens").upsert(
    {
      user_id: userId,
      email: values.email ?? null,
      refresh_token: values.refreshToken,
      access_token: values.accessToken ?? null,
      token_expiry: values.expiryDate ? new Date(values.expiryDate).toISOString() : null,
      scope: values.scope ?? null
    },
    { onConflict: "user_id" }
  );
  if (res.error) {
    if (isMissingTableError(res.error.message)) throw new Error(MIGRATION_HINT);
    throw new Error(res.error.message);
  }
}

export async function deleteGmailToken(supabase: SupabaseDb, userId: string): Promise<void> {
  const res = await supabase.from("gmail_oauth_tokens").delete().eq("user_id", userId);
  if (res.error && !isMissingTableError(res.error.message)) {
    throw new Error(res.error.message);
  }
}

/** Supprime le jeton stocké si Google renvoie invalid_grant. */
export async function clearGmailTokenIfInvalidGrant(
  supabase: SupabaseDb,
  userId: string,
  error: unknown
): Promise<boolean> {
  if (!isInvalidGrantError(error)) return false;
  await deleteGmailToken(supabase, userId);
  return true;
}

/**
 * Client OAuth2 prêt à l'emploi pour l'utilisateur : injecte le refresh_token stocké,
 * valide le jeton (refresh si besoin), et purge le token si invalid_grant.
 * Renvoie `null` si aucun compte Gmail n'est connecté ou si reconnexion requise.
 */
export async function getAuthorizedGmailClient(
  supabase: SupabaseDb,
  userId: string
): Promise<Auth.OAuth2Client | null> {
  const row = await loadGmailTokenRow(supabase, userId);
  if (!row?.refresh_token) return null;

  const client = createGmailOAuthClient();
  client.setCredentials({
    refresh_token: row.refresh_token,
    access_token: row.access_token ?? undefined,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : undefined
  });

  client.on("tokens", (tokens) => {
    void saveGmailToken(supabase, userId, {
      email: row.email,
      refreshToken: tokens.refresh_token ?? row.refresh_token,
      accessToken: tokens.access_token ?? row.access_token,
      expiryDate: tokens.expiry_date ?? null,
      scope: tokens.scope ?? row.scope
    }).catch(() => {
      // Persistance best-effort : un échec ne doit pas interrompre la récupération.
    });
  });

  try {
    await client.getAccessToken();
  } catch (error) {
    if (isInvalidGrantError(error)) {
      await deleteGmailToken(supabase, userId);
      return null;
    }
    throw error;
  }

  return client;
}

/**
 * Exécute une action Gmail ; purge le token et renvoie null si invalid_grant.
 */
export async function withAuthorizedGmailClient<T>(
  supabase: SupabaseDb,
  userId: string,
  fn: (client: Auth.OAuth2Client) => Promise<T>
): Promise<T | null> {
  const client = await getAuthorizedGmailClient(supabase, userId);
  if (!client) return null;
  try {
    return await fn(client);
  } catch (error) {
    if (await clearGmailTokenIfInvalidGrant(supabase, userId, error)) return null;
    throw error;
  }
}
