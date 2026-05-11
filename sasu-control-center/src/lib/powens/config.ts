import "server-only";

function env(name: string): string | null {
  const v = process.env[name];
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function normalizeDomain(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^https?:\/\//i, "");
  // Keep host only (remove any accidental path/query like "/2.0")
  t = t.split("/")[0] ?? "";
  t = t.split("?")[0] ?? "";
  t = t.replace(/\/+$/g, "");
  return t;
}

export type PowensEnv = {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Powens (Budget Insight) — utilisé pour **Revolut personnel** (webview connect).
 * Variables serveur :
 * - POWENS_DOMAIN (ex: "mydomain.biapi.pro")
 * - POWENS_CLIENT_ID
 * - POWENS_CLIENT_SECRET
 * - POWENS_REDIRECT_URI (whitelist dans la console Powens, ex. …/api/powens/callback)
 */
export function getPowensEnv(): PowensEnv | null {
  const domainRaw = env("POWENS_DOMAIN");
  const clientId = env("POWENS_CLIENT_ID");
  const clientSecret = env("POWENS_CLIENT_SECRET");
  const redirectUri = env("POWENS_REDIRECT_URI");
  if (!domainRaw || !clientId || !clientSecret || !redirectUri) return null;
  const domain = normalizeDomain(domainRaw);
  if (!domain) return null;
  return { domain, clientId, clientSecret, redirectUri };
}

