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

/** redirect_uri OAuth : caractère pour caractère comme dans la console Powens (on enlève seulement les espaces). */
function normalizeRedirectUri(raw: string): string {
  return raw.trim();
}

export type PowensEnv = {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Détecte si POWENS_DOMAIN ressemble à l’URL du site (erreur fréquente) plutôt qu’au domaine API Powens.
 * Les appels partent vers `https://${domain}/2.0/...` : si domain = ton Vercel → 404 HTML Next.js.
 */
export function getPowensDomainMisconfigurationMessage(domain: string): string | null {
  const d = domain.toLowerCase();
  const looksLikeOurApp =
    d.includes("vercel.app") ||
    d.includes("netlify.app") ||
    d.includes("localhost") ||
    d.includes("127.0.0.1") ||
    d.endsWith(".pages.dev");
  if (!looksLikeOurApp) return null;
  return [
    "POWENS_DOMAIN pointe vers ton application (ex. Vercel), pas vers l’API Powens / Budget Insight.",
    `Valeur actuelle : « ${domain} ».`,
    "Dans la console Powens, récupère le domaine technique du type « xxx.biapi.pro » (sans https://) et mets-le dans POWENS_DOMAIN sur Vercel."
  ].join(" ");
}

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
  const redirect = normalizeRedirectUri(redirectUri);
  if (!redirect) return null;
  return { domain, clientId, clientSecret, redirectUri: redirect };
}

