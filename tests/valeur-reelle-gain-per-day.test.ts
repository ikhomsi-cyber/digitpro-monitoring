import { describe, expect, it } from "vitest";
import {
  buildTrailingGainPerWorkDayPoints,
  computeCappedGainPerWorkDay
} from "@/lib/valeur-reelle-gain-per-day";
import type { DashboardTx } from "@/lib/dashboard-metrics";

describe("computeCappedGainPerWorkDay", () => {
  it("does not let monthly cash movements inflate the daily gain above the TJM", () => {
    // CA HT 9 000 € sur 10 jours à 900 €, mais 9 360 € de flux BNC/frais enregistrés.
    expect(computeCappedGainPerWorkDay(9_360, 9_000, 10)).toBe(900);
  });

  it("keeps a retained gain below the TJM unchanged", () => {
    expect(computeCappedGainPerWorkDay(7_710, 9_000, 10)).toBe(771);
  });

});

describe("buildTrailingGainPerWorkDayPoints", () => {
  it("uses the theoretical BNC even when no BNC transfer was made", () => {
    const revenue: DashboardTx = {
      id: "revenue",
      date: "2026-08-10",
      label: "Client",
      category: "Chiffre d’affaires",
      amount: 1_200,
      company: "Qonto",
      scope: "pro"
    };
    const paidBnc: DashboardTx = {
      ...revenue,
      id: "bnc",
      date: "2026-08-20",
      label: "Virement BNC",
      category: "BNC",
      amount: -500
    };
    const gain = (transactions: DashboardTx[]) =>
      buildTrailingGainPerWorkDayPoints(
        transactions,
        new Set(["2026-08-10"]),
        "2026-08",
        1,
        new Date(2026, 9, 2),
        [],
        1_000
      )[0]?.gainPerDayEur;

    // 1 000 € HT − 9,7 % de CSG : le virement réel ne change pas le mois travaillé.
    expect(gain([revenue])).toBe(903);
    expect(gain([revenue, paidBnc])).toBe(903);
  });

  it("uses the billed TJM from the daily breakdown even when more calendar days are checked", () => {
    const revenue: DashboardTx = {
      id: "revenue",
      date: "2026-09-10",
      label: "Client",
      category: "Chiffre d’affaires",
      amount: 15_600,
      company: "Qonto",
      scope: "pro"
    };
    const calendarDays = new Set(
      Array.from({ length: 22 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`)
    );
    const point = buildTrailingGainPerWorkDayPoints(
      [revenue],
      calendarDays,
      "2026-09",
      1,
      new Date(2026, 9, 2),
      [],
      1_000
    )[0];

    // 13 000 € HT = 13 jours à 1 000 € ; les 22 jours cochés ne diluent pas le gain.
    expect(point?.gainPerDayEur).toBe(903);
  });
});
