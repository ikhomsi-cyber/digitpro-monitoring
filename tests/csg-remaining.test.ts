import { describe, expect, it } from "vitest";
import { computeCsgRemainingEur } from "@/lib/csg-remaining";

describe("reste global CSG", () => {
  it("déduit le cash de la CSG et de la TVA", () => {
    expect(computeCsgRemainingEur({ soldeQontoEur: 70945, csgComparaison172Eur: 80000, detteTvaDepuisDebutEur: 19301 })).toBe(28356);
  });
  it("ne présente pas un excédent comme une dette négative", () => {
    expect(computeCsgRemainingEur({ soldeQontoEur: 100, csgComparaison172Eur: 50, detteTvaDepuisDebutEur: 20 })).toBe(0);
  });
  it("attend un solde disponible", () => {
    expect(computeCsgRemainingEur({ soldeQontoEur: null, csgComparaison172Eur: 50, detteTvaDepuisDebutEur: 20 })).toBeNull();
  });
});
