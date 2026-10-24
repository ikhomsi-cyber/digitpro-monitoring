import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GMAIL_OAUTH_STATE_COOKIE, isValidGmailOAuthState } from "@/lib/gmail/oauth-state";
import { createGmailOAuthClient, exchangeGmailCode } from "@/lib/gmail/oauth";
import { gmailRedirectUriForOrigin, resolveRequestOrigin } from "@/lib/gmail/config";
import { fetchGmailAddress } from "@/lib/gmail/fetch-invoices";
import { gmailAccount } from "@/lib/gmail/accounts";
import { saveGmailToken, loadGmailTokenRow } from "@/lib/gmail/tokens";

/**
 * Redirection OAuth Google après consentement Gmail (lecture seule).
 * Déclarez cette URL exacte comme « URI de redirection autorisé » dans la console
 * Google Cloud (GOOGLE_REDIRECT_URI).
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  // Origine réelle (proxy Vercel) : sert au redirect_uri d'échange ET à la redirection finale,
  // pour ne jamais retomber sur localhost en production.
  let origin: string | null;
  try { origin = resolveRequestOrigin(req.headers); } catch { origin = null; }
  if (!origin) return NextResponse.json({ error: "Origine OAuth non autorisée." }, { status: 400 });
  const redirectUri = gmailRedirectUriForOrigin(origin) ?? undefined;
  const target = new URL("/dashboard", origin);
  target.searchParams.set("section", "activite");

  const error = u.searchParams.get("error");
  const code = u.searchParams.get("code");
  const receivedState = u.searchParams.get("state");
  const cookieStore = await cookies();
  const accountCookie = cookieStore.get("gmail_oauth_account")?.value;
  cookieStore.delete("gmail_oauth_account");
  const expectedState = cookieStore.get(GMAIL_OAUTH_STATE_COOKIE)?.value;
  const returnSection = cookieStore.get("gmail_oauth_return")?.value;
  if (returnSection === "pilote" || returnSection === "courses") target.searchParams.set("section", returnSection);
  cookieStore.delete("gmail_oauth_return");
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

  let stage = "session";
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("supabase_unavailable");
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error("not_authenticated");

    let account = gmailAccount(accountCookie);
    stage = "token-exchange";
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
      stage = "profile";
      email = await fetchGmailAddress(client);
    }

    if (!email) throw new Error("gmail_address_unavailable");
    stage = "store-check";
    const primary = await loadGmailTokenRow(supabase, user.id, "primary");
    const secondary = await loadGmailTokenRow(supabase, user.id, "secondary");
    // An OAuth flow started before the multi-account rollout must not replace an existing account.
    if (!accountCookie && primary?.refresh_token && primary.email?.toLowerCase() !== email.toLowerCase()) account = "secondary";
    const selected = account === "primary" ? primary : secondary;
    const other = account === "primary" ? secondary : primary;
    if (other?.email?.toLowerCase() === email.toLowerCase()) throw new Error("account_already_connected");
    if (selected?.refresh_token && selected.email?.toLowerCase() !== email.toLowerCase()) throw new Error("account_slot_occupied");
    stage = "token-save";
    await saveGmailToken(supabase, user.id, {
      email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope
    }, account);

    console.info("[gmail] account saved", { account });
    target.searchParams.set("gmail_connect", "ok");
    target.searchParams.set("gmail_account", account);
  } catch (e) {
    console.warn("[gmail] OAuth connection failed", { stage });
    target.searchParams.set("gmail_connect", "error");
    target.searchParams.set(
      "gmail_error",
      e instanceof Error && ["account_already_connected", "account_slot_occupied", "gmail_address_unavailable", "no_refresh_token", "not_authenticated"].includes(e.message) ? e.message : "connection_failed"
    );
  }

  return NextResponse.redirect(target);
}
