import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

type Integration = "gmail" | "gmail-secondary" | "powens";
const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const value = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("Stockage sécurisé des intégrations non configuré.");
  return Buffer.from(value, "hex");
}

export function encryptIntegrationToken(token: string, binding: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptIntegrationToken(token: string, binding: string): string {
  if (!token.startsWith(PREFIX)) throw new Error("Jeton d’intégration non chiffré : migration requise.");
  const data = Buffer.from(token.slice(PREFIX.length), "base64");
  if (data.length < 28) throw new Error("Jeton d’intégration invalide.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

/** Never trust a userId from a caller when using the privileged credential store. */
async function verifiedStore(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== userId) throw new Error("Connexion requise.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Stockage sécurisé des intégrations indisponible.");
  return admin;
}

function transformTokens(row: Record<string, Json>, integration: Integration, userId: string, encrypt: boolean) {
  const result = { ...row };
  const fields = integration !== "powens" ? ["refresh_token", "access_token"] : ["auth_token"];
  for (const field of fields) {
    const token = result[field];
    if (typeof token === "string" && token) {
      const binding = `${integration}:${userId}:${field}`;
      result[field] = encrypt ? encryptIntegrationToken(token, binding) : decryptIntegrationToken(token, binding);
    }
  }
  return result;
}

export async function readIntegrationSecret(client: SupabaseClient<Database>, userId: string, integration: Integration) {
  const admin = await verifiedStore(client, userId);
  const { data, error } = await admin.rpc("integration_secret_read", { p_user_id: userId, p_integration: integration });
  if (error) throw new Error("Connexion d’intégration indisponible. Vérifiez la migration de sécurité.");
  if (data == null) return null;
  return transformTokens(data as Record<string, Json>, integration, userId, false);
}

export async function writeIntegrationSecret(client: SupabaseClient<Database>, userId: string, integration: Integration, row: Record<string, Json>) {
  const admin = await verifiedStore(client, userId);
  const { error } = await admin.rpc("integration_secret_write", {
    p_user_id: userId, p_integration: integration, p_values: transformTokens(row, integration, userId, true)
  });
  if (error) throw new Error("Enregistrement sécurisé de l’intégration impossible.");
}

export async function deleteIntegrationSecret(client: SupabaseClient<Database>, userId: string, integration: Integration) {
  const admin = await verifiedStore(client, userId);
  const { error } = await admin.rpc("integration_secret_delete", { p_user_id: userId, p_integration: integration });
  if (error) throw new Error("Suppression sécurisée de l’intégration impossible.");
}
