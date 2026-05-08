/**
 * Single source of truth for which transactions are tied to the primary
 * banking account (Qonto). Used to compute "Cash available" — the latest
 * known balance from Qonto, ignoring side accounts / paper entries.
 *
 * The match is permissive (case-insensitive substring) so all common
 * variants are recognised: "Qonto", "QONTO Pro", "Qonto SASU", "qonto",
 * etc.
 */
export const PRIMARY_BANK_LABEL = "Qonto";

const PRIMARY_BANK_RE = /qonto/i;

export function isPrimaryBankCompany(company: string | null | undefined): boolean {
  if (!company) return false;
  return PRIMARY_BANK_RE.test(company);
}
