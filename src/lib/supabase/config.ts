/**
 * Supabase public env — ONLY process.env (no hardcoded URLs/keys).
 *
 * Server / middleware: keys built dynamically so Next.js does not replace
 * `process.env.NEXT_PUBLIC_*` with empty literals when vars are only set at runtime.
 *
 * Browser: Next inlines static `process.env.NEXT_PUBLIC_*` only — dynamic
 * `process.env[computedKey]` is often undefined on the client; we fall back to
 * explicit reads so Auth (login/signup) works.
 */

export type SupabaseRuntimeMode = "SUPABASE" | "DEMO";

function envKeyParts(...parts: string[]): string {
  return parts.join("_");
}

/** → NEXT_PUBLIC_SUPABASE_URL */
function urlEnvKey(): string {
  return envKeyParts("NEXT", "PUBLIC", "SUPABASE", "URL");
}

/** → NEXT_PUBLIC_SUPABASE_ANON_KEY */
function anonKeyEnvKey(): string {
  return envKeyParts("NEXT", "PUBLIC", "SUPABASE", "ANON", "KEY");
}

function readProcessEnv(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const raw = process.env[key];
  if (raw == null) return undefined;
  const t = String(raw).trim();
  return t.length > 0 ? t : undefined;
}

function trimEnv(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  return t.length > 0 ? t : undefined;
}

function urlFromEnv(): string | undefined {
  const viaDynamic = readProcessEnv(urlEnvKey());
  if (viaDynamic) return viaDynamic;
  return trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function anonKeyFromEnv(): string | undefined {
  const viaDynamic = readProcessEnv(anonKeyEnvKey());
  if (viaDynamic) return viaDynamic;
  return trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function credentialsPresent(): boolean {
  return Boolean(urlFromEnv() && anonKeyFromEnv());
}

function diagnosticsEnabled(): boolean {
  return (
    readProcessEnv("SUPABASE_DEBUG") === "true" ||
    readProcessEnv("NEXT_PUBLIC_SUPABASE_DEBUG") === "true"
  );
}

export function getSupabaseRuntimeMode(): SupabaseRuntimeMode {
  return credentialsPresent() ? "SUPABASE" : "DEMO";
}

/** Alias — DEMO iff either env var is missing or whitespace-only. */
export function hasSupabaseEnv(): boolean {
  return credentialsPresent();
}

/**
 * Optional console diagnostics (logs public URL; anon key presence only, never the key value).
 * Enable with SUPABASE_DEBUG=true or NEXT_PUBLIC_SUPABASE_DEBUG=true.
 */
export function reportSupabaseEnvDiagnostics(source: string, opts?: { dedupeKey?: string }): void {
  if (!diagnosticsEnabled()) return;

  if (opts?.dedupeKey) {
    const g = globalThis as unknown as Record<string, boolean>;
    const flag = `__supabase_diag_${opts.dedupeKey}__`;
    if (g[flag]) return;
    g[flag] = true;
  }

  const urlPresent = Boolean(urlFromEnv());
  const keyPresent = Boolean(anonKeyFromEnv());
  const mode = getSupabaseRuntimeMode();

  console.info(
    `[Supabase] ${source}: NEXT_PUBLIC_SUPABASE_URL=${urlPresent ? "present" : "MISSING"}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${keyPresent ? "present" : "MISSING"} -> mode=${mode}`
  );
}

/** Trimmed credentials from process.env, or null when DEMO. */
export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = urlFromEnv();
  const anonKey = anonKeyFromEnv();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
