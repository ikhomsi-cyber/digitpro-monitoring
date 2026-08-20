import { describe, expect, it } from "vitest";
import { computeTreasuryVerserSnapshot } from "@/lib/treasury-verser";
import type { DashboardTx } from "@/lib/dashboard-metrics";

function tx(overrides: Partial<DashboardTx>): DashboardTx {
  return {
    id: "tx-1",
    date: "2026-08-15",
    label: "Transaction",
    category: "Autres",
    amount: 0,
    company: "Qonto",
    scope: "pro",
    ...overrides
  };
}

describe("computeTreasuryVerserSnapshot", () => {
  it("provisionne la CSG au taux exact de 9,7 % du CA HT encaissé", () => {
    const snapshot = computeTreasuryVerserSnapshot(
      [tx({ category: "Chiffre d'affaires", amount: 1_200, balance: 8_000 })],
      "pro",
      2026,
      7
    );

    expect(snapshot.caEncaisseHt).toBe(1_000);
    expect(snapshot.csgDue).toBe(97);
    expect(snapshot.tvaTheorique).toBe(200);
    expect(snapshot.qontoSolde).toBe(8_000);
  });

  it("rattache le CA reçu après le 26 au mois analytique suivant", () => {
    const snapshot = computeTreasuryVerserSnapshot(
      [tx({ date: "2026-08-27", category: "Chiffre d’affaires", amount: 1_200 })],
      "pro",
      2026,
      8
    );

    expect(snapshot.monthKey).toBe("2026-09");
    expect(snapshot.caEncaisseTtc).toBe(1_200);
  });
});
