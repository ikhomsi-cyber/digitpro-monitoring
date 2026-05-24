export type CategorisationCandidateRow = {
  id: string;
  date: string;
  label: string | null;
  amount: number | string;
  company: string | null;
  bank_name: string | null;
};

export type CategorisationCandidateTx = {
  id: string;
  date: string;
  label: string;
  amount: number;
  company: string;
  bankName: string | null;
};

export function normalizeCategory(raw: unknown): string {
  return String(raw ?? "").trim();
}

function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function isCardPowensLabel(raw: string): boolean {
  return /\b(cb|carte|card)\b/.test(fold(raw));
}

export function isLikelyNdfDigitProCandidate(raw: string): boolean {
  const label = fold(raw);
  if (/\b(quick|domino|dominos|tacos|boucherie|boucheries|auchan|grand frais|carrefour)\b/.test(label)) {
    return false;
  }
  return /\b(repas|dejeuner|dej|restaurant|resto|brasserie|bistrot|cafe|burger|pizza|sushi|monoprix|franprix)\b/.test(label);
}

export function mapCategorisationCandidateRows(
  rows: readonly CategorisationCandidateRow[]
): CategorisationCandidateTx[] {
  return rows
    .map((row) => ({
      id: String(row.id),
      date: String(row.date).slice(0, 10),
      label: String(row.label ?? ""),
      amount: Number(row.amount),
      company: String(row.company ?? "").trim(),
      bankName: row.bank_name ? String(row.bank_name).trim() : null
    }))
    .filter((tx) => {
      const blob = `${tx.label} ${tx.company}`;
      return isCardPowensLabel(blob) && isLikelyNdfDigitProCandidate(blob);
    });
}
