/**
 * Connexion bancaire Powens : webview officielle (sans SDK npm).
 * @see https://docs.powens.com/documentation/integration-guides/quick-start/add-a-first-user-and-connection
 */

import {
  powensApiBaseUrl,
  normalizePowensUserBearerToken,
  powensAppendOptionalClientIdQuery,
  powensBiDomainOrigin
} from "@/lib/powens/cloud-api";
import { fetchWithNetworkDiagnostics } from "@/lib/fetch-network-error";
import { sanitizeLatin1HttpValue } from "@/lib/http-latin1";

function domainHostnameFromEnv(): string {
  try {
    const origin = powensBiDomainOrigin();
    return new URL(origin.includes("://") ? origin : `https://${origin}`).hostname;
  } catch {
    throw new Error(
      "Powens webview : renseignez POWENS_DOMAIN (ex. https://xxx.biapi.pro) ou POWENS_API_BASE_URL pour dériver le paramètre « domain »."
    );
  }
}

/**
 * Code temporaire pour ouvrir la webview (ne pas exposer le token permanent dans l’URL).
 * Doc : GET /2.0/auth/token/code avec Bearer = auth_token permanent ; type webview souvent singleAccess.
 */
export async function powensFetchTemporaryConnectCode(permanentUserToken: string): Promise<string> {
  const base = powensApiBaseUrl();
  const bearer = normalizePowensUserBearerToken(permanentUserToken);

  async function tryFetch(params: Record<string, string>): Promise<Response> {
    const url = new URL(`${base}/auth/token/code`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const urlFinal = powensAppendOptionalClientIdQuery(url.toString());
    return fetchWithNetworkDiagnostics(
      urlFinal,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: "application/json"
        },
        cache: "no-store"
      },
      "Powens GET /auth/token/code"
    );
  }

  /** Doc quick-start : GET sans `type` ; sinon singleAccess (webview) puis requestAccess. */
  const attempts: Record<string, string>[] = [{}, { type: "singleAccess" }, { type: "requestAccess" }];
  let res: Response | null = null;
  let text = "";
  for (const params of attempts) {
    const r = await tryFetch(params);
    text = await r.text();
    res = r;
    if (r.ok) break;
  }

  let json: Record<string, unknown>;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Powens /auth/token/code : réponse non JSON (${res?.status}) — ${text.slice(0, 300)}`);
  }

  if (!res?.ok) {
    throw new Error(`Powens GET /auth/token/code ${res?.status ?? "?"} — ${text.slice(0, 400)}`);
  }

  const code = json.code;
  if (typeof code !== "string" || !code.length) {
    throw new Error(
      "Réponse Powens /auth/token/code sans champ « code ». Vérifiez les droits du token utilisateur."
    );
  }
  return code;
}

const WEBVIEW_LANG_CODES = new Set(["en", "fr", "de", "nl", "pt", "it", "es"]);

/** URL https://webview.powens.com/{lang}/connect?… (flux « add connection »). */
export function buildPowensConnectWebviewUrl(opts: {
  domainHostname: string;
  clientId: string;
  redirectUri: string;
  temporaryCode: string;
  /** en | fr | de | nl | pt | it | es — sinon `/connect` et redirection auto côté Powens. */
  lang?: string;
}): string {
  const lang =
    opts.lang && WEBVIEW_LANG_CODES.has(opts.lang.toLowerCase())
      ? opts.lang.toLowerCase()
      : undefined;
  const path = lang ? `https://webview.powens.com/${lang}/connect` : "https://webview.powens.com/connect";
  const u = new URL(path);
  u.searchParams.set("domain", sanitizeLatin1HttpValue(opts.domainHostname, "Powens webview domain"));
  u.searchParams.set("client_id", sanitizeLatin1HttpValue(opts.clientId, "POWENS_CLIENT_ID"));
  u.searchParams.set("redirect_uri", sanitizeLatin1HttpValue(opts.redirectUri, "POWENS_REDIRECT_URI"));
  u.searchParams.set("code", sanitizeLatin1HttpValue(opts.temporaryCode, "Powens temporary code"));
  return u.toString();
}

export function powensWebviewDomainHostname(): string {
  return domainHostnameFromEnv();
}
