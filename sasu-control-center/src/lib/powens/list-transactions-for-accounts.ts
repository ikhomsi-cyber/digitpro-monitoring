import "server-only";

import { getPowensEnv } from "./config";
import type { PowensTransaction } from "./client";

/** Historique demandé à Powens (évite une fenêtre trop courte par défaut). */
export function powensDefaultTransactionMinDateIso(monthsBack = 36): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

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

function resolvePowensNextUrl(domain: string, href: string): string {
  const t = href.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const path = t.startsWith("/") ? t : `/${t}`;
  return `https://${domain}${path}`;
}

type TxListJson = {
  transactions?: PowensTransaction[];
  _links?: { next?: { href?: string | null } | null } | null;
};

async function fetchTransactionPages(
  authToken: string,
  domain: string,
  initialUrl: string,
  maxPages: number
): Promise<PowensTransaction[]> {
  const out: PowensTransaction[] = [];
  let url: string | null = initialUrl;
  for (let p = 0; p < maxPages && url; p++) {
    const res = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${authToken}` },
      cache: "no-store"
    });
    if (res.status === 409) return out;
    if (!res.ok) {
      const details = await readErrorBody(res);
      throw new Error(`Powens list transactions failed: ${res.status}${details ? ` — ${details}` : ""}`);
    }
    const json = (await res.json()) as TxListJson;
    const batch = Array.isArray(json?.transactions) ? json.transactions : [];
    out.push(...batch);
    const href = json?._links?.next?.href;
    url = href ? resolvePowensNextUrl(domain, String(href)) : null;
  }
  return out;
}

async function listForOneAccount(
  authToken: string,
  accountId: number,
  minDateIso: string,
  maxPages: number
): Promise<PowensTransaction[]> {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing.");
  const limit = 1000;
  const u = new URL(`https://${env.domain}/2.0/users/me/accounts/${accountId}/transactions`);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("all", "");
  u.searchParams.set("min_date", minDateIso);
  return fetchTransactionPages(authToken, env.domain, u.toString(), maxPages);
}

async function listGlobalForAccounts(
  authToken: string,
  accountIdSet: Set<string>,
  minDateIso: string,
  maxPages: number
): Promise<PowensTransaction[]> {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing.");
  const u = new URL(`https://${env.domain}/2.0/users/me/transactions`);
  u.searchParams.set("limit", "1000");
  u.searchParams.set("all", "");
  u.searchParams.set("min_date", minDateIso);
  const all = await fetchTransactionPages(authToken, env.domain, u.toString(), maxPages);
  return all.filter((t) => accountIdSet.has(String(t.id_account)));
}

/**
 * Agrège les transactions pour plusieurs comptes (dédoublonnage par `id`).
 * - Appels par compte + pagination `_links.next`.
 * - Si aucune ligne : repli sur `/users/me/transactions` filtré sur ces comptes (pagination relationnelle Powens).
 */
export async function powensListTransactionsForAccounts(
  authToken: string,
  accountIds: number[],
  opts?: { limit?: number; minDate?: string; maxPagesPerSource?: number }
): Promise<PowensTransaction[]> {
  const minDateIso = opts?.minDate?.trim() || powensDefaultTransactionMinDateIso();
  const maxPages = Math.min(20, Math.max(1, Number(opts?.maxPagesPerSource ?? 10)));
  const accountIdSet = new Set(accountIds.map(String));
  const byId = new Map<number, PowensTransaction>();

  for (const accountId of accountIds) {
    const chunk = await listForOneAccount(authToken, accountId, minDateIso, maxPages);
    for (const t of chunk) {
      if (!t.deleted) byId.set(t.id, t);
    }
  }

  if (byId.size === 0 && accountIds.length > 0) {
    const fallback = await listGlobalForAccounts(authToken, accountIdSet, minDateIso, maxPages);
    for (const t of fallback) {
      if (!t.deleted) byId.set(t.id, t);
    }
  }

  return Array.from(byId.values());
}
