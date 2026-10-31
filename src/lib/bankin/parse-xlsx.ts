import { createHash } from "node:crypto";
import { checkWorkbookArchive } from "@/lib/security/workbook-limits";
import { MAX_IMPORT_BYTES, MAX_BANKIN_IMPORT_ROWS } from "@/lib/security/import-validation";
import * as XLSX from "xlsx";
import { parseFlexibleDate } from "@/lib/csv-import";
import { categorizeKnownPersonalTransfer, formatBankinHierarchy } from "./categorize";

export type BankinParsedRow = {
  date: string;
  label: string;
  company: string;
  category: string;
  amount: number;
  balance: null;
  scope: "personal";
};

const EXPECTED_HEADERS = [
  "date",
  "description",
  "compte",
  "montant",
  "categorie",
  "sous-categorie",
  "note",
  "pointee"
];

function normalizeHeaderCell(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellToYmd(cell: unknown): string | null {
  if (cell == null || cell === "") return null;
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === "number" && Number.isFinite(cell)) {
    const epoch = Math.round((cell - 25569) * 86400 * 1000);
    const d = new Date(epoch);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return parseFlexibleDate(String(cell));
}

function cellToNumber(cell: unknown): number | null {
  if (cell == null || cell === "") return null;
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  const s = String(cell).replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  const cleaned = s.replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse un export Bankin « Liste des transactions » (.xls ou .xlsx).
 * Retourne des lignes prêtes pour `importTransactions` (scope perso).
 */
function bankinWorkbookMatrix(buffer: ArrayBuffer) {
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error("Fichier trop volumineux (3 Mo maximum).");
  checkWorkbookArchive(buffer);
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, sheetRows: MAX_BANKIN_IMPORT_ROWS + 2, sheets: 0 });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Fichier Excel vide ou illisible.");

  const sh = wb.Sheets[sheetName];
  if (sh["!fullref"]) {
    const range = XLSX.utils.decode_range(sh["!fullref"]);
    if (range.e.r >= MAX_BANKIN_IMPORT_ROWS + 1) throw new Error("Trop de lignes dans le fichier Excel.");
  }
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sh, {
    header: 1,
    defval: ""
  });

  if (matrix.length > MAX_BANKIN_IMPORT_ROWS + 1) throw new Error("Trop de lignes dans le fichier Excel.");
  if (!matrix.length) throw new Error("Aucune ligne dans la feuille Excel.");

  const headerNorm = (matrix[0] ?? []).map(normalizeHeaderCell);
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headerNorm[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(
        "Format d’export Bankin inattendu : en-têtes de colonnes différents de l’export standard (Date, Description, Compte, Montant, …)."
      );
    }
  }

  return matrix;
}

export function parseBankinTransactionsWorkbook(buffer: ArrayBuffer): BankinParsedRow[] {
  const matrix = bankinWorkbookMatrix(buffer);
  const out: BankinParsedRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const dateIso = cellToYmd(row[0]);
    const label = String(row[1] ?? "").trim() || "Sans libellé";
    const account = String(row[2] ?? "").trim() || "Compte perso";
    const amount = cellToNumber(row[3]);
    const parent = String(row[4] ?? "");
    const sub = String(row[5] ?? "");

    if (!dateIso || amount === null) continue;

    // L'export Bankin reste la source de vérité, sauf les virements connus
    // explicitement identifiés dans le libellé (DigitPro NDF / IK, loyer Lontsi).
    const category =
      categorizeKnownPersonalTransfer(label, amount) ?? formatBankinHierarchy(parent, sub);

    out.push({
      date: dateIso,
      label,
      company: account,
      category,
      amount,
      balance: null,
      scope: "personal"
    });
  }

  return out;
}

/** Exact source fields for Pilote: no category inference, transfer overrides, or app mappings. */
export function parseBankinPiloteWorkbook(buffer: ArrayBuffer): import("@/lib/pilote").BankinPiloteRow[] {
  const matrix = bankinWorkbookMatrix(buffer);
  const headers = matrix[0].map(normalizeHeaderCell);
  const hiddenIndex = headers.findIndex(name => ["masquee", "masque", "transaction masquee", "hidden"].includes(name));
  return matrix.slice(1).flatMap((row, index) => {
    const date = cellToYmd(row[0]); const amount = cellToNumber(row[3]);
    if (!date || amount === null) return [];
    const hidden = hiddenIndex >= 0 && ["true", "1", "oui", "yes", "x", "masque", "masquee"].includes(normalizeHeaderCell(row[hiddenIndex]));
    // Categories and spreadsheet row numbers can change between exports.
    const identity = createHash("sha256").update(JSON.stringify([date, Math.round(amount * 100), String(row[1] ?? "").normalize("NFC").trim(), String(row[2] ?? "").normalize("NFC").trim()])).digest("hex");
    return [{ sourceRow: index + 2, identity, label: String(row[1] ?? "").trim(), date, amount, parentCategory: String(row[4] ?? "").trim(), subCategory: String(row[5] ?? "").trim(), hidden }];
  });
}
