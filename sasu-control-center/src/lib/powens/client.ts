import "server-only";

import { getPowensEnv } from "./config";

export type PowensUserToken = { auth_token: string; id_user?: number | null; type?: string | null };

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 2000);
  } catch {
    return "";
  }
}

export async function powensInitUser(): Promise<{ authToken: string; powensUserId: number | null }> {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing (POWENS_DOMAIN/CLIENT_ID/CLIENT_SECRET/REDIRECT_URI).");
  const url = `https://${env.domain}/2.0/auth/init`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.clientId, client_secret: env.clientSecret }),
    cache: "no-store"
  });
  if (!res.ok) {
    const details = await readErrorBody(res);
    throw new Error(`Powens auth/init failed: ${res.status}${details ? ` — ${details}` : ""}`);
  }
  const json = (await res.json()) as PowensUserToken;
  const token = String(json?.auth_token ?? "").trim();
  if (!token) throw new Error("Powens auth/init returned empty auth_token.");
  const idUser = typeof json?.id_user === "number" ? json.id_user : null;
  return { authToken: token, powensUserId: idUser };
}

export async function powensTemporaryCode(authToken: string): Promise<string> {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing.");
  const url = `https://${env.domain}/2.0/auth/token/code?type=singleAccess`;
  const res = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${authToken}` },
    cache: "no-store"
  });
  if (!res.ok) {
    const details = await readErrorBody(res);
    throw new Error(`Powens auth/token/code failed: ${res.status}${details ? ` — ${details}` : ""}`);
  }
  const json = (await res.json()) as { code?: string };
  const code = String(json?.code ?? "").trim();
  if (!code) throw new Error("Powens auth/token/code returned empty code.");
  return code;
}

export function powensConnectWebviewUrl(opts: { code: string }): string {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing.");
  const u = new URL("https://webview.powens.com/connect");
  u.searchParams.set("domain", env.domain);
  u.searchParams.set("client_id", env.clientId);
  u.searchParams.set("redirect_uri", env.redirectUri);
  u.searchParams.set("code", opts.code);
  return u.toString();
}

export type PowensAccount = {
  id: number;
  id_connection?: number | null;
  name?: string | null;
  original_name?: string | null;
  iban?: string | null;
  balance?: number | null;
  currency?: { id?: number; symbol?: string; prefix?: string; code?: string } | null;
  type?: { name?: string; id?: number } | null;
  usage?: string | null;
  disabled?: string | null;
  deleted?: string | null;
};

export async function powensListAccounts(authToken: string): Promise<PowensAccount[]> {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing.");
  const url = `https://${env.domain}/2.0/users/me/accounts?all`;
  const res = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${authToken}` },
    cache: "no-store"
  });
  if (!res.ok) {
    const details = await readErrorBody(res);
    throw new Error(`Powens list accounts failed: ${res.status}${details ? ` — ${details}` : ""}`);
  }
  const json = (await res.json()) as { accounts?: PowensAccount[] };
  return Array.isArray(json?.accounts) ? json.accounts : [];
}

export type PowensTransaction = {
  id: number;
  id_account: number;
  id_connection?: number | null;
  date: string;
  rdate?: string | null;
  wording?: string | null;
  simplified_wording?: string | null;
  original_wording?: string | null;
  value?: number | null;
  active?: boolean | null;
  coming?: boolean | null;
  deleted?: string | null;
  categories?: Array<{ code?: string; parent_code?: string | null }> | null;
};

export async function powensListTransactions(authToken: string, opts?: { limit?: number; minDate?: string }): Promise<PowensTransaction[]> {
  const env = getPowensEnv();
  if (!env) throw new Error("Powens env missing.");
  const limit = Math.min(1000, Math.max(1, Number(opts?.limit ?? 1000)));
  const u = new URL(`https://${env.domain}/2.0/users/me/transactions`);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("all", "");
  if (opts?.minDate) u.searchParams.set("min_date", opts.minDate);
  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${authToken}` },
    cache: "no-store"
  });
  if (!res.ok) {
    const details = await readErrorBody(res);
    throw new Error(`Powens list transactions failed: ${res.status}${details ? ` — ${details}` : ""}`);
  }
  const json = (await res.json()) as { transactions?: PowensTransaction[]; _links?: { next?: { href?: string } } };
  const first = Array.isArray(json?.transactions) ? json.transactions : [];
  // Minimal implementation: one page (limit up to 1000). We can iterate _links.next later if needed.
  return first;
}

