/**
 * Logos contreparties : favicon public par domaine (Google s2) + repli initiales côté UI.
 * Noms mappés à un domaine pour favicon (Google s2). Laisser vide pour forcer les initiales.
 */

export function normalizeCounterpartyKey(name: string): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Domaine dont on affiche le favicon (icône marque), clé = `normalizeCounterpartyKey(nom affiché)`.
 * Étendre cette liste au fil des clients récurrents.
 */
const COUNTERPARTY_BRAND_DOMAINS: Readonly<Record<string, string>> = {
  "mercedes-benz": "mercedes-benz.com",
  mercedes: "mercedes-benz.com",
  carrefour: "carrefour.com",
  /** Libellés tronqués type « Carref » dans l’UI. */
  carref: "carrefour.com"
};

const UNRESOLVED_KEYS = new Set(["contrepartie non renseignee", ""]);

/**
 * Host (sans schéma) si on peut afficher un favicon, sinon null.
 */
export function counterpartyBrandDomain(displayName: string): string | null {
  const key = normalizeCounterpartyKey(displayName);
  if (UNRESOLVED_KEYS.has(key)) return null;

  const mapped = COUNTERPARTY_BRAND_DOMAINS[key];
  if (mapped) return mapped;

  for (const [alias, host] of Object.entries(COUNTERPARTY_BRAND_DOMAINS)) {
    if (key.includes(alias)) return host;
  }

  const hostLike = displayName.match(
    /\b([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:fr|com|eu|net|io|org|co\.uk))\b/i
  );
  if (hostLike) return hostLike[1]!.toLowerCase();

  return null;
}

/** URL favicon (PNG ~64px via Google). */
export function counterpartyLogoHref(displayName: string, size = 64): string | null {
  const host = counterpartyBrandDomain(displayName);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${String(size)}`;
}

export function counterpartyInitials(name: string): string {
  const t = (name ?? "").trim();
  if (!t || /^contrepartie non renseignée$/i.test(t)) return "?";
  const key = normalizeCounterpartyKey(t);
  if (key === "skylab consulting") return "SK";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]!.charAt(0);
    const b = parts[parts.length - 1]!.charAt(0);
    return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}
