import { describe, expect, it } from "vitest";
import { isNdfCategorisationCandidate } from "@/lib/categorisation-candidates";
import { listPendingNdfCandidatesForMonth } from "@/lib/ndf-digitpro";
import type { DashboardTx } from "@/lib/dashboard-metrics";

function transaction(overrides: Partial<DashboardTx> = {}): DashboardTx {
  return {
    id: "tx-1",
    date: "2026-09-07",
    label: "CARTE CB SUSHI CLUB",
    category: "Loisirs & Sorties › NDF DigitPro",
    amount: -98,
    company: "Powens perso",
    importFormat: "powens",
    scope: "personal",
    categoryManual: false,
    ...overrides
  };
}

describe("NDF à arbitrer", () => {
  it("reconnaît une suggestion NDF importée dans une catégorie hiérarchique", () => {
    expect(isNdfCategorisationCandidate(transaction())).toBe(true);
  });

  it("exclut une NDF déjà validée manuellement", () => {
    expect(
      isNdfCategorisationCandidate(
        transaction({ category: "NDF DigitPro", categoryManual: true })
      )
    ).toBe(false);
  });

  it("affiche par défaut les candidates personnelles dans le bloc Activité", () => {
    const pending = listPendingNdfCandidatesForMonth([transaction()], "2026-09");
    expect(pending.map((tx) => tx.id)).toEqual(["tx-1"]);
  });
});
