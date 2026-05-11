import type { DashboardTx } from "./dashboard-metrics";
import { isRevenueCategory } from "./revenue-category";

function fold(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dates analytiques **forcées** pour certains encaissements CA (la date en base ne change pas).
 * S’applique avant la règle « jour &gt; 26 → 1er jour du mois suivant ».
 *
 * Éditer ici si les libellés bancaires diffèrent (Qonto / LCL / CSV).
 */
export function revenueAnalyticsDateOverride(
  tx: Pick<DashboardTx, "id" | "date" | "label" | "category" | "amount">
): string | null {
  if (!isRevenueCategory(tx.category) || tx.amount <= 0) return null;

  const b = fold(tx.label);
  const d = tx.date;

  // --- Syrtals · fin décembre 2025 ---
  // Jours 27+ : sans override, la règle globale pousserait l’encaissement en janvier ; on le garde en déc. 2025.
  // Les encaissements de janvier 2026 restent sur leur mois (pas de rattachement forcé à décembre).
  if (b.includes("syrtals") && d >= "2025-12-28" && d <= "2025-12-31") {
    return "2025-12-31";
  }

  // --- Août 2024 · deux encaissements CA en fin de mois (tous deux basculés en sept.) ---
  // Skylab → rester en août 2024, Syrtals → septembre 2024 (inverser si besoin selon vos relevés).
  if (d.startsWith("2024-08") && d >= "2024-08-28") {
    if (b.includes("skylab")) return "2024-08-30";
    if (b.includes("syrtals")) return "2024-09-02";
  }

  return null;
}
