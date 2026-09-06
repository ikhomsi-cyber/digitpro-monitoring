import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GMAIL_OAUTH_STATE_COOKIE, isValidGmailOAuthState } from "@/lib/gmail/oauth-state";
import { createGmailOAuthClient, exchangeGmailCode } from "@/lib/gmail/oauth";
import { gmailRedirectUriForOrigin, resolveRequestOrigin } from "@/lib/gmail/config";
import { fetchGmailAddress } from "@/lib/gmail/fetch-invoices";
import { saveGmailToken } from "@/lib/gmail/tokens";

/**
 * Redirection OAuth Google après consentement Gmail (lecture seule).
 * Déclarez cette URL exacte comme « URI de redirection autorisé » dans la console
 * Google Cloud (GOOGLE_REDIRECT_URI).
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  // Origine réelle (proxy Vercel) : sert au redirect_uri d'échange ET à la redirection finale,
  // pour ne jamais retomber sur localhost en production.
  const origin = resolveRequestOrigin(req.headers) ?? u.origin;
  const redirectUri = gmailRedirectUriForOrigin(origin) ?? undefined;
  const target = new URL("/dashboard", origin);
  target.searchParams.set("section", "activite");

  const error = u.searchParams.get("error");
  const code = u.searchParams.get("code");
  const receivedState = u.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GMAIL_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GMAIL_OAUTH_STATE_COOKIE);

  if (!isValidGmailOAuthState(expectedState, receivedState)) {
    target.searchParams.set("gmail_connect", "error");
    target.searchParams.set("gmail_error", "invalid_state");
    return NextResponse.redirect(target);
  }

  if (error) {
    target.searchParams.set("gmail_connect", "error");
    target.searchParams.set("gmail_error", error.slice(0, 200));
    return NextResponse.redirect(target);
  }
  if (!code) {
    target.searchParams.set("gmail_connect", "error");
    target.searchParams.set("gmail_error", "missing_code");
    return NextResponse.redirect(target);
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("supabase_unavailable");
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error("not_authenticated");

    const tokens = await exchangeGmailCode(code, redirectUri);
    if (!tokens.refreshToken) {
      // Google ne renvoie le refresh_token qu'au 1er consentement : on force prompt=consent
      // côté URL, donc une absence ici signale un consentement révoqué à retenter.
      throw new Error("no_refresh_token");
    }

    let email: string | null = null;
    if (tokens.accessToken) {
      const client = createGmailOAuthClient(redirectUri);
      client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expiry_date: tokens.expiryDate ?? undefined
      });
      email = await fetchGmailAddress(client);
    }

    await saveGmailToken(supabase, user.id, {
      email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope
    });

    target.searchParams.set("gmail_connect", "ok");
  } catch (e) {
    target.searchParams.set("gmail_connect", "error");
    target.searchParams.set(
      "gmail_error",
      (e instanceof Error ? e.message : "unknown").slice(0, 200)
    );
  }

  return NextResponse.redirect(target);
}
