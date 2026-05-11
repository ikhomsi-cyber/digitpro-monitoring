import "server-only";

import { getPowensEnv } from "./config";
import type { PowensTransaction } from "./client";

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (/<!DOCTYPE html>|<title>.*404/i.test(text)) {
      return "(réponse HTML 404 — souvent POWENS_DOMAIN = URL du site au lieu de xxx.biapi.pro)";
    }
    return text.slice(0, 2000);
  } catch {
    return "";
  }
}

async function listForOneAccount(
  authToken: string,
  accountId: number,
  opts?: { limit?: number; minDate?: string }
): Promise<PowensTransaction[]> {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing.");
  const limit = Math.min(1000, Math.max(1, Number(opts?.limit ?? 1000)));
  const u = new URL(`https://${env.domain}/2.0/users/me/accounts/${accountId}/transactions`);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("all", "");
  if (opts?.minDate) u.searchParams.set("min_date", opts.minDate);
  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${authToken}` },
    cache: "no-store"
  });
  if (res.status === 409) return [];
  if (!res.ok) {
    const details = await readErrorBody(res);
    throw new Error(`Powens list transactions (account ${accountId}) failed: ${res.status}${details ? ` — ${details}` : ""}`);
  }
  const json = (await res.json()) as { transactions?: PowensTransaction[] };
  return Array.isArray(json?.transactions) ? json.transactions : [];
}

/**
 * Agrège les transactions pour plusieurs comptes (dédoublonnage par `id`).
 * Préféré à `/users/me/transactions` seul : pagination relationnelle Powens.
 */
export async function powensListTransactionsForAccounts(
  authToken: string,
  accountIds: number[],
  opts?: { limit?: number; minDate?: string }
): Promise<PowensTransaction[]> {
  const byId = new Map<number, PowensTransaction>();
  for (const accountId of accountIds) {
    const chunk = await listForOneAccount(authToken, accountId, opts);
    for (const t of chunk) {
      if (!t.deleted) byId.set(t.id, t);
    }
  }
  return Array.from(byId.values());
}
