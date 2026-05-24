import {
  expenseDashboardGroupingLabel,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import {
  isValeurReelleMandatoryFeeLine,
  isValeurReellePersonalChargeLine
} from "@/lib/valeur-reelle-analyze";

export type SasuDonutSlice = {
  name: string;
  total: number;
  pct: number;
  dash: number;
  offset: number;
  color: string;
};

const SASU_DONUT_PALETTE = [
  "#4f7eea",
  "#ff8733",
  "#8332c2",
  "#ffb515",
  "#4f7eea",
  "#ffa66d",
  "#11c7cb",
  "#f72b68"
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
    if (tx.amount >= 0) continue;
    const bucket = deriveExpenseBucket(tx);
    const amount = Math.abs(tx.amount);
    if (isValeurReelleMandatoryFeeLine(tx, bucket)) digitPro += amount;
    if (isValeurReellePersonalChargeLine(bucket)) perso += amount;
  }

  const total = Math.max(0, digitPro + perso);
  let cursor = 0;
  return [
    { name: "Frais DigitPro", total: digitPro, color: "#ff8733" },
    { name: "Frais perso", total: perso, color: "#11c7cb" }
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
  transactions: readonly DashboardTx[],
  kpiMode: "personal" | "sasu"
): Record<string, Array<{ name: string; total: number }>> {
  const groups = new Map<string, Map<string, number>>();
  groups.set("Frais DigitPro", new Map());
  groups.set("Frais perso", new Map());

  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const bucket = deriveExpenseBucket(tx);
    const amount = Math.abs(tx.amount);
    const label = bucket ?? expenseDashboardGroupingLabel(tx, kpiMode);

    if (isValeurReelleMandatoryFeeLine(tx, bucket)) {
      const digitPro = groups.get("Frais DigitPro");
      digitPro?.set(label, (digitPro.get(label) ?? 0) + amount);
    }

    if (isValeurReellePersonalChargeLine(bucket)) {
      const perso = groups.get("Frais perso");
      perso?.set(label, (perso.get(label) ?? 0) + amount);
    }
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
  if (tx.amount >= 0) return null;
  const bucket = deriveExpenseBucket(tx);
  if (isValeurReelleMandatoryFeeLine(tx, bucket)) return "Frais DigitPro";
  if (isValeurReellePersonalChargeLine(bucket)) return "Frais perso";
  return null;
}
