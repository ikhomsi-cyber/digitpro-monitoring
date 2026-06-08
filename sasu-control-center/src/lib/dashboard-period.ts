import type { DashboardTx } from "@/lib/dashboard-metrics";
import { transactionAnalyticsDayIso } from "@/lib/dashboard-metrics";

/** Libellé « Vue active : … » aligné sur SASU / Privé. */
export function formatDashboardPeriodLabel(selectedYears: number[] | null): string {
  if (selectedYears == null) return "12 derniers mois (fenêtre glissante)";
  if (selectedYears.length === 1) return `Année ${selectedYears[0]}`;
  const sorted = [...selectedYears].sort((a, b) => a - b);
  return `Années ${sorted.join(", ")}`;
}

export function formatDashboardMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year || 2000, (month || 1) - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

export function formatDashboardPeriodLabelWithMonth(
  selectedYears: number[] | null,
  selectedMonth: string | null
): string {
  if (selectedMonth) return formatDashboardMonthLabel(selectedMonth);
  return formatDashboardPeriodLabel(selectedYears);
}

export function buildDashboardYearOptions(
  transactionYearBounds: { minYear: number; maxYear: number } | null,
  transactions: readonly DashboardTx[]
): number[] {
  if (transactionYearBounds) {
    const { minYear, maxYear } = transactionYearBounds;
    if (Number.isFinite(minYear) && Number.isFinite(maxYear) && minYear <= maxYear) {
      const out: number[] = [];
      for (let y = maxYear; y >= minYear; y--) out.push(y);
      return out;
    }
  }
  const ys = new Set<number>();
  for (const tx of transactions) {
    const y = Number(transactionAnalyticsDayIso(tx).slice(0, 4));
    if (Number.isFinite(y)) ys.add(y);
  }
  return Array.from(ys).sort((a, b) => b - a);
}

export function buildDashboardMonthOptions(
  transactionYearBounds: { minYear: number; maxYear: number } | null,
  transactions: readonly DashboardTx[]
): string[] {
  const months = new Set<string>();
  for (const tx of transactions) {
    months.add(transactionAnalyticsDayIso(tx).slice(0, 7));
  }
  if (transactionYearBounds) {
    const { minYear, maxYear } = transactionYearBounds;
    if (Number.isFinite(minYear) && Number.isFinite(maxYear) && minYear <= maxYear) {
      const now = new Date();
      const maxMonth =
        maxYear >= now.getFullYear()
          ? now.getMonth() + 1
          : 12;
      for (let year = minYear; year <= maxYear; year++) {
        const upperMonth = year === maxYear ? maxMonth : 12;
        for (let month = 1; month <= upperMonth; month++) {
          months.add(`${year}-${String(month).padStart(2, "0")}`);
        }
      }
    }
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

export function toggleDashboardYearInFilter(
  y: number,
  yearOptions: number[]
): (prev: number[] | null) => number[] | null {
  return (prev) => {
    const base = prev ?? [yearOptions[0] ?? new Date().getFullYear()];
    const next = new Set(base);
    if (next.has(y)) {
      if (next.size <= 1) return prev;
      next.delete(y);
    } else {
      next.add(y);
    }
    return Array.from(next).sort((a, b) => b - a);
  };
}

/** Mois civil courant (YYYY-MM), fuseau local. */
export function dashboardMonthKeyNowLocal(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Filtre par défaut : mois civil en cours (toutes les pages avec fenêtre d’analyse). */
export function defaultDashboardPeriodFilter(now = new Date()): {
  selectedMonth: string;
  selectedYears: number[];
} {
  return {
    selectedMonth: dashboardMonthKeyNowLocal(now),
    selectedYears: [now.getFullYear()]
  };
}

/** Jours civils écoulés dans le mois (1 → jour courant inclus), uniquement si `monthKey` est le mois en cours. */
export function calendarDaysElapsedInCurrentMonth(monthKey: string | null, now = new Date()): number | null {
  if (!monthKey || monthKey !== dashboardMonthKeyNowLocal(now)) return null;
  const day = now.getDate();
  return day > 0 ? day : null;
}
