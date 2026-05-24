import type { CookieReader } from "@/lib/dashboard-demo-preference";

/** Préférence : afficher des montants / chiffres fictifs (données réelles inchangées en base). */
export const DASHBOARD_DUMMY_DATA_COOKIE = "sasu_dashboard_dummy_data";

export function isDashboardDummyDataActive(cookieStore: CookieReader): boolean {
  const v = cookieStore.get(DASHBOARD_DUMMY_DATA_COOKIE)?.value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
