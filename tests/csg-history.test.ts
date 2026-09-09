import { describe, expect, it } from "vitest";
import { buildCsgHistory, computeGeneratedCaHtToDate, summarizeCsgHistory } from "@/lib/csg-history";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { buildInvoiceWorkedDaysPastMonthsSeries } from "@/lib/invoice-worked-days-series";

const now = new Date(2026, 8, 9);
const tx = (id: string, date: string, amount: number, category = "Chiffre d’affaires"): DashboardTx => ({
  id, date, amount, category, label: category, company: "Qonto", scope: "pro"
});

describe("historique CSG", () => {
  it("inclut 2022 prescrite sans répéter la correction globale", () => {
    const rows = buildCsgHistory([
      tx("old", "2022-12-15", 120000),
      tx("2023", "2023-03-01", 12000),
      tx("2026", "2026-04-01", 24000),
      { ...tx("private", "2026-03-01", 120000), scope: "personal" }
    ], now);
    expect(rows.map((row) => row.year)).toEqual([2026, 2023, 2022]);
    expect(rows[0]).toMatchObject({ csg97Eur: 1940, csg172Eur: 3440, differenceEur: 1500 });
    expect(rows[1]).toMatchObject({ csg97Eur: 970, csg172Eur: 1720, differenceEur: 750 });
    expect(rows[2]).toMatchObject({ prescribed: true, csg97Eur: 9700, csg172Eur: 0, differenceEur: -9700 });
    expect(summarizeCsgHistory(rows)).toMatchObject({ amountToCoverEur: 0, surplusEur: 7450 });
  });

  it("conserve la réintégration Urssaf à 9,7 % seulement", () => {
    expect(buildCsgHistory([
      tx("income", "2026-03-01", 24000),
      tx("urssaf", "2026-02-01", -3000, "Urssaf")
    ], now)[0]).toMatchObject({ csg97Eur: 1940, csg172Eur: 2924, differenceEur: 984 });
  });

  it("compense seulement les années sélectionnées avec la provision 2022", () => {
    const rows = buildCsgHistory([
      tx("2022", "2022-12-01", 12000),
      tx("2023", "2023-05-01", 12000),
      tx("2026", "2026-05-01", 24000)
    ], now);
    expect(summarizeCsgHistory(rows)).toMatchObject({ csg97Eur: 3880, csg172Eur: 5160, compensationEur: 970, differenceBeforeCompensationEur: 2250, amountToCoverEur: 1280 });
    expect(summarizeCsgHistory(rows.filter((row) => row.year !== 2022))).toMatchObject({ compensationEur: 0, amountToCoverEur: 2250 });
    expect(summarizeCsgHistory(rows.filter((row) => row.year !== 2023))).toMatchObject({ compensationEur: 970, amountToCoverEur: 530 });
    expect(summarizeCsgHistory(rows.filter((row) => row.year === 2022))).toMatchObject({ amountToCoverEur: 0, surplusEur: 970 });
  });

  it("affiche une année courante vide sans montant fictif", () => {
    expect(buildCsgHistory([], now)).toEqual([
      { year: 2026, prescribed: false, generatedCaHtEur: 0, csg97Eur: 0, csg172Eur: 0, differenceEur: 0 },
      { year: 2022, prescribed: true, generatedCaHtEur: 0, csg97Eur: 0, csg172Eur: 0, differenceEur: 0 }
    ]);
  });

  it("applique une seule fois le rattachement janvier puis le décalage de prestation", () => {
    const rows = buildCsgHistory([tx("december", "2022-12-31", 12000)], now);
    expect(rows.find((row) => row.year === 2022)).toMatchObject({ generatedCaHtEur: 10000, csg97Eur: 970, csg172Eur: 0 });
    expect(rows.find((row) => row.year === 2023)).toBeUndefined();
  });

  it("rattache les trois factures Skylab à octobre–décembre 2022 comme Jours facturés", () => {
    const transactions = [
      tx("deposit", "2022-10-10", 1000),
      tx("F1002", "2022-12-02", 17784),
      tx("F1003", "2023-01-02", 18720),
      tx("F1004", "2023-01-31", 20124),
      tx("charge", "2022-12-14", -1200, "Urssaf"),
      tx("next-charge", "2023-01-14", -600, "Urssaf")
    ];
    const original = structuredClone(transactions);
    const activity = buildInvoiceWorkedDaysPastMonthsSeries(transactions, "pro", now);
    const rows = buildCsgHistory(transactions, now);
    const activity2022 = activity.filter((row) => row.monthKey.startsWith("2022"));
    expect(activity2022.map((row) => row.caHt)).toEqual([14820, 15600, 16770]);
    expect(rows.find((row) => row.year === 2022)).toMatchObject({ generatedCaHtEur: 47190, csg97Eur: 4577.43 });
    expect(rows.find((row) => row.year === 2023)?.generatedCaHtEur).toBe(0);
    expect(rows.reduce((sum, row) => sum + row.generatedCaHtEur, 0)).toBe(activity.reduce((sum, row) => sum + row.caHt, 0));
    expect(transactions).toEqual(original);
  });

  it("utilise pour 2026 le CA réellement généré à date de Jours facturés", () => {
    const transactions = [tx("jan", "2026-03-02", 12000)];
    const selected = new Set(["2026-08-10", "2026-09-08"]);
    const invoices = [{
      id: "invoice-september", date: "2026-09-05", amountEur: 4100,
      amountKind: "HT" as const, client: "Client", billedDays: 5, tjmHtEur: 820, subject: "Facture"
    }];
    const generated = computeGeneratedCaHtToDate(transactions, selected, [], 820, invoices, now);
    expect(generated).toBe(14920);
    expect(buildCsgHistory(transactions, now, generated).find((row) => row.year === 2026)).toMatchObject({
      generatedCaHtEur: 14920,
      csg97Eur: 1447.24,
      csg172Eur: 2566.24,
      differenceEur: 1119
    });
  });
});
