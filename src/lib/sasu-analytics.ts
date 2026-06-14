import {
  countsTowardDashboardExpenseTotal,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { dashboardSasuExpenseAmountHt } from "@/lib/recoverable-expense-vat";
import {
  resolveSasuSimplifiedExpenseGroup,
  sasuSimplifiedSubcategoryLabel
} from "@/lib/valeur-reelle-analyze";

export type SasuDonutSlice = {
  name: string;
  total: number;
  pct: number;
  dash: number;
  offset: number;
  color: string;
};

/** Palette alignée sur le dashboard (emerald, sky, violet, amber, rose). */
const SASU_DONUT_PALETTE = [
  "#34d399",
  "#38bdf8",
  "#a78bfa",
  "#fbbf24",
  "#fb7185",
  "#2dd4bf",
  "#60a5fa",
  "#f472b6"
] as const;

function sasuSliceColor(index: number): string {
  return SASU_DONUT_PALETTE[index % SASU_DONUT_PALETTE.length];
}

export function buildSasuExpenseDonutSlices(
  categories: Array<{ name: string; total: number }>,
  totalExpenses: number
): SasuDonutSlice[] {
  const total = Math.max(0, totalExpenses);
  let cursor = 0;
  return categories.map((category, index) => {
    const pct = total > 0 ? (category.total / total) * 100 : 0;
    const slice = {
      ...category,
      pct,
      dash: Math.max(0, pct - 0.8),
      offset: -cursor,
      color: sasuSliceColor(index)
    };
    cursor += pct;
    return slice;
  });
}

export function buildSasuRevenueDonutSlices(
  revenueCounterpartyTotals: Array<{ name: string; total: number }>,
  totalRevenuesHt: number,
  vatRate: number
): SasuDonutSlice[] {
  const total = Math.max(0, totalRevenuesHt);
  let cursor = 0;
  return revenueCounterpartyTotals.map(({ name, total: totalTtc }, index) => {
    const totalHt = totalTtc / (1 + vatRate);
    const pct = total > 0 ? (totalHt / total) * 100 : 0;
    const slice = {
      name,
      total: totalHt,
      pct,
      dash: Math.max(0, pct - 0.8),
      offset: -cursor,
      color: sasuSliceColor(index)
    };
    cursor += pct;
    return slice;
  });
}

export function buildSasuSimplifiedExpenseSlices(transactions: readonly DashboardTx[]): SasuDonutSlice[] {
  let digitPro = 0;
  let perso = 0;

  for (const tx of transactions) {
    if (!countsTowardDashboardExpenseTotal(tx)) continue;
    const bucket = deriveExpenseBucket(tx);
    const group = resolveSasuSimplifiedExpenseGroup(tx, bucket);
    const amount = dashboardSasuExpenseAmountHt(tx);
    if (group === "Frais DigitPro") digitPro += amount;
    else if (group === "Frais perso") perso += amount;
  }

  const total = Math.max(0, digitPro + perso);
  let cursor = 0;
  return [
    { name: "Frais DigitPro", total: digitPro, color: "#a78bfa" },
    { name: "Frais perso", total: perso, color: "#38bdf8" }
  ]
    .filter((slice) => slice.total > 0)
    .map((slice) => {
      const pct = total > 0 ? (slice.total / total) * 100 : 0;
      const out = { ...slice, pct, dash: Math.max(0, pct - 0.8), offset: -cursor };
      cursor += pct;
      return out;
    });
}

export function buildSasuSimplifiedSubcategories(
  transactions: readonly DashboardTx[]
): Record<string, Array<{ name: string; total: number }>> {
  const groups = new Map<string, Map<string, number>>();
  groups.set("Frais DigitPro", new Map());
  groups.set("Frais perso", new Map());

  for (const tx of transactions) {
    if (!countsTowardDashboardExpenseTotal(tx)) continue;
    const bucket = deriveExpenseBucket(tx);
    const group = resolveSasuSimplifiedExpenseGroup(tx, bucket);
    if (!group) continue;
    const amount = dashboardSasuExpenseAmountHt(tx);
    const label = sasuSimplifiedSubcategoryLabel(tx, bucket);
    const subcategories = groups.get(group);
    subcategories?.set(label, (subcategories.get(label) ?? 0) + amount);
  }

  return Object.fromEntries(
    Array.from(groups.entries()).map(([groupName, subcategories]) => [
      groupName,
      Array.from(subcategories.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
    ])
  ) as Record<string, Array<{ name: string; total: number }>>;
}

export function sasuSimplifiedExpenseGroup(tx: DashboardTx): "Frais DigitPro" | "Frais perso" | null {
  if (!countsTowardDashboardExpenseTotal(tx)) return null;
  const bucket = deriveExpenseBucket(tx);
  return resolveSasuSimplifiedExpenseGroup(tx, bucket);
}
