import type { MouseEvent } from "react";

/**
 * Navigation client sur `/dashboard` sans rechargement serveur (pushState).
 * Utilisé pour les onglets une fois l’app chargée : pas de `loading.tsx`, sections
 * déjà montées. Premier accès et F5 passent par Next.js → loader normal.
 */
export function isDashboardShallowHref(href: string): boolean {
  if (href === "/dashboard") return true;
  if (!href.startsWith("/dashboard?")) return false;
  try {
    const url = new URL(href, "http://local");
    return url.pathname === "/dashboard";
  } catch {
    return false;
  }
}

export function navigateDashboardShallow(href: string): void {
  if (typeof window === "undefined" || !isDashboardShallowHref(href)) return;
  const url = new URL(href, window.location.origin);
  const next = `${url.pathname}${url.search}`;
  if (`${window.location.pathname}${window.location.search}` === next) return;
  window.history.pushState(null, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export function onDashboardShallowClick(href: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isDashboardShallowHref(href)) return;
    event.preventDefault();
    navigateDashboardShallow(href);
  };
}
