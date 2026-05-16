import type { DashboardTx } from "@/lib/dashboard-metrics";
import { transactionAnalyticsDayIso } from "@/lib/dashboard-metrics";

/** Libellé « Vue active : … » aligné sur SASU / Privé. */
export function formatDashboardPeriodLabel(selectedYears: number[] | null): string {
  if (selectedYears == null) return "12 derniers mois (fenêtre glissante)";
  if (selectedYears.length === 1) return `Année ${selectedYears[0]}`;
  const sorted = [...selectedYears].sort((a, b) => a - b);
  return `Années ${sorted.join(", ")}`;
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
