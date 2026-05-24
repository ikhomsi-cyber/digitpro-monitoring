/**
 * Diagnostic de configuration Powens (sans exposer les secrets).
 */

import {
  isPowensCloudConfigured,
  powensApiBaseUrl,
  powensBiDomainOrigin
} from "@/lib/powens/cloud-api";
import {
  powensAccountFilterForAxis,
  powensDefaultCompanyLabel,
  powensPersonalSyncUiEnabled,
  powensPrimaryImportAxis,
  powensTruthyEnvFlag
} from "@/lib/powens/config";

export type PowensEnvDiagnostics = {
  ok: boolean;
  /** Prêt pour synchro cloud (domaine + BI ou legacy). */
  cloudSyncReady: boolean;
  authMode: "budget_insight" | "legacy_platform" | "incomplete";
  /** Domaine Budget Insight sans suffixe `/2.0` (aligné sur une valeur type POWENS_DOMAIN). */
  resolvedApiBaseUrl: string | null;
  /** URL réelle utilisée pour les appels REST (`auth/init`, transactions, …). Souvent `{resolvedApiBaseUrl}/2.0`. */
  restApiBaseUrl: string | null;
  resolvedApiHostname: string | null;
  /** Paramètre `domain` utilisé dans la webview (hostname *.biapi.pro). */
  webviewDomainHostname: string | null;
  /** Axe du bouton principal d’import (`POWENS_IMPORT_SCOPE`). */
  primaryImportAxis: "pro" | "personal";
  /** Afficher le second bouton « perso » sur le dashboard. */
  personalSyncButton: boolean;
  /** Libellés company utilisés pour les imports (extrait env). */
  importLabels: { primaryDefault: string; personalDefault: string };
  /** Nombre d’ids dans les filtres par compte (optionnel). */
  accountIdFilters: { pro: number; personal: number };
  variables: {
    POWENS_DOMAIN: boolean;
    POWENS_API_BASE_URL: boolean;
    POWENS_CLIENT_ID: boolean;
    POWENS_CLIENT_SECRET: boolean;
    POWENS_PLATFORM_BEARER_TOKEN: boolean;
    POWENS_REDIRECT_URI: boolean;
    POWENS_WEBVIEW_LANG: boolean;
    POWENS_COMPANY_LABEL: boolean;
    POWENS_IMPORT_SCOPE: boolean;
    POWENS_SYNC_PERSONAL: boolean;
    POWENS_PERSONAL_COMPANY_LABEL: boolean;
    POWENS_PRO_ACCOUNT_IDS: boolean;
    POWENS_PERSONAL_ACCOUNT_IDS: boolean;
    POWENS_TEST_AUTH_TOKEN: boolean;
    NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL: boolean;
    NEXT_PUBLIC_POWENS_WEBVIEW_NEW_TAB: boolean;
  };
  /** Masqué : uniquement longueur pour savoir si une valeur est présente. */
  secretsLengths: {
    POWENS_CLIENT_SECRET_chars: number;
    POWENS_PLATFORM_BEARER_TOKEN_chars: number;
    POWENS_TEST_AUTH_TOKEN_chars: number;
  };
  redirectUriParsed: { scheme: string | null; host: string | null; path: string | null } | null;
  warnings: string[];
  hints: string[];
};

function truthyEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function parseRedirectUri(raw: string | undefined): PowensEnvDiagnostics["redirectUriParsed"] {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return {
      scheme: u.protocol.replace(":", "") || null,
      host: u.hostname || null,
      path: u.pathname || null
    };
  } catch {
    return null;
  }
}

function hostnameFromUrl(base: string): string | null {
  try {
    return new URL(base.includes("://") ? base : `https://${base}`).hostname;
  } catch {
    return null;
  }
}

/**
 * Collecte l’état des variables Powens (valeurs sensibles jamais renvoyées en clair).
 */
export function getPowensEnvDiagnostics(): PowensEnvDiagnostics {
  const domainRaw = process.env.POWENS_DOMAIN?.trim();
  const apiBaseRaw = process.env.POWENS_API_BASE_URL?.trim();
  const clientId = truthyEnv("POWENS_CLIENT_ID");
  const clientSecret = truthyEnv("POWENS_CLIENT_SECRET");
  const platform = truthyEnv("POWENS_PLATFORM_BEARER_TOKEN");
  const redirect = process.env.POWENS_REDIRECT_URI?.trim();

  const warnings: string[] = [];
  const hints: string[] = [];

  let resolvedApiBaseUrl: string | null = null;
  let restApiBaseUrl: string | null = null;
  try {
    resolvedApiBaseUrl = powensBiDomainOrigin();
    restApiBaseUrl = powensApiBaseUrl();
  } catch (e) {
    warnings.push(
      e instanceof Error ? e.message : "Impossible de déduire l’URL Powens (powensBiDomainOrigin)."
    );
  }

  const resolvedApiHostname = resolvedApiBaseUrl ? hostnameFromUrl(resolvedApiBaseUrl) : null;
  const webviewDomainHostname = resolvedApiHostname;

  if (apiBaseRaw) {
    try {
      const h = hostnameFromUrl(apiBaseRaw);
      if (h === "api.powens.com") {
        warnings.push(
          "POWENS_API_BASE_URL pointe vers api.powens.com : souvent ENOTFOUND ou incompatible Budget Insight. Préférez POWENS_DOMAIN=https://votre-instance.biapi.pro."
        );
      }
    } catch {
      warnings.push("POWENS_API_BASE_URL : format d’URL invalide.");
    }
  }

  if (!domainRaw && !apiBaseRaw) {
    warnings.push("Ni POWENS_DOMAIN ni POWENS_API_BASE_URL : la synchro Powens ne peut pas appeler l’API.");
  }

  let authMode: PowensEnvDiagnostics["authMode"] = "incomplete";
  if (clientId && clientSecret) authMode = "budget_insight";
  else if (platform) authMode = "legacy_platform";

  if (authMode === "budget_insight" && !redirect) {
    warnings.push(
      "POWENS_REDIRECT_URI absent : la webview « Connecter Powens » échouera tant que l’URL exacte n’est pas dans .env et dans la console Powens."
    );
  }

  if (authMode === "legacy_platform") {
    hints.push("Flux legacy : assurez-vous que l’email Supabase est renseigné pour POST /users.");
  }

  const redirectParsed = redirect ? parseRedirectUri(redirect) : null;
  if (redirect && !redirectParsed) {
    warnings.push("POWENS_REDIRECT_URI : impossible de parser comme URL absolue (scheme + host + chemin).");
  }

  const cloudSyncReady = isPowensCloudConfigured();

  if (!cloudSyncReady && !warnings.some((w) => /POWENS_DOMAIN|POWENS_API_BASE_URL|powensApiBaseUrl/i.test(w))) {
    warnings.push(
      "Configuration incomplète pour l’API Powens : renseignez POWENS_DOMAIN (ou POWENS_API_BASE_URL) et soit POWENS_CLIENT_ID + POWENS_CLIENT_SECRET, soit POWENS_PLATFORM_BEARER_TOKEN."
    );
  }

  const tabRaw = process.env.NEXT_PUBLIC_POWENS_WEBVIEW_NEW_TAB?.trim().toLowerCase();

  const primaryImportAxis = powensPrimaryImportAxis();
  const personalSyncButton = powensPersonalSyncUiEnabled();
  const proFilter = powensAccountFilterForAxis("pro");
  const personalFilter = powensAccountFilterForAxis("personal");

  if (personalSyncButton && (personalFilter?.length ?? 0) === 0) {
    hints.push(
      "Double synchro SASU + perso : sans POWENS_PERSONAL_ACCOUNT_IDS, les deux imports lisent les mêmes lignes API ; utilisez des id_account Powens pour séparer les flux ou deux utilisateurs BI distincts."
    );
  }

  return {
    ok: warnings.length === 0 && cloudSyncReady,
    cloudSyncReady,
    authMode,
    resolvedApiBaseUrl,
    restApiBaseUrl,
    resolvedApiHostname,
    webviewDomainHostname,
    primaryImportAxis,
    personalSyncButton,
    importLabels: {
      primaryDefault: powensDefaultCompanyLabel(primaryImportAxis),
      personalDefault: powensDefaultCompanyLabel("personal")
    },
    accountIdFilters: {
      pro: proFilter?.length ?? 0,
      personal: personalFilter?.length ?? 0
    },
    variables: {
      POWENS_DOMAIN: truthyEnv("POWENS_DOMAIN"),
      POWENS_API_BASE_URL: truthyEnv("POWENS_API_BASE_URL"),
      POWENS_CLIENT_ID: clientId,
      POWENS_CLIENT_SECRET: clientSecret,
      POWENS_PLATFORM_BEARER_TOKEN: platform,
      POWENS_REDIRECT_URI: Boolean(redirect),
      POWENS_WEBVIEW_LANG: truthyEnv("POWENS_WEBVIEW_LANG"),
      POWENS_COMPANY_LABEL: truthyEnv("POWENS_COMPANY_LABEL"),
      POWENS_IMPORT_SCOPE: truthyEnv("POWENS_IMPORT_SCOPE"),
      POWENS_SYNC_PERSONAL: powensTruthyEnvFlag(process.env.POWENS_SYNC_PERSONAL),
      POWENS_PERSONAL_COMPANY_LABEL: truthyEnv("POWENS_PERSONAL_COMPANY_LABEL"),
      POWENS_PRO_ACCOUNT_IDS: truthyEnv("POWENS_PRO_ACCOUNT_IDS"),
      POWENS_PERSONAL_ACCOUNT_IDS: truthyEnv("POWENS_PERSONAL_ACCOUNT_IDS"),
      POWENS_TEST_AUTH_TOKEN: truthyEnv("POWENS_TEST_AUTH_TOKEN"),
      NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL: truthyEnv("NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL"),
      NEXT_PUBLIC_POWENS_WEBVIEW_NEW_TAB: tabRaw === "true" || tabRaw === "1"
    },
    secretsLengths: {
      POWENS_CLIENT_SECRET_chars: process.env.POWENS_CLIENT_SECRET?.length ?? 0,
      POWENS_PLATFORM_BEARER_TOKEN_chars: process.env.POWENS_PLATFORM_BEARER_TOKEN?.length ?? 0,
      POWENS_TEST_AUTH_TOKEN_chars: process.env.POWENS_TEST_AUTH_TOKEN?.length ?? 0
    },
    redirectUriParsed: redirectParsed,
    warnings,
    hints
  };
}
