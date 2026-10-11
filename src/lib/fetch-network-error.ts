/**
 * Node/undici remonte souvent uniquement « fetch failed » ; la vraie cause est dans error.cause (ECONNREFUSED, ENOTFOUND, etc.).
 */

export function wrapFetchError(urlStr: string, context: string, err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);

  let causeStr = "";
  const c =
    err instanceof Error && "cause" in err ? (err as Error & { cause?: unknown }).cause : undefined;
  if (c instanceof Error) {
    causeStr = ` ${c.message}`;
  } else if (typeof c === "string" && c.length > 0) {
    causeStr = ` ${c}`;
  } else if (c && typeof c === "object" && "code" in c) {
    causeStr = ` code=${String((c as { code?: unknown }).code)}`;
  }

  let host = "";
  try {
    host = new URL(urlStr).hostname;
  } catch {
    host = "(URL invalide)";
  }

  const networkish =
    msg === "fetch failed" ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|CERT_|certificate|SSL|TLS|getaddrinfo/i.test(
      `${msg}${causeStr}`
    );

  let hint = "";
  if (networkish) {
    const dnsFail = /ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(`${msg}${causeStr}`);
    if (host === "api.powens.com" && dnsFail) {
      hint =
        " Sandbox / Budget Insight : api.powens.com ne résout souvent pas en DNS. Dans .env.local, supprimez ou commentez POWENS_API_BASE_URL vers api.powens.com et utilisez POWENS_DOMAIN=https://votre-client.biapi.pro — l’app appellera automatiquement …/2.0.";
    } else {
      hint =
        " Vérifiez l’URL dans .env (POWENS_API_BASE_URL, POWENS_DOMAIN), la résolution DNS, pare-feu/VPN, et testez la même URL avec curl depuis la machine qui exécute Next.js (les appels partent du serveur, pas du navigateur).";
    }
  }

  return new Error(`${context} — ${msg}.${causeStr ? ` Détail :${causeStr}.` : ""} Hôte : ${host}.${hint}`);
}

export async function fetchWithNetworkDiagnostics(
  urlStr: string,
  init: RequestInit,
  context: string
): Promise<Response> {
  try {
    const url = new URL(urlStr);
    const powensConfig = process.env.POWENS_API_BASE_URL?.trim() || process.env.POWENS_DOMAIN?.trim();
    const powensHost = powensConfig ? new URL(powensConfig.includes("://") ? powensConfig : `https://${powensConfig}`).hostname : null;
    const permitted = url.hostname === "thirdparty.qonto.com" || url.hostname === "thirdparty-sandbox.staging.qonto.co" ||
      (url.hostname === powensHost && (url.hostname.endsWith(".biapi.pro") || url.hostname === "api.powens.com"));
    if (!permitted || url.protocol !== "https:" || url.username || url.password || url.port) {
      throw new Error("Destination réseau non autorisée.");
    }
    const timeout = AbortSignal.timeout(20_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const result = await fetch(urlStr, { ...init, signal, redirect: "error" });
    if (result.status === 401 || result.status === 403) throw new Error("Accès fournisseur refusé. Reconnexion requise.");
    return result;
  } catch (e) {
    throw wrapFetchError(urlStr, context, e);
  }
}
