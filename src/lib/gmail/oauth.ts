import "server-only";

import { google, type Auth } from "googleapis";
import { GMAIL_SCOPE, getGmailOAuthConfig } from "@/lib/gmail/config";

/**
 * Crée un client OAuth2 Google. `redirectUri` (dérivé de l'origine de la requête) prime
 * sur `GOOGLE_REDIRECT_URI` afin que le callback suive le domaine réel (prod vs local).
 */
export function createGmailOAuthClient(redirectUri?: string): Auth.OAuth2Client {
  const config = getGmailOAuthConfig(redirectUri);
  if (!config) {
    throw new Error(
      "Gmail non configuré : définissez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI. Voir .env.example."
    );
  }
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

/**
 * URL de consentement Google. `access_type=offline` + `prompt=consent` garantissent
 * la délivrance d'un refresh_token réutilisable (récupération manuelle ultérieure).
 */
export function buildGmailConsentUrl(state: string, redirectUri?: string): string {
  const client = createGmailOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [GMAIL_SCOPE],
    state
  });
}

export type GmailTokenExchange = {
  refreshToken: string | null;
  accessToken: string | null;
  expiryDate: number | null;
  scope: string | null;
};

/**
 * Échange le code d'autorisation contre des jetons. `redirectUri` doit être identique
 * à celui utilisé pour générer l'URL de consentement (sinon Google rejette l'échange).
 */
export async function exchangeGmailCode(code: string, redirectUri?: string): Promise<GmailTokenExchange> {
  const client = createGmailOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  return {
    refreshToken: tokens.refresh_token ?? null,
    accessToken: tokens.access_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
    scope: tokens.scope ?? null
  };
}
