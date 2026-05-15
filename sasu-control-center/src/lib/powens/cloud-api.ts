/**
 * Client HTTP Powens / Budget Insight : POWENS_DOMAIN = racine https://….biapi.pro (sans /2.0) ;
 * les appels REST utilisent automatiquement …/2.0. Ou POWENS_API_BASE_URL complète si votre contrat l’exige.
 */

import { categorizePowensApiTransaction } from "@/lib/bankin/categorize";
import { fetchWithNetworkDiagnostics } from "@/lib/fetch-network-error";
import { sanitizeLatin1HttpValue } from "@/lib/http-latin1";

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Normalise le jeton utilisateur Powens : retire BOM, préfixe `Bearer ` éventuel (évite le double Bearer),
 * puis contrôle Latin-1 pour les en-têtes HTTP.
 */
export function normalizePowensUserBearerToken(raw: string): string {
  let s = raw.replace(/\uFEFF/g, "").trim();
  if (/^bearer\s+/i.test(s)) {
    s = s.replace(/^bearer\s+/i, "").trim();
  }
  return sanitizeLatin1HttpValue(s, "Powens token utilisateur");
}

/** Certaines instances Budget Insight attendent aussi `client_id` en query sur les GET avec jeton utilisateur. */
export function powensAppendOptionalClientIdQuery(urlString: string): string {
  const cid = getEnv("POWENS_CLIENT_ID");
  if (!cid?.trim()) return urlString;
  try {
    const u = new URL(urlString);
    if (!u.searchParams.has("client_id")) {
      u.searchParams.set("client_id", sanitizeLatin1HttpValue(cid.trim(), "POWENS_CLIENT_ID"));
    }
    return u.toString();
  } catch {
    return urlString;
  }
}

/** Budget Insight : client_id + client_secret → POST /auth/init. Ancien flux cloud : POWENS_PLATFORM_BEARER_TOKEN + POST /users. */
export function isPowensCloudConfigured(): boolean {
  const base = getEnv("POWENS_API_BASE_URL") || getEnv("POWENS_DOMAIN");
  if (!base) return false;
  const biapi = Boolean(getEnv("POWENS_CLIENT_ID") && getEnv("POWENS_CLIENT_SECRET"));
  const legacyPlatform = Boolean(getEnv("POWENS_PLATFORM_BEARER_TOKEN"));
  return biapi || legacyPlatform;
}

/** Retire un suffixe `/2.0` éventuel (Budget Insight). */
function stripTrailingBiApiV2(url: string): string {
  return url.replace(/\/2\.0\/?$/, "").replace(/\/$/, "");
}

type PowensEndpointResolution =
  | { mode: "domain"; domainOrigin: string }
  | { mode: "explicit"; fullBaseUrl: string };

function resolvePowensEndpoints(): PowensEndpointResolution {
  const explicitRaw = getEnv("POWENS_API_BASE_URL")?.replace(/\/$/, "");
  const domain = getEnv("POWENS_DOMAIN")?.replace(/\/$/, "");

  let explicit = explicitRaw;
  if (explicitRaw && domain) {
    try {
      const host = new URL(explicitRaw.includes("://") ? explicitRaw : `https://${explicitRaw}`).hostname;
      if (host === "api.powens.com") {
        explicit = undefined;
      }
    } catch {
      /* garder explicitRaw */
    }
  }

  if (explicit) {
    return {
      mode: "explicit",
      fullBaseUrl: sanitizeLatin1HttpValue(explicit, "POWENS_API_BASE_URL")
    };
  }
  if (domain) {
    const domainOrigin = stripTrailingBiApiV2(sanitizeLatin1HttpValue(domain, "POWENS_DOMAIN"));
    return { mode: "domain", domainOrigin };
  }
  throw new Error(
    "Powens : renseignez POWENS_DOMAIN (ex. https://votre-client-sandbox.biapi.pro) ou POWENS_API_BASE_URL dans .env.local. " +
      "Ajoutez POWENS_CLIENT_ID + POWENS_CLIENT_SECRET (Budget Insight), ou POWENS_PLATFORM_BEARER_TOKEN (flux POST /users uniquement)."
  );
}

/**
 * Racine du domaine Budget Insight **sans** `/2.0` (affichage / webview `domain=`).
 * Si vous utilisez uniquement POWENS_API_BASE_URL complète, un suffixe `/2.0` y est retiré pour cet affichage.
 */
export function powensBiDomainOrigin(): string {
  const r = resolvePowensEndpoints();
  if (r.mode === "domain") return r.domainOrigin;
  return stripTrailingBiApiV2(r.fullBaseUrl);
}

/**
 * URL de base pour les appels REST (`/auth/init`, `/users/me/transactions`, …).
 * Avec POWENS_DOMAIN → `{origin}/2.0`. Avec POWENS_API_BASE_URL → valeur telle quelle.
 */
export function powensApiBaseUrl(): string {
  const r = resolvePowensEndpoints();
  if (r.mode === "explicit") return r.fullBaseUrl;
  return sanitizeLatin1HttpValue(`${r.domainOrigin}/2.0`, "POWENS_DOMAIN → …/2.0");
}

export function powensPlatformBearer(): string {
  const t = getEnv("POWENS_PLATFORM_BEARER_TOKEN");
  if (!t) {
    throw new Error(
      "POWENS_PLATFORM_BEARER_TOKEN manquant (token plateforme Bearer pour POST /users). Voir .env.example."
    );
  }
  return sanitizeLatin1HttpValue(t, "POWENS_PLATFORM_BEARER_TOKEN");
}

function pickUserId(body: Record<string, unknown>): string | undefined {
  const u = body.user as Record<string, unknown> | undefined;
  const candidates = [body.id_user, body.id, body.user_id, body.userId, u?.id];
  for (const c of candidates) {
    if (c != null && String(c).length > 0) return String(c);
  }
  return undefined;
}

function pickUserToken(body: Record<string, unknown>): string | undefined {
  const candidates = [
    body.auth_token,
    body.token,
    body.access_token,
    body.accessToken,
    (body.data as Record<string, unknown> | undefined)?.token
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return undefined;
}

/**
 * Budget Insight : `POST /2.0/auth/init` avec client_id + client_secret → nouvel utilisateur + `auth_token` + `id_user`.
 * @see https://docs.powens.com/api-reference/overview/authentication.md
 *
 * Flux alternatif (token plateforme) : `POST …/users` + Bearer — uniquement si pas de CLIENT_ID/SECRET.
 */
async function powensBiapiAuthInit(clientId: string, clientSecret: string): Promise<{
  userId: string;
  userToken: string;
  raw: unknown;
}> {
  const base = powensApiBaseUrl();
  const url = `${base}/auth/init`;
  const client_id = sanitizeLatin1HttpValue(clientId, "POWENS_CLIENT_ID");
  const client_secret = sanitizeLatin1HttpValue(clientSecret, "POWENS_CLIENT_SECRET");

  const res = await fetchWithNetworkDiagnostics(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ client_id, client_secret }),
      cache: "no-store"
    },
    "Powens POST /auth/init"
  );
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    throw new Error(`Powens POST /auth/init ${res.status} — ${text.slice(0, 400)}`);
  }
  const body = json as Record<string, unknown>;
  const userId = pickUserId(body);
  const userToken = pickUserToken(body);
  if (!userId || !userToken) {
    throw new Error(
      "Réponse Powens /auth/init inattendue : champs id_user et auth_token attendus. Inspectez la réponse JSON."
    );
  }
  const safeUserId = sanitizeLatin1HttpValue(String(userId), "Powens userId");
  const safeUserToken = sanitizeLatin1HttpValue(String(userToken), "Powens user token");
  return { userId: safeUserId, userToken: safeUserToken, raw: json };
}

async function powensLegacyPostUsers(email: string): Promise<{
  userId: string;
  userToken: string;
  raw: unknown;
}> {
  const base = powensApiBaseUrl();
  const url = `${base}/users`;
  const res = await fetchWithNetworkDiagnostics(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${powensPlatformBearer()}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ email }),
      cache: "no-store"
    },
    "Powens POST /users"
  );
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    throw new Error(`Powens POST /users ${res.status} — ${text.slice(0, 400)}`);
  }
  const body = json as Record<string, unknown>;
  const userId = pickUserId(body);
  const userToken = pickUserToken(body);
  if (!userId || !userToken) {
    throw new Error(
      "Réponse Powens /users inattendue : impossible de lire id utilisateur et token. Inspectez la réponse API."
    );
  }
  const safeUserId = sanitizeLatin1HttpValue(String(userId), "Powens userId");
  const safeUserToken = sanitizeLatin1HttpValue(String(userToken), "Powens user token");
  return { userId: safeUserId, userToken: safeUserToken, raw: json };
}

export async function powensCloudCreateUser(email: string): Promise<{
  userId: string;
  userToken: string;
  raw: unknown;
}> {
  const cid = getEnv("POWENS_CLIENT_ID");
  const csec = getEnv("POWENS_CLIENT_SECRET");
  if (cid && csec) {
    return powensBiapiAuthInit(cid, csec);
  }
  const emailTrim = (email ?? "").trim();
  if (!emailTrim) {
    throw new Error(
      "Powens : avec le flux Budget Insight, renseignez POWENS_CLIENT_ID et POWENS_CLIENT_SECRET (POST /auth/init). " +
        "Sinon fournissez l’email utilisateur et POWENS_PLATFORM_BEARER_TOKEN pour POST /users."
    );
  }
  return powensLegacyPostUsers(emailTrim);
}

/** `GET /users/me` — renvoie l’id utilisateur lié au Bearer (doc Powens : userId = entier ou `"me"`). */
async function powensResolveUserIdFromMeEndpoint(userBearer: string): Promise<string | null> {
  const bearer = normalizePowensUserBearerToken(userBearer);
  const base = powensApiBaseUrl();
  const url = powensAppendOptionalClientIdQuery(`${base}/users/me`);
  const res = await fetchWithNetworkDiagnostics(
    url,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json"
      },
      cache: "no-store"
    },
    "Powens GET /users/me"
  );
  const text = await res.text();
  if (!res.ok) return null;
  try {
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    const nested = json.user as Record<string, unknown> | undefined;
    const id = json.id ?? nested?.id ?? json.user_id ?? json.id_user;
    if (id != null && String(id).trim() !== "") return String(id).trim();
  } catch {
    return null;
  }
  return null;
}

function asArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (!v || typeof v !== "object") return [];
  const o = v as Record<string, unknown>;

  const direct = o.transactions ?? o.items ?? o.results;
  if (Array.isArray(direct)) return direct as T[];

  const topData = o.data;
  if (Array.isArray(topData)) return topData as T[];
  if (topData && typeof topData === "object") {
    const d = topData as Record<string, unknown>;
    const nested = d.transactions ?? d.items ?? d.results;
    if (Array.isArray(nested)) return nested as T[];
  }

  return [];
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
}

export type PowensImportRow = {
  date: string;
  label: string;
  category: string;
  amount: number;
  balance: number | null;
  company: string;
  scope?: "pro" | "personal";
  dedupeKey?: string;
  /** `id_account` Powens (pour filtrage SASU / perso par compte). */
  powensAccountId?: number;
};

function mapOneTx(raw: Record<string, unknown>, company: string, scope: "pro" | "personal"): PowensImportRow | null {
  const id = str(raw.id ?? raw.transaction_id ?? raw.uuid);
  const dateRaw = str(raw.date ?? raw.operation_date ?? raw.booking_date ?? raw.value_date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return null;
  const amount =
    num(raw.amount) ??
    num(raw.value) ??
    (raw.amount != null ? Number(raw.amount) : num(raw.original_amount));
  if (amount == null || !Number.isFinite(amount)) return null;
  const label =
    str(raw.wording ?? raw.simplified_wording ?? raw.original_wording ?? raw.description ?? raw.title) ||
    str(raw.merchant_name) ||
    "Opération Powens";
  const category = categorizePowensApiTransaction(raw, label, amount);
  const balance = num(raw.balance ?? raw.account_balance);
  const accountId = num(raw.id_account);
  return {
    date: dateRaw,
    label,
    category: category.trim() ? category : "Powens",
    amount,
    balance: balance != null ? balance : null,
    company,
    scope,
    dedupeKey: id ? `powens:${scope}:${id}` : undefined,
    powensAccountId: accountId != null ? accountId : undefined
  };
}

/**
 * Récupère les transactions avec le **token utilisateur** Powens (pas le token plateforme).
 * Doc : `GET /2.0/users/{userId}/transactions?limit=…` avec userId numérique ou `me` ; **limit** obligatoire (max 1000).
 */
export async function powensCloudFetchTransactions(
  userBearer: string,
  opts: {
    company: string;
    scope: "pro" | "personal";
    powensUserId?: string | null;
    /** Si défini, ne garde que les lignes dont `id_account` est dans la liste. */
    filterAccountIds?: number[] | null;
  }
): Promise<PowensImportRow[]> {
  const bearer = normalizePowensUserBearerToken(userBearer);
  const base = powensApiBaseUrl();
  const limitQs = "limit=1000";

  let effectiveUserId = opts.powensUserId?.trim() ?? null;
  if (!effectiveUserId) {
    effectiveUserId = await powensResolveUserIdFromMeEndpoint(userBearer);
  }

  const paths: string[] = [];
  if (effectiveUserId) {
    paths.push(`/users/${encodeURIComponent(effectiveUserId)}/transactions?${limitQs}`);
  }
  paths.push(`/users/me/transactions?${limitQs}`);

  let lastFailure = "";
  let saw401Unauthorized = false;

  for (const p of paths) {
    const url = powensAppendOptionalClientIdQuery(`${base}${p}`);
    const res = await fetchWithNetworkDiagnostics(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: "application/json"
        },
        cache: "no-store"
      },
      `Powens GET ${p}`
    );
    const text = await res.text();

    if (res.status === 409) {
      throw new Error(
        "Powens 409 : aucun compte bancaire activé ou conflit de consentement — terminez la webview Powens et activez au moins un compte. " +
          `Réponse : ${text.slice(0, 480)}`
      );
    }

    if (!res.ok) {
      if (res.status === 401) {
        try {
          const j = JSON.parse(text) as { code?: string };
          if (j.code === "unauthorized") saw401Unauthorized = true;
        } catch {
          if (/unauthorized/i.test(text)) saw401Unauthorized = true;
        }
      }
      lastFailure = `${p.split("?")[0]} → HTTP ${res.status}: ${text.slice(0, 240)}`;
      continue;
    }
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : [];
    } catch {
      lastFailure = `${p.split("?")[0]} → JSON invalide: ${text.slice(0, 200)}`;
      continue;
    }
    const list = asArray<Record<string, unknown>>(json);
    let out: PowensImportRow[] = [];
    for (const row of list) {
      const m = mapOneTx(row, opts.company, opts.scope);
      if (m) out.push(m);
    }
    if (opts.filterAccountIds?.length) {
      const allow = new Set(opts.filterAccountIds);
      out = out.filter((r) => r.powensAccountId != null && allow.has(r.powensAccountId));
    }
    if (out.length || list.length === 0) return out;
    lastFailure = `${p.split("?")[0]} → HTTP 200 mais aucune ligne exploitable (${list.length} objet(s) dans la réponse)`;
  }

  if (saw401Unauthorized) {
    throw new Error(
      "Powens 401 unauthorized (« required authorization parameter » / jeton refusé). Vérifications : " +
        "(1) utilisez uniquement la valeur `auth_token` renvoyée par POST /auth/init (pas le client_secret, pas un code webview) ; " +
        "(2) dans curl, `-H \"Authorization: Bearer …\"` sans répéter le mot Bearer dans la valeur du token ; " +
        "(3) même domaine Budget Insight que celui du jeton (`POWENS_DOMAIN` / `POWENS_API_BASE_URL`) ; " +
        "(4) jeton permanent non expiré / non révoqué — refaites « Connecter Powens » ou un nouvel auth/init ; " +
        "(5) `POWENS_CLIENT_ID` est bien ajouté en query si votre console l’exige. " +
        `Dernier échec : ${lastFailure}`
    );
  }

  throw new Error(
    "Powens : impossible de lister les transactions via les endpoints documentés " +
      "(`GET /users/{id}/transactions` ou `GET /users/me/transactions`, avec `limit=1000`). " +
      "Vérifiez POWENS_DOMAIN / POWENS_API_BASE_URL (même domaine que le jeton), que le jeton est un **auth_token utilisateur**, " +
      "et que des comptes bancaires sont activés (webview). " +
      "Si besoin, passez explicitement `id_user` (réponse `auth/init`). " +
      (lastFailure ? `Dernier échec : ${lastFailure}` : "")
  );
}
