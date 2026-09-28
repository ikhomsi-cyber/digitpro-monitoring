import { describe, expect, it } from "vitest";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { withOutstandingInvoiceCsg } from "@/lib/dashboard-invoice-stats";
import { computeCsgRemainingEur } from "@/lib/csg-remaining";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";

const now = new Date(2026, 8, 28);
const invoice: HiwayInvoice = {
  id: "gmail-today", date: "2026-09-28", subject: "Facture Hiway",
  amountEur: 12_000, amountKind: "TTC", client: "Client", billedDays: null, tjmHtEur: null
};
const receipt: DashboardTx = {
  id: "receipt", date: "2026-09-28", label: "Virement client",
  amount: 12_000, category: "Chiffre d’affaires", company: "Qonto", scope: "pro"
};
const stats = {
  ...computeDashboardHeroStats([], now), soldeQontoEur: 5_000,
  detteCsgDepuisDebutEur: 6_000, csgComparaison172Eur: 8_000,
  detteTvaDepuisDebutEur: 2_000, detteTotaleDepuisDebutEur: 8_000,
  resteAVerserApresCashEur: 3_000
};

describe("CSG des factures dans le dashboard", () => {
  it("ajoute la facture Gmail du jour au reste à couvrir à 17,2 % sur le HT", () => {
    const updated = withOutstandingInvoiceCsg(stats, [invoice], [], now);
    expect(updated.csgComparaison172Eur).toBe(9_720);
    expect(computeCsgRemainingEur(updated)).toBe(6_720);
    expect(updated.detteCsgDepuisDebutEur).toBe(6_970);
    expect(updated.detteTotaleDepuisDebutEur).toBe(8_970);
    expect(updated.resteAVerserApresCashEur).toBe(3_970);
    expect(updated.detteTvaDepuisDebutEur).toBe(2_000);
    expect(stats.csgComparaison172Eur).toBe(8_000);
  });
  it("ne double pas la provision d’une facture encaissée", () => {
    expect(withOutstandingInvoiceCsg(stats, [invoice], [receipt], now)).toBe(stats);
  });
  it("provisionne uniquement la part non encaissée après un règlement partiel", () => {
    const updated = withOutstandingInvoiceCsg(stats, [invoice], [{ ...receipt, amount: 6_000 }], now);
    expect(updated.csgComparaison172Eur).toBe(8_860);
    expect(computeCsgRemainingEur(updated)).toBe(5_860);
  });
  it("réagit à l’import et ne cumule pas les provisions à chaque recalcul", () => {
    expect(withOutstandingInvoiceCsg(stats, null, [], now)).toBe(stats);
    expect(withOutstandingInvoiceCsg(stats, [], [], now)).toBe(stats);
    const imported = withOutstandingInvoiceCsg(stats, [invoice], [], now);
    expect(withOutstandingInvoiceCsg(stats, [invoice], [], now)).toEqual(imported);
  });
  it("exclut les émissions futures et celles d’avant 2023 du scénario à 17,2 %", () => {
    expect(withOutstandingInvoiceCsg(stats, [{ ...invoice, date: "2026-09-29" }], [], now)).toBe(stats);
    const before2023 = withOutstandingInvoiceCsg(stats, [{ ...invoice, date: "2022-12-31" }], [], now);
    expect(before2023.csgComparaison172Eur).toBe(stats.csgComparaison172Eur);
    expect(before2023.detteCsgDepuisDebutEur).toBe(6_970);
  });
});
