import { describe, expect, it } from "vitest";
import { isNdfCategorisationCandidate } from "@/lib/categorisation-candidates";
import { listPendingNdfCandidatesForMonth, summarizeNdfDigitProForMonth } from "@/lib/ndf-digitpro";
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
  it("propose The Ranch même quand l'import le classe en fast food", () => {
    const tx = transaction({
      date: "2026-10-03",
      label: "[En cours] CB THE RANCH CLAMART 03/10/26",
      amount: -79.4,
      category: "Alimentation & Restau › Fast foods"
    });
    expect(listPendingNdfCandidatesForMonth([tx], "2026-10")).toEqual([tx]);
    expect(isNdfCategorisationCandidate({ ...tx, amount: 79.4 })).toBe(false);
    expect(isNdfCategorisationCandidate({ ...tx, category: "Repas dirigeant", categoryManual: true })).toBe(false);
    expect(isNdfCategorisationCandidate({ ...tx, label: "CB Aprr Villefranch" })).toBe(false);
  });

  it("ne masque pas une suggestion normalisée en la dédoublonnant avec elle-même", () => {
    const tx = transaction({ category: "NDF DigitPro" });
    expect(summarizeNdfDigitProForMonth([tx], "2026-09")).toEqual({
      totalEur: 0,
      transactions: []
    });
    expect(listPendingNdfCandidatesForMonth([tx], "2026-09")).toEqual([tx]);

    const validated = { ...tx, categoryManual: true };
    expect(listPendingNdfCandidatesForMonth([validated], "2026-09")).toEqual([]);
    expect(summarizeNdfDigitProForMonth([validated], "2026-09")).toEqual({
      totalEur: 98,
      transactions: [validated]
    });
  });

  it("masque toujours le doublon importé d'une NDF réellement validée", () => {
    const pending = transaction({ category: "NDF DigitPro" });
    const validated = { ...pending, id: "validated", categoryManual: true };
    expect(listPendingNdfCandidatesForMonth([pending, validated], "2026-09")).toEqual([]);
  });

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
