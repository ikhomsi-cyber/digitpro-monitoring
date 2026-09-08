import { describe, expect, it } from "vitest";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import type { DashboardTx } from "@/lib/dashboard-metrics";

function revenue(amount: number): DashboardTx {
  return {
    id: "revenue-1",
    date: "2026-08-15",
    label: "Encaissement client",
    category: "Chiffre d’affaires",
    amount,
    balance: 24_000,
    company: "Qonto",
    scope: "pro"
  };
}

describe("computeDashboardHeroStats", () => {
  it("conserve la correction historique à 9,7 % et déduit aussi 1 200 € à 17,2 %", () => {
    const now = new Date(2026, 7, 20);

    const stats = computeDashboardHeroStats([revenue(24_000)], now);
    expect(stats.detteCsgDepuisDebutEur).toBe(740);
    expect(stats.csgComparaison172Eur).toBe(2240);
    expect(stats.detteTotaleDepuisDebutEur).toBe(stats.detteTvaDepuisDebutEur + 740);
    expect(computeDashboardHeroStats([revenue(1_200)], now).detteCsgDepuisDebutEur).toBe(0);
    expect(computeDashboardHeroStats([revenue(1_200)], now).csgComparaison172Eur).toBe(0);
  });
  it("déduit l’Urssaf de la comparaison sans modifier sa réintégration historique à 9,7 %", () => {
    const stats = computeDashboardHeroStats([
      revenue(24_000),
      { ...revenue(-3_000), id: "urssaf", label: "Prélèvement Urssaf", category: "Urssaf" }
    ], new Date(2026, 7, 20));
    expect(stats.detteCsgDepuisDebutEur).toBe(740);
    expect(stats.csgComparaison172Eur).toBe(1724);
    expect(stats.detteTotaleDepuisDebutEur).toBe(stats.detteTvaDepuisDebutEur + 740);
  });
  it("limite la comparaison à 17,2 % aux opérations depuis janvier 2023", () => {
    const stats = computeDashboardHeroStats([
      { ...revenue(12_000), id: "before", date: "2022-12-31" },
      { ...revenue(12_000), id: "after", date: "2023-01-01" }
    ], new Date(2026, 7, 20));
    expect(stats.detteCsgDepuisDebutEur).toBe(740);
    expect(stats.csgComparaison172Eur).toBe(520);
  });
});
