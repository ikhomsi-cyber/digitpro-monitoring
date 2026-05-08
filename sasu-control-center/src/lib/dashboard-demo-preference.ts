import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

/** HttpOnly-capable preference cookie — toggled from the dashboard only when Supabase env exists. */
export const DASHBOARD_DEMO_COOKIE = "sasu_dashboard_demo";

type CookieReader = { get(name: string): { value: string } | undefined };

export function isDashboardDemoPreferenceActive(cookieStore: CookieReader): boolean {
  const v = cookieStore.get(DASHBOARD_DEMO_COOKIE)?.value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Effective mode for dashboard data + mutations: env DEMO stays DEMO; otherwise cookie can force DEMO. */
export function getDashboardEffectiveDataMode(
  envMode: SupabaseRuntimeMode,
  cookieStore: CookieReader
): SupabaseRuntimeMode {
  if (envMode === "DEMO") return "DEMO";
  return isDashboardDemoPreferenceActive(cookieStore) ? "DEMO" : "SUPABASE";
}
