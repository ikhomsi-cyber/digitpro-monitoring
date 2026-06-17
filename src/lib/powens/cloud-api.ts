/**
 * Client HTTP Powens / Budget Insight : POWENS_DOMAIN = racine https://….biapi.pro (sans /2.0) ;
 * les appels REST utilisent automatiquement …/2.0. Ou POWENS_API_BASE_URL complète si votre contrat l’exige.
 */

import { categorizePowensApiTransaction } from "@/lib/bankin/categorize";
import {
  isNearDuplicateCardPayment,
  POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW
} from "@/lib/ndf-digitpro";
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

function ensureHttpUrl(raw: string, label: string): string {
  const value = raw.trim().replace(/\/$/, "");
  const withProtocol = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(withProtocol).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${label} : URL invalide. Utilisez par exemple https://votre-instance.biapi.pro.`);
  }
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
      fullBaseUrl: sanitizeLatin1HttpValue(ensureHttpUrl(explicit, "POWENS_API_BASE_URL"), "POWENS_API_BASE_URL")
    };
  }
  if (domain) {
    const domainOrigin = stripTrailingBiApiV2(
      sanitizeLatin1HttpValue(ensureHttpUrl(domain, "POWENS_DOMAIN"), "POWENS_DOMAIN")
    );
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

  const direct = o.transactions ?? o.accounts ?? o.items ?? o.results;
  if (Array.isArray(direct)) return direct as T[];

  const topData = o.data;
  if (Array.isArray(topData)) return topData as T[];
  if (topData && typeof topData === "object") {
    const d = topData as Record<string, unknown>;
    const nested = d.transactions ?? d.accounts ?? d.items ?? d.results;
    if (Array.isArray(nested)) return nested as T[];
  }

  return [];
}

function powensErrorCode(text: string): string | null {
  try {
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    const code = json.code;
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
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
  bankName?: string | null;
  scope?: "pro" | "personal";
  dedupeKey?: string;
  /** `id_account` Powens (pour filtrage SASU / perso par compte). */
  powensAccountId?: number;
};

const POWENS_TYPE_LABEL: Record<string, string> = {
  deferred_card: "Carte différée",
  summary_card: "Récap carte",
  order: "Ordre",
  payment: "Paiement",
  withdrawal: "Retrait",
  check: "Chèque",
  deposit: "Dépôt",
  payback: "Remboursement",
  refund: "Remboursement",
  loan_repayment: "Remboursement prêt",
  bank: "Frais bancaires",
  fee: "Commission",
  market_order: "Ordre boursier",
  market_fee: "Frais bourse",
  arbitrage: "Arbitrage",
  profit: "Revenu",
  payout: "Versement",
  card: "Carte"
};

function isoDatePart(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const part = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

/** Date analytique : pour les opérations `coming` (autorisées / en cours), privilégie rdate puis application_date. */
function resolvePowensTxDate(raw: Record<string, unknown>): string | null {
  const coming = raw.coming === true;
  const keys = coming
    ? ([
        "rdate",
        "application_date",
        "date",
        "vdate",
        "datetime",
        "vdatetime",
        "rdatetime",
        "operation_date",
        "booking_date",
        "value_date",
        "bdate"
      ] as const)
    : ([
        "date",
        "application_date",
        "vdate",
        "rdate",
        "datetime",
        "vdatetime",
        "rdatetime",
        "operation_date",
        "booking_date",
        "value_date",
        "bdate"
      ] as const);

  for (const key of keys) {
    const d = isoDatePart(raw[key]);
    if (d) return d;
  }
  return null;
}

function decoratePowensLabel(raw: Record<string, unknown>, baseLabel: string): string {
  const txType = str(raw.type);
  if (raw.coming === true) {
    return `[En cours] ${baseLabel}`;
  }
  if (txType && txType !== "unknown" && txType !== "transfer" && txType !== "card") {
    const typeLabel = POWENS_TYPE_LABEL[txType] ?? txType.replace(/_/g, " ");
    return `[${typeLabel}] ${baseLabel}`;
  }
  return baseLabel;
}

function mapOneTx(raw: Record<string, unknown>, company: string, scope: "pro" | "personal"): PowensImportRow | null {
  const id = str(raw.id ?? raw.transaction_id ?? raw.uuid);
  const dateRaw = resolvePowensTxDate(raw);
  if (!dateRaw) return null;

  const amount =
    num(raw.value) ??
    num(raw.gross_value) ??
    num(raw.amount) ??
    num(raw.original_value) ??
    (raw.amount != null ? Number(raw.amount) : null);
  if (amount == null || !Number.isFinite(amount)) return null;

  const baseLabel =
    str(raw.wording ?? raw.simplified_wording ?? raw.original_wording ?? raw.description ?? raw.title) ||
    str(raw.merchant_name) ||
    str((raw.counterparty as Record<string, unknown> | undefined)?.label) ||
    "Opération Powens";
  const label = decoratePowensLabel(raw, baseLabel);
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

function pickPaginationNextUrl(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const links = (json as Record<string, unknown>)._links;
  if (!links || typeof links !== "object") return null;
  const next = (links as Record<string, unknown>).next;
  if (typeof next === "string" && next.trim()) return next.trim();
  if (next && typeof next === "object") {
    const href = (next as Record<string, unknown>).href;
    if (typeof href === "string" && href.trim()) return href.trim();
  }
  return null;
}

function powensTxListKey(raw: Record<string, unknown>): string {
  const id = str(raw.id ?? raw.transaction_id ?? raw.uuid);
  if (id) return `id:${id}`;
  const accountId = num(raw.id_account);
  const date = resolvePowensTxDate(raw) ?? "";
  const amount = num(raw.value) ?? num(raw.amount) ?? 0;
  const label = str(raw.wording ?? raw.simplified_wording ?? raw.original_wording);
  return `fallback:${accountId ?? ""}:${date}:${amount}:${label}`;
}

function mergePowensRawTransactions(lists: readonly Record<string, unknown>[][]): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const list of lists) {
    for (const row of list) {
      byKey.set(powensTxListKey(row), row);
    }
  }
  return dropPowensComingSettledDuplicates([...byKey.values()]);
}

function powensRawBaseLabel(raw: Record<string, unknown>): string {
  return (
    str(raw.wording ?? raw.simplified_wording ?? raw.original_wording ?? raw.description ?? raw.title) ||
    str(raw.merchant_name) ||
    str((raw.counterparty as Record<string, unknown> | undefined)?.label) ||
    ""
  );
}

function powensRawAmount(raw: Record<string, unknown>): number | null {
  return (
    num(raw.value) ??
    num(raw.gross_value) ??
    num(raw.amount) ??
    num(raw.original_value) ??
    (raw.amount != null ? Number(raw.amount) : null)
  );
}

/** Ignore les autorisations `coming` quand le débit comptabilisé est déjà dans le lot. */
function dropPowensComingSettledDuplicates(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const settled = rows.filter((row) => row.coming !== true);
  const coming = rows.filter((row) => row.coming === true);
  if (!coming.length) return [...rows];

  const keepComing = coming.filter((comingRow) => {
    const cAmount = powensRawAmount(comingRow);
    const cDate = resolvePowensTxDate(comingRow);
    const cLabel = powensRawBaseLabel(comingRow);
    if (cAmount == null || !cDate || !cLabel) return true;

    return !settled.some((settledRow) => {
      const sAmount = powensRawAmount(settledRow);
      const sDate = resolvePowensTxDate(settledRow);
      const sLabel = powensRawBaseLabel(settledRow);
      if (sAmount == null || !sDate || !sLabel) return false;
      if (num(comingRow.id_account) != null && num(settledRow.id_account) != null) {
        if (num(comingRow.id_account) !== num(settledRow.id_account)) return false;
      }
      return isNearDuplicateCardPayment(
        cLabel,
        cAmount,
        cDate,
        sLabel,
        sAmount,
        sDate,
        POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW
      );
    });
  });

  return [...settled, ...keepComing];
}

function pickPowensAccountBankName(raw: Record<string, unknown>): string | null {
  const nestedBank = raw.bank as Record<string, unknown> | undefined;
  const nestedConnector = raw.connector as Record<string, unknown> | undefined;
  const nestedConnection = raw.connection as Record<string, unknown> | undefined;
  const nestedProvider = raw.provider as Record<string, unknown> | undefined;
  const candidates = [
    raw.bank_name,
    raw.bank,
    raw.institution_name,
    raw.institution,
    raw.provider_name,
    raw.provider,
    raw.connector_name,
    raw.name,
    nestedBank?.name,
    nestedBank?.full_name,
    nestedConnector?.name,
    nestedConnection?.name,
    nestedProvider?.name
  ];
  for (const candidate of candidates) {
    const value = str(candidate);
    if (value) return value;
  }
  return null;
}

async function powensFetchAccountsMeta(
  base: string,
  bearer: string,
  effectiveUserId: string | null
): Promise<{ bankNames: Map<number, string>; accountIds: number[] }> {
  const paths: string[] = [];
  if (effectiveUserId) {
    paths.push(`/users/${encodeURIComponent(effectiveUserId)}/accounts?limit=1000`);
  }
  paths.push("/users/me/accounts?limit=1000");

  for (const p of paths) {
    const res = await fetchWithNetworkDiagnostics(
      powensAppendOptionalClientIdQuery(`${base}${p}`),
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
    if (!res.ok) continue;
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : [];
    } catch {
      continue;
    }
    const accounts = asArray<Record<string, unknown>>(json);
    const bankNames = new Map<number, string>();
    const accountIds: number[] = [];
    for (const account of accounts) {
      const id = num(account.id ?? account.id_account);
      if (id == null) continue;
      accountIds.push(id);
      const bankName = pickPowensAccountBankName(account);
      if (bankName) bankNames.set(id, bankName);
    }
    if (accountIds.length) return { bankNames, accountIds };
  }

  return { bankNames: new Map(), accountIds: [] };
}

async function powensFetchTransactionPages(
  startUrl: string,
  bearer: string,
  logLabel: string,
  apiBase: string
): Promise<{ rows: Record<string, unknown>[]; errorCode: string | null; httpStatus: number | null; bodySnippet: string }> {
  const rows: Record<string, unknown>[] = [];
  let url: string | null = startUrl;
  let pages = 0;
  const maxPages = 40;
  let errorCode: string | null = null;
  let httpStatus: number | null = null;
  let bodySnippet = "";

  while (url && pages < maxPages) {
    const res = await fetchWithNetworkDiagnostics(
      url.startsWith("http") ? url : powensAppendOptionalClientIdQuery(url),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: "application/json"
        },
        cache: "no-store"
      },
      `${logLabel} (page ${pages + 1})`
    );
    const text = await res.text();
    httpStatus = res.status;
    bodySnippet = text.slice(0, 480);
    errorCode = powensErrorCode(text);

    if (!res.ok) {
      return { rows, errorCode, httpStatus, bodySnippet };
    }

    let json: unknown;
    try {
      json = text ? JSON.parse(text) : [];
    } catch {
      return { rows, errorCode: "invalid_json", httpStatus, bodySnippet };
    }

    rows.push(...asArray<Record<string, unknown>>(json));
    url = pickPaginationNextUrl(json);
    if (url && !url.startsWith("http")) {
      url = `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
    }
    pages += 1;
  }

  return { rows, errorCode: null, httpStatus: 200, bodySnippet: "" };
}

function mapPowensRawRowsToImport(
  rawRows: readonly Record<string, unknown>[],
  opts: {
    company: string;
    scope: "pro" | "personal";
    accountBankNames: Map<number, string>;
    filterAccountIds?: number[] | null;
  }
): PowensImportRow[] {
  let out: PowensImportRow[] = [];
  for (const row of rawRows) {
    const mapped = mapOneTx(row, opts.company, opts.scope);
    if (mapped?.powensAccountId != null) {
      mapped.bankName = opts.accountBankNames.get(mapped.powensAccountId) ?? pickPowensAccountBankName(row);
    } else if (mapped) {
      mapped.bankName = pickPowensAccountBankName(row);
    }
    if (mapped) out.push(mapped);
  }
  if (opts.filterAccountIds?.length) {
    const allow = new Set(opts.filterAccountIds);
    out = out.filter((r) => r.powensAccountId != null && allow.has(r.powensAccountId));
  }
  return out;
}

/**
 * Récupère les transactions avec le **token utilisateur** Powens (pas le token plateforme).
 * Pagination complète + fetch par compte (cartes / autorisations) ; inclut les opérations `coming` (en cours / autorisées).
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
  const { bankNames: accountBankNames, accountIds } = await powensFetchAccountsMeta(
    base,
    bearer,
    effectiveUserId
  );

  const accountFilter = opts.filterAccountIds?.length ? new Set(opts.filterAccountIds) : null;
  const accountIdsToFetch = accountFilter
    ? accountIds.filter((id) => accountFilter.has(id))
    : accountIds;

  const startPaths: string[] = [];
  if (effectiveUserId) {
    startPaths.push(`${base}/users/${encodeURIComponent(effectiveUserId)}/transactions?${limitQs}`);
  }
  startPaths.push(`${base}/users/me/transactions?${limitQs}`);

  for (const accountId of accountIdsToFetch) {
    if (effectiveUserId) {
      startPaths.push(
        `${base}/users/${encodeURIComponent(effectiveUserId)}/accounts/${accountId}/transactions?${limitQs}`
      );
    }
    startPaths.push(`${base}/users/me/accounts/${accountId}/transactions?${limitQs}`);
  }

  let lastFailure = "";
  let saw401Unauthorized = false;
  let sawNoAccount = false;
  const rawLists: Record<string, unknown>[][] = [];

  for (const startUrl of startPaths) {
    const logPath = startUrl.replace(base, "");
    const pageResult = await powensFetchTransactionPages(
      powensAppendOptionalClientIdQuery(startUrl),
      bearer,
      `Powens GET ${logPath.split("?")[0]}`,
      base
    );

    if (pageResult.errorCode === "noAccount") {
      sawNoAccount = true;
      continue;
    }

    if (pageResult.httpStatus != null && pageResult.httpStatus !== 200) {
      if (pageResult.httpStatus === 401) {
        if (pageResult.errorCode === "unauthorized" || /unauthorized/i.test(pageResult.bodySnippet)) {
          saw401Unauthorized = true;
        }
      }
      lastFailure = `${logPath.split("?")[0]} → HTTP ${pageResult.httpStatus}: ${pageResult.bodySnippet.slice(0, 240)}`;
      continue;
    }

    if (pageResult.errorCode === "invalid_json") {
      lastFailure = `${logPath.split("?")[0]} → JSON invalide: ${pageResult.bodySnippet.slice(0, 200)}`;
      continue;
    }

    if (pageResult.rows.length) {
      rawLists.push(pageResult.rows);
    }
  }

  if (rawLists.length) {
    const mergedRaw = mergePowensRawTransactions(rawLists);
    const out = mapPowensRawRowsToImport(mergedRaw, {
      company: opts.company,
      scope: opts.scope,
      accountBankNames,
      filterAccountIds: opts.filterAccountIds
    });
    if (out.length || mergedRaw.length === 0) return out;
    lastFailure = `HTTP 200 mais aucune ligne exploitable (${mergedRaw.length} objet(s) bruts)`;
  }

  if (sawNoAccount && !rawLists.length) {
    throw new Error(
      "Powens : aucun compte bancaire n’est rattaché à cet utilisateur. " +
        "Ouvrez « Connecter Powens », terminez la webview bancaire et cochez au moins un compte à synchroniser, puis relancez la synchronisation. " +
        (effectiveUserId ? `Utilisateur Powens utilisé : ${effectiveUserId}. ` : "")
    );
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
      "(`GET /users/{id}/transactions`, `GET /users/me/transactions`, pagination `limit=1000`, fetch par compte). " +
      "Vérifiez POWENS_DOMAIN / POWENS_API_BASE_URL (même domaine que le jeton), que le jeton est un **auth_token utilisateur**, " +
      "et que des comptes bancaires sont activés (webview). " +
      (lastFailure ? `Dernier échec : ${lastFailure}` : "")
  );
}
