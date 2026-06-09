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

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Configuration OAuth Google lue depuis l'environnement (server-only). */
export function getGmailOAuthConfig(): GmailOAuthConfig | null {
  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getEnv("GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGmailConfigured(): boolean {
  return getGmailOAuthConfig() !== null;
}
