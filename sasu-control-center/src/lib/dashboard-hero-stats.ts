import { computeLatestQontoBalanceEur } from "@/lib/bank";
import {
  computeMetricsFromTransactions,
  filterDashboardTransactions,
  type DashboardTx
} from "@/lib/dashboard-metrics";

export type DashboardHeroStats = {
  /**
   * Encaissements « Chiffre d’affaires » TTC sur le **dernier mois** de la fenêtre 12 mois glissants
   * (même clé mois et mêmes règles de date analytique que le graphique / carte revenus du dashboard).
   */
  caMensuelEur: number;
  /** Dernier solde compte (colonne balance import Qonto), périmètre pro. */
  soldeQontoEur: number | null;
  /**
   * Dépenses TTC du **même mois** : même agrégation que la carte « Total expenses » (sorties hors BNC et TVA),
   * périmètre SASU, sur les transactions incluses dans la fenêtre 12 mois glissants.
   */
  depensesQontoSasuMoisEur: number;
  /** Affichage indicatif — le TJM réel des jours facturables vient des réglages / Supabase. */
  tjmAfficheEur: number;
};

/**
 * KPIs du hero : dernier mois de la série « 12 mois glissants » (aligné `last12MonthsKeys` + `computeMetricsFromTransactions`),
 * périmètre SASU (`scope` pro) après le même filtre fenêtre que le tableau de bord.
 */
export function computeDashboardHeroStats(transactions: DashboardTx[], now = new Date()): DashboardHeroStats {
  const proTxs = transactions.filter((t) => (t.scope ?? "pro") === "pro");
  const windowed = filterDashboardTransactions(proTxs, { years: null }, now);
  const monthly = computeMetricsFromTransactions(windowed, now);
  const last = monthly.length ? monthly[monthly.length - 1]! : { month: "", revenue: 0, expenses: 0 };

  return {
    caMensuelEur: last.revenue,
    soldeQontoEur: computeLatestQontoBalanceEur(transactions, "pro"),
    depensesQontoSasuMoisEur: last.expenses,
    tjmAfficheEur: 620
  };
}
