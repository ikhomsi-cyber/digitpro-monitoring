/** Scope minimal : lecture seule des emails (recherche + contenu). */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Expéditeur et sujet ciblés pour les factures DigitPro émises par Hiway. */
export const HIWAY_INVOICE_SENDER = "noreply@hiway.fr";
/** Préfixe du sujet des emails de facture Hiway (ex. « DigitPro Consulting - Facture F2026-… »). */
export const HIWAY_INVOICE_SUBJECT_PREFIX = "DigitPro Consulting - Facture F";

/** Requête Gmail (`q`) — recherche large, filtre précis sur le préfixe du sujet ensuite. */
export function hiwayInvoiceGmailQuery(): string {
  return `from:${HIWAY_INVOICE_SENDER} subject:(DigitPro Consulting Facture)`;
}

export function isHiwayInvoiceSubject(subject: string): boolean {
  const normalized = subject.trim();
  return (
    normalized.startsWith(HIWAY_INVOICE_SUBJECT_PREFIX) ||
    normalized.startsWith("DigitPro Consulting - Facture")
  );
}

/** Fenêtre de recherche Gmail pour les prélèvements Qonto (aujourd'hui inclus + 10 jours précédents). */
export const QONTO_DEBIT_GMAIL_LOOKBACK_DAYS = 10;

function qontoDebitGmailDateWindow(): string {
  return `newer_than:${QONTO_DEBIT_GMAIL_LOOKBACK_DAYS}d`;
}

/** Requêtes Gmail pour les rappels de prélèvement Qonto (essai successif, fenêtre récente). */
export function qontoDebitGmailQueries(): string[] {
  const window = qontoDebitGmailDateWindow();
  return [
    `from:qonto debitera compte ${window}`,
    `debitera votre compte ${window}`,
    `débitera votre compte ${window}`,
    `subject:debitera subject:compte ${window}`
  ];
}

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  /** Optionnel : requis pour le consentement/échange, inutile pour le rafraîchissement de jeton. */
  redirectUri?: string;
};

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Origine publique de la requête courante (gère le proxy Vercel).
 * Sert à construire un `redirect_uri` qui suit le domaine réel (prod vs local)
 * au lieu d'un `GOOGLE_REDIRECT_URI` figé sur localhost.
 */
export function resolveRequestOrigin(headerList: { get(name: string): string | null }): string | null {
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost || headerList.get("host");
  if (!host) return null;
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** `redirect_uri` OAuth pour une origine donnée (doit être déclarée dans la console Google). */
export function gmailRedirectUriForOrigin(origin: string | null | undefined): string | null {
  if (origin) return `${origin.replace(/\/$/, "")}/api/gmail/callback`;
  return getEnv("GOOGLE_REDIRECT_URI") ?? null;
}

/**
 * Configuration OAuth Google. `redirectUriOverride` (dérivé de l'origine de la requête)
 * prime sur `GOOGLE_REDIRECT_URI` pour fonctionner en production sans variable figée.
 */
export function getGmailOAuthConfig(redirectUriOverride?: string): GmailOAuthConfig | null {
  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const redirectUri = redirectUriOverride?.trim() || getEnv("GOOGLE_REDIRECT_URI");
  return { clientId, clientSecret, redirectUri };
}

/** Gmail est configuré dès que l'app cliente OAuth est connue (le redirect_uri peut être dynamique). */
export function isGmailConfigured(): boolean {
  return Boolean(getEnv("GOOGLE_CLIENT_ID") && getEnv("GOOGLE_CLIENT_SECRET"));
}
