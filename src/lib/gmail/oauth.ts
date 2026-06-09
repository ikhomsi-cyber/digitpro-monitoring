import "server-only";

import { google, type Auth } from "googleapis";
import { GMAIL_SCOPE, getGmailOAuthConfig } from "@/lib/gmail/config";

/** Crée un client OAuth2 Google à partir de la configuration d'environnement. */
export function createGmailOAuthClient(): Auth.OAuth2Client {
  const config = getGmailOAuthConfig();
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
export function buildGmailConsentUrl(state: string): string {
  const client = createGmailOAuthClient();
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

/** Échange le code d'autorisation reçu sur le callback contre des jetons. */
export async function exchangeGmailCode(code: string): Promise<GmailTokenExchange> {
  const client = createGmailOAuthClient();
  const { tokens } = await client.getToken(code);
  return {
    refreshToken: tokens.refresh_token ?? null,
    accessToken: tokens.access_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
    scope: tokens.scope ?? null
  };
}
