import { timingSafeEqual } from "node:crypto";

export const GMAIL_OAUTH_STATE_COOKIE = "gmail_oauth_state";
export const GMAIL_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

/** Constant-time comparison for the OAuth callback correlation value. */
export function isValidGmailOAuthState(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
