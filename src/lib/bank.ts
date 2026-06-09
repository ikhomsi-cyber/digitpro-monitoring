import type { DashboardTx } from "@/lib/dashboard-metrics";

/**
 * Single source of truth for which transactions are tied to the primary
 * banking account (Qonto). Used to compute the dashboard "Solde Qonto" KPI — the latest
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

/**
 * Solde Qonto pour le dashboard : priorité au solde live API, sinon repli sur la dernière
 * colonne `balance` des transactions importées / synchronisées.
 */
export function resolveQontoBalanceEur(
  transactions: readonly DashboardTx[],
  liveBalanceEur: number | null | undefined,
  scope: "pro" | "personal" = "pro"
): number | null {
  if (liveBalanceEur != null && Number.isFinite(liveBalanceEur)) {
    return Math.round(liveBalanceEur * 100) / 100;
  }
  return computeLatestQontoBalanceEur(transactions, scope);
}

/**
 * Dernier solde connu issu des transactions (colonne `balance` à l’import Qonto / sync).
 * Priorité aux lignes dont `company` matche Qonto ; sinon dernière ligne avec solde sur le périmètre.
 */
export function computeLatestQontoBalanceEur(
  transactions: readonly DashboardTx[],
  scope: "pro" | "personal" = "pro"
): number | null {
  const scoped = transactions.filter((t) => (t.scope ?? "pro") === scope);

  function pickLatest(rows: DashboardTx[]): number | null {
    const withBal = rows.filter(
      (t) => t.balance != null && Number.isFinite(Number(t.balance))
    );
    if (!withBal.length) return null;
    const sorted = [...withBal].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)
    );
    return Number(sorted[0]!.balance);
  }

  const qontoScoped = scoped.filter((t) => isPrimaryBankCompany(t.company));
  const fromQonto = pickLatest(qontoScoped);
  if (fromQonto != null) return fromQonto;
  return pickLatest(scoped);
}
