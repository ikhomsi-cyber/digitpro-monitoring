import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Auth } from "googleapis";
import type { Database } from "@/lib/supabase/types";
import { createGmailOAuthClient } from "@/lib/gmail/oauth";
import { isInvalidGrantError } from "@/lib/gmail/oauth-grant";

import { readIntegrationSecret, writeIntegrationSecret, deleteIntegrationSecret } from "@/lib/security/integration-secrets";

type SupabaseDb = SupabaseClient<Database>;

export type GmailTokenRow = {
  id: string; user_id: string; email: string | null; refresh_token: string;
  access_token: string | null; token_expiry: string | null; scope: string | null;
  created_at: string; updated_at: string;
};

export async function loadGmailTokenRow(
  supabase: SupabaseDb,
  userId: string
): Promise<GmailTokenRow | null> {
  return await readIntegrationSecret(supabase, userId, "gmail") as GmailTokenRow | null;
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
  await writeIntegrationSecret(supabase, userId, "gmail", {
    email: values.email ?? null,
    refresh_token: values.refreshToken,
    access_token: values.accessToken ?? null,
    token_expiry: values.expiryDate ? new Date(values.expiryDate).toISOString() : null,
    scope: values.scope ?? null
  });
}

export async function deleteGmailToken(supabase: SupabaseDb, userId: string): Promise<void> {
  await deleteIntegrationSecret(supabase, userId, "gmail");
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
