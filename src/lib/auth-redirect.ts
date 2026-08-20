export const DEFAULT_AUTH_REDIRECT = "/dashboard";

/**
 * Restricts post-authentication navigation to an internal application path.
 * This prevents a `next` query parameter from becoming an open redirect.
 */
export function getSafeAuthRedirect(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return next;
}
