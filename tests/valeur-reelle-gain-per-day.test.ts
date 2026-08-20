import { describe, expect, it } from "vitest";
import {
  computeCappedGainPerWorkDay,
  resolveWorkedDaysForGain
} from "@/lib/valeur-reelle-gain-per-day";

describe("computeCappedGainPerWorkDay", () => {
  it("does not let monthly cash movements inflate the daily gain above the TJM", () => {
    // CA HT 9 000 € sur 10 jours à 900 €, mais 9 360 € de flux BNC/frais enregistrés.
    expect(computeCappedGainPerWorkDay(9_360, 9_000, 10)).toBe(900);
  });

  it("keeps a retained gain below the TJM unchanged", () => {
    expect(computeCappedGainPerWorkDay(7_710, 9_000, 10)).toBe(771);
  });

  it("uses billed days implied by CA when the calendar is incomplete", () => {
    // Juillet : 13 jours cochés, 13 940 € HT et TJM à 900 € = 15,49 jours facturés.
    const days = resolveWorkedDaysForGain(13, 13_940, 900);
    expect(days).toBe(15.5);
    expect(computeCappedGainPerWorkDay(12_173, 13_940, days)).toBe(785.35);
  });
});
