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
  it("applique la correction CSG fixe de 1 200 € sans produire de dette négative", () => {
    const now = new Date(2026, 7, 20);

    expect(computeDashboardHeroStats([revenue(24_000)], now).detteCsgDepuisDebutEur).toBe(740);
    expect(computeDashboardHeroStats([revenue(1_200)], now).detteCsgDepuisDebutEur).toBe(0);
  });
});
