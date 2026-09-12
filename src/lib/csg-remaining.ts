import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";

/** Reste global à financer dans le scénario CSG à 17,2 %, TVA comprise. */
export function computeCsgRemainingEur(stats: Pick<DashboardHeroStats,
  "soldeQontoEur" | "csgComparaison172Eur" | "detteTvaDepuisDebutEur"
>): number | null {
  if (stats.soldeQontoEur == null) return null;
  return Math.max(0, Math.round(
    (stats.csgComparaison172Eur + stats.detteTvaDepuisDebutEur - stats.soldeQontoEur) * 100
  ) / 100);
}
