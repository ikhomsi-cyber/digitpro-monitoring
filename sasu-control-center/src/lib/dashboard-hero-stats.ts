import { computeLatestQontoBalanceEur, isPrimaryBankCompany } from "@/lib/bank";
import type { DashboardTx } from "@/lib/dashboard-metrics";

export type DashboardHeroStats = {
  caMensuelEur: number;
  /** Dernier solde compte (colonne balance import Qonto), périmètre pro. */
  soldeQontoEur: number | null;
  /** Somme des dépenses du mois civil courant, transactions SASU dont le compte est Qonto. */
  depensesQontoSasuMoisEur: number;
  /** Affichage indicatif — le TJM réel des jours facturables vient des réglages / Supabase. */
  tjmAfficheEur: number;
};

/** KPIs rapides mois civil courant (scope SASU / pro uniquement). */
export function computeDashboardHeroStats(transactions: DashboardTx[]): DashboardHeroStats {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const slice = transactions.filter((t) => (t.scope ?? "pro") === "pro" && t.date.startsWith(ym));
  const revenue = slice.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const depensesQontoSasuMois = slice
    .filter((t) => t.amount < 0 && isPrimaryBankCompany(t.company))
    .reduce((a, t) => a + Math.abs(t.amount), 0);
  return {
    caMensuelEur: revenue,
    soldeQontoEur: computeLatestQontoBalanceEur(transactions, "pro"),
    depensesQontoSasuMoisEur: depensesQontoSasuMois,
    tjmAfficheEur: 620
  };
}
