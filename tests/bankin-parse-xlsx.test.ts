import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBankinTransactionsWorkbook, parseBankinPiloteWorkbook } from "@/lib/bankin/parse-xlsx";

const HEADERS = [
  "Date",
  "Description",
  "Compte",
  "Montant",
  "Catégorie",
  "Sous-Catégorie",
  "Note",
  "Pointée"
];

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), "Transactions");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
  return bytes;
}

describe("parseBankinTransactionsWorkbook", () => {
  it("préserve exactement les catégories et sous-catégories Bankin pour le privé", () => {
    const rows = parseBankinTransactionsWorkbook(
      workbookBuffer([
        ["23/08/2026", "Virement DigitPro", "LCL", 1_000, "Entrées d'argent.", "DigitPro Consulting BNC", "", ""],
        ["22/08/2026", "CARREFOUR", "LCL", -42.5, "Divers.", "A catégoriser", "", ""]
      ])
    );

    expect(rows).toMatchObject([
      {
        category: "Entrées d'argent › DigitPro Consulting BNC",
        scope: "personal"
      },
      {
        category: "Divers › A catégoriser",
        scope: "personal"
      }
    ]);
  });

  it("priorise les remboursements DigitPro NDF et IK identifiés dans le libellé", () => {
    const rows = parseBankinTransactionsWorkbook(
      workbookBuffer([
        ["02/09/2026", "VIREMENT INSTANTANE DigitPro Consulting NDF", "LCL", 509, "Divers.", "A catégoriser", "", ""],
        ["01/09/2026", "Virement DigitPro Consulting IK", "LCL", 525, "Divers.", "A catégoriser", "", ""],
        ["01/09/2026", "VIREMENT INSTANTANE Mr LONTSI", "LCL", -1450, "Divers.", "A catégoriser", "", ""]
      ])
    );

    expect(rows.map((row) => row.category)).toEqual([
      "NDF DigitPro",
      "Indemnités kilométriques",
      "Logement › Loyer"
    ]);
  });
});

it("parses a bounded full-history Bankin export above the generic 10,000-row limit", () => {
  const buffer = workbookBuffer(Array.from({ length: 11_870 }, () => ["01/10/2026", "TEST", "Compte synthétique", -1, "Logement", "Loyer", "", ""]));
  expect(parseBankinTransactionsWorkbook(buffer)).toHaveLength(11_870);
});

it("preserves Bankin source categories for Pilote without applying app transfer rules or the Pointée flag", () => {
  const buffer = workbookBuffer([["23/08/2026", "Virement DigitPro NDF", "Compte", 1000, "Entrées d’argent.", "Virements reçus", "", true]]);
  expect(parseBankinPiloteWorkbook(buffer)[0]).toMatchObject({ parentCategory: "Entrées d’argent.", subCategory: "Virements reçus", hidden: false });
});
it("recognizes an explicit Masquée column separately from Pointée", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...HEADERS, "Masquée"], ["01/10/2026", "TEST", "Compte", -1, "Logement.", "Loyer", "", false, true]]), "Transactions");
  const rows = parseBankinPiloteWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  expect(rows[0].hidden).toBe(true);
});


it("excludes flagged hidden credits and debits from Pilote totals after Excel parsing", async () => {
  const { buildBankinPiloteSnapshot } = await import("@/lib/pilote");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    [...HEADERS, "Masquée"],
    ["01/10/2026", "Synthetic hidden credit", "Compte", 500, "Entrées d’argent", "Salaire", "", false, true],
    ["01/10/2026", "Synthetic hidden debit", "Compte", -100, "Logement", "Loyer", "", false, "Oui"],
    ["01/10/2026", "Synthetic visible credit", "Compte", 20, "Entrées d’argent", "Salaire", "", true, false],
    ["01/10/2026", "Synthetic visible debit", "Compte", -5, "Logement", "Loyer", "", false, "Non"],
  ]), "Transactions");
  const rows = parseBankinPiloteWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  expect(rows.map(row => row.hidden)).toEqual([true, true, false, false]);
  const snapshot = buildBankinPiloteSnapshot(rows, "synthetic.xlsx", "a".repeat(64));
  expect(snapshot.excludedHidden).toBe(2);
  expect(snapshot.months[0]).toMatchObject({ income: 20, expenses: 5, balance: 15, count: 2 });
});
