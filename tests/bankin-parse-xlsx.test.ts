import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBankinTransactionsWorkbook } from "@/lib/bankin/parse-xlsx";

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
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
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
});
