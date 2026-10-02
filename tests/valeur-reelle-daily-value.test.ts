import { describe, expect, it } from "vitest";
import { analyzeValeurReelle } from "@/lib/valeur-reelle-analyze";
import { computeValeurReelleDailyBreakdown } from "@/lib/valeur-reelle-daily-value";
import { computeCashedCaWorkedDays } from "@/lib/invoice-worked-days-series";
import type { DashboardTx } from "@/lib/dashboard-metrics";

describe("computeValeurReelleDailyBreakdown", () => {
  it("starts from the billed TJM and assigns the unpaid BNC to the residual", () => {
    const revenue: DashboardTx = {
      id: "revenue",
      date: "2026-09-10",
      label: "Client",
      category: "Chiffre d’affaires",
      amount: 15_600,
      company: "Qonto",
      scope: "pro"
    };
    const paidBnc: DashboardTx = {
      ...revenue,
      id: "bnc",
      date: "2026-09-20",
      label: "Virement BNC",
      category: "BNC",
      amount: -1_000
    };
    const breakdown = (transactions: DashboardTx[]) => {
      const ca = computeCashedCaWorkedDays(
        transactions,
        { years: [2026], months: ["2026-09"] },
        [],
        1_000,
        new Date(2026, 9, 2)
      );
      const tree = analyzeValeurReelle(transactions, {
        years: null,
        month: "2026-09",
        now: new Date(2026, 9, 2)
      }).cashTree;
      return computeValeurReelleDailyBreakdown({
        tree: {
          ...tree,
          mandatoryFeesEur: 1_300,
          personalChargesEur: 650,
          csgEur: 1_105
        },
        tjmHt: ca.effectiveTjmHt,
        billableDays: ca.workedDays
      });
    };

    for (const transactions of [[revenue], [revenue, paidBnc]]) {
      expect(breakdown(transactions)).toMatchObject({
        caHtPerDay: 1_000,
        mandatoryFeesPerDay: 100,
        personalChargesPerDay: 50,
        csgPerDay: 85,
        bncPerDay: 765,
        netPerDay: 815,
        workedDays: 13
      });
    }
  });

  it("does not allocate an unearned TJM when the period has no revenue", () => {
    const tree = analyzeValeurReelle([], {
      years: null,
      month: "2026-09",
      now: new Date(2026, 9, 2)
    }).cashTree;
    expect(computeValeurReelleDailyBreakdown({ tree, tjmHt: 1_000, billableDays: 0 })).toMatchObject({
      caHtPerDay: 0,
      bncPerDay: 0,
      netPerDay: 0
    });
  });
});
