import Papa from "papaparse";

export type CsvImportFormat = "qonto" | "generic";

export type NormalizedImportRow = {
  date: string;
  label: string;
  category: string;
  amount: number;
  /** Solde du compte (post-opération) si présent dans le CSV, sinon null. */
  balance: number | null;
  /** Account / legal entity name (e.g. Qonto « Nom du compte »). */
  company: string;
};

export type CsvParseSuccess = {
  ok: true;
  format: CsvImportFormat;
  delimiter: string;
  rows: NormalizedImportRow[];
  warnings: string[];
};

export type CsvParseFailure = {
  ok: false;
  error: string;
};

export type CsvParseResult = CsvParseSuccess | CsvParseFailure;

const DEFAULT_CATEGORY = "Qonto";

/** Accent-fold + lowercase for resilient header matching (FR / EN). */
export function foldAccents(input: string) {
  return input.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeHeaderKey(raw: string) {
  return foldAccents(raw.trim())
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/[^\w]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Detect separator from first non-empty line (comma vs semicolon vs tab). */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (semis >= commas && semis >= tabs && semis > 0) return ";";
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  return ",";
}

export function detectCsvFormat(delimiter: string, headersRaw: string[]): CsvImportFormat {
  const norms = headersRaw.map((h) => normalizeHeaderKey(h));
  const hasGenericCore =
    norms.some((n) => n === "date") &&
    norms.some((n) => n === "label") &&
    norms.some((n) => n === "amount");
  if (hasGenericCore) return "generic";

  const joined = foldAccents(headersRaw.join(" | ").toLowerCase());
  if (delimiter === ";") return "qonto";
  if (/libell|montant|operation|opération|qonto/.test(joined)) return "qonto";

  return "qonto";
}

/** Parse amounts like "1 234,56 €", "-42", "(100)" → number */
export function parseFrenchAmount(raw: string): number | null {
  let s = raw.replace(/^\uFEFF/, "").trim();
  if (!s) return null;

  s = s.replace(/\u2212/g, "-");

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  s = s.replace(/€|\beur\b/gi, "").trim();

  const trimmedSign = s.replace(/^[-+]\s*/, (m) => {
    if (m.includes("-")) negative = true;
    return "";
  });

  s = trimmedSign;
  // Remove all unicode spaces / thin spaces used as thousands separators
  s = s.replace(/[\s\u00A0\u202F]/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > lastDot) {
    // Decimal comma (EU): strip dots as thousands, comma → dot
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Decimal dot: strip commas as thousands
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Normalize to YYYY-MM-DD; accepts ISO, DD/MM/YYYY, DD-MM-YYYY; strips time (Qonto: DD-MM-YYYY HH:mm:ss). */
export function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();
  const datePart = trimmed.split(/\s|T+/)[0]?.trim() ?? trimmed;

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;

  const m = datePart.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

type AmountSource =
  | { kind: "single"; idx: number }
  | { kind: "split"; debitIdx: number; creditIdx: number };

type ColumnMapping = {
  dateIdx: number;
  labelIdx: number;
  /** Extra columns tried when primary label cell is empty (e.g. Qonto Référence). */
  labelFallbackIdxs: number[];
  amountSource: AmountSource;
  categoryIdx: number | null;
  companyIdx: number | null;
  /** Optional « Solde / Balance » column index, distinct from amount column when present. */
  balanceIdx: number | null;
};

function firstMatchingColumnIndex(headersNorm: string[], patterns: RegExp[]): number {
  for (const re of patterns) {
    const idx = headersNorm.findIndex((h) => re.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function buildColumnMapping(headersRaw: string[]): ColumnMapping | null {
  const headersNorm = headersRaw.map((h) => normalizeHeaderKey(h));

  const dateIdx = firstMatchingColumnIndex(headersNorm, [
    /^date$/,
    /^date operation$/,
    /^date d operation$/,
    /^operation date$/,
    /^booking date$/,
    /^value date$/,
    /^settlement date$/,
    /date.*operation/,
    /operation.*date/,
    /date.*valeur/,
    /valeur.*date/
  ]);

  const labelIdx = firstMatchingColumnIndex(headersNorm, [
    /^label$/,
    /^description$/,
    /^libelle$/,
    /^libell/,
    /contrepartie/,
    /^nom de la contrepartie$/,
    /^wording$/,
    /^detail$/,
    /^memo$/,
    /^note$/,
    /^counterparty$/,
    /^merchant$/,
    /^reference$/
  ]);

  const amountIdx = firstMatchingColumnIndex(headersNorm, [
    /^montant$/,
    /^montant total$/,
    /^montant total ttc$/,
    /^amount$/,
    /^value$/,
    /^montant\b/,
    /^amount\b/,
    /^total$/,
    /^solde$/,
    /^balance$/
  ]);

  const debitIdx = firstMatchingColumnIndex(headersNorm, [
    /^debit$/,
    /^debits?$/,
    /^montant debit$/,
    /^amount debit$/
  ]);

  const creditIdx = firstMatchingColumnIndex(headersNorm, [
    /^credit$/,
    /^credits?$/,
    /^montant credit$/,
    /^amount credit$/
  ]);

  const categoryIdxRaw = firstMatchingColumnIndex(headersNorm, [
    /^categorie de tresorerie$/,
    /categorie.*tresorerie/,
    /^sous categorie de tresorerie$/,
    /sous categorie.*tresorerie/,
    /^category$/,
    /^categorie$/,
    /^type$/,
    /^tags?$/
  ]);

  const companyIdxRaw = firstMatchingColumnIndex(headersNorm, [
    /^nom du compte$/,
    /^account name$/,
    /^nom societe$/,
    /^nom de la societe$/,
    /^company$/,
    /^societe$/,
    /^entity$/,
    /^entite$/
  ]);

  const referenceIdx = firstMatchingColumnIndex(headersNorm, [/^reference$/]);
  const noteColIdx = firstMatchingColumnIndex(headersNorm, [/^note$/]);
  const txnIdIdx = firstMatchingColumnIndex(headersNorm, [/identifiant.*transaction/]);

  const labelFallbackIdxs = [referenceIdx, noteColIdx, txnIdIdx].filter(
    (i): i is number => i >= 0 && i !== labelIdx
  );

  let amountSource: AmountSource | null = null;
  if (amountIdx !== -1) {
    amountSource = { kind: "single", idx: amountIdx };
  } else if (debitIdx !== -1 && creditIdx !== -1 && debitIdx !== creditIdx) {
    amountSource = { kind: "split", debitIdx, creditIdx };
  }

  if (dateIdx === -1 || labelIdx === -1 || !amountSource) {
    return null;
  }

  const balanceIdxRaw = firstMatchingColumnIndex(headersNorm, [
    /^solde$/,
    /^solde du compte$/,
    /^balance$/,
    /^running balance$/,
    /solde.*compte/,
    /balance.*after/
  ]);
  const usedAmountIdxs = new Set<number>();
  if (amountSource.kind === "single") usedAmountIdxs.add(amountSource.idx);
  else {
    usedAmountIdxs.add(amountSource.debitIdx);
    usedAmountIdxs.add(amountSource.creditIdx);
  }
  const balanceIdx =
    balanceIdxRaw !== -1 && !usedAmountIdxs.has(balanceIdxRaw) ? balanceIdxRaw : null;

  return {
    dateIdx,
    labelIdx,
    labelFallbackIdxs,
    amountSource,
    categoryIdx: categoryIdxRaw === -1 ? null : categoryIdxRaw,
    companyIdx: companyIdxRaw === -1 ? null : companyIdxRaw,
    balanceIdx
  };
}

function rowValues(row: Record<string, unknown>, headersRaw: string[]): string[] {
  return headersRaw.map((h) => {
    const v = row[h];
    if (v == null) return "";
    return String(v);
  });
}

export function parseBankCsv(text: string): CsvParseResult {
  const stripped = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(stripped);

  const parsed = Papa.parse<Record<string, string>>(stripped, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^\uFEFF/, "")
  });

  const blockingErrors = parsed.errors.filter(
    (e) => e.code !== "TooManyFields" && e.code !== "TooFewFields" && e.code !== "UndetectableDelimiter"
  );
  if (blockingErrors.length && !(parsed.data?.length ?? 0)) {
    return { ok: false, error: blockingErrors[0]?.message ?? "Unable to parse CSV." };
  }

  const headersRaw = (parsed.meta.fields ?? []).filter(Boolean);
  if (!headersRaw.length) {
    return { ok: false, error: "Invalid CSV format. Missing header row." };
  }

  const mapping = buildColumnMapping(headersRaw);
  if (!mapping) {
    return {
      ok: false,
      error:
        "Invalid CSV format. Could not find required columns for date, label, and amount (map labels like Date / Libellé / Montant)."
    };
  }

  const format = detectCsvFormat(delimiter, headersRaw);
  const warnings: string[] = [];
  if (format === "qonto") {
    warnings.push("Detected Qonto-style CSV (delimiter / headers).");
  } else {
    warnings.push("Detected generic CSV (date / label / amount).");
  }

  const rowsIn = parsed.data ?? [];
  if (!rowsIn.length) {
    return { ok: false, error: "Invalid CSV format. No data rows found." };
  }

  const out: NormalizedImportRow[] = [];

  for (let idx = 0; idx < rowsIn.length; idx++) {
    const record = rowsIn[idx] ?? {};
    const cells = rowValues(record as Record<string, unknown>, headersRaw);

    const dateRaw = cells[mapping.dateIdx] ?? "";
    let label = (cells[mapping.labelIdx] ?? "").trim();
    for (const fi of mapping.labelFallbackIdxs) {
      if (!label) label = (cells[fi] ?? "").trim();
    }
    if (!label) label = "Sans libellé";

    let amountNum: number | null = null;
    if (mapping.amountSource.kind === "split") {
      const debitVal = parseFrenchAmount(cells[mapping.amountSource.debitIdx] ?? "") ?? 0;
      const creditVal = parseFrenchAmount(cells[mapping.amountSource.creditIdx] ?? "") ?? 0;
      amountNum = creditVal - debitVal;
    } else {
      amountNum = parseFrenchAmount(cells[mapping.amountSource.idx] ?? "");
    }

    const categoryRaw =
      mapping.categoryIdx != null ? (cells[mapping.categoryIdx] ?? "").trim() : "";

    const companyRaw =
      mapping.companyIdx != null ? (cells[mapping.companyIdx] ?? "").trim() : "";

    const date = parseFlexibleDate(dateRaw);
    const category = categoryRaw.length > 0 ? categoryRaw : DEFAULT_CATEGORY;

    // For Qonto-format imports, make sure the row is recognisable as Qonto
    // even when the CSV has no "Nom du compte" column (or it's empty).
    // If the user did set a meaningful account label (e.g. "DigitPro SASU"),
    // keep it but suffix with "(Qonto)" so downstream filters still work.
    let company = companyRaw;
    if (format === "qonto") {
      if (!company) {
        company = "Qonto";
      } else if (!/qonto/i.test(company)) {
        company = `${company} (Qonto)`;
      }
    }

    let balance: number | null = null;
    if (mapping.balanceIdx != null) {
      const raw = (cells[mapping.balanceIdx] ?? "").trim();
      if (raw) {
        const parsed = parseFrenchAmount(raw);
        balance = parsed != null && Number.isFinite(parsed) ? parsed : null;
      }
    }

    if (!date || !label || amountNum === null || !Number.isFinite(amountNum)) {
      return {
        ok: false,
        error: `Invalid CSV format: row ${idx + 2} must have a valid date, label, and amount.`
      };
    }

    out.push({ date, label, category, amount: amountNum, balance, company });
  }

  return {
    ok: true,
    format,
    delimiter,
    rows: out,
    warnings
  };
}
