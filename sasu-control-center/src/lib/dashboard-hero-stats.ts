import type { DashboardTx } from "@/lib/dashboard-metrics";

export type DashboardHeroStats = {
  caMensuelEur: number;
  cashNetMonthEur: number;
  chargesMoisEur: number;
  /** Affichage indicatif — le TJM réel des jours facturables vient des réglages / Supabase. */
  tjmAfficheEur: number;
};

/** KPIs rapides mois civil courant (scope SASU / pro uniquement). */
export function computeDashboardHeroStats(transactions: DashboardTx[]): DashboardHeroStats {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const slice = transactions.filter((t) => (t.scope ?? "pro") === "pro" && t.date.startsWith(ym));
  const revenue = slice.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const charges = slice.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);
  const cashNet = revenue - charges;
  return {
    caMensuelEur: revenue,
    cashNetMonthEur: cashNet,
    chargesMoisEur: charges,
    tjmAfficheEur: 620
  };
}
