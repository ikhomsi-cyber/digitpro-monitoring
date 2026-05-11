import type { DashboardTx } from "./dashboard-metrics";
import { effectiveRevenueAnalyticsDateIso } from "./dashboard-metrics";
import { BILLABLE_CLIENT_TJM_HT } from "./billable-client-days";
import { isRevenueCategory } from "./revenue-category";

const VAT_RATE = 0.2;

export type InvoiceWorkedDayMonth = {
  /** Mois affiché sur l’axe (mois civil complet passé). */
  monthKey: string;
  label: string;
  /** Jours = CA HT du mois (M − 2) ÷ 820 €. */
  days: number;
  /** CA HT retenu pour le calcul (encaissements du mois source). */
  caHt: number;
  /** Mois dont provient la facture / les encaissements (avant-avant). */
  sourceMonthKey: string;
};

function monthKeyFromYm(y: number, month0: number): string {
  return `${y}-${String(month0 + 1).padStart(2, "0")}`;
}

function addCalendarMonths(year: number, month0: number, delta: number): { y: number; m0: number } {
  const d = new Date(year, month0 + delta, 1);
  return { y: d.getFullYear(), m0: d.getMonth() };
}

function parseMonthKey(mk: string): { y: number; m0: number } {
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(5, 7)) - 1;
  return { y, m0: m };
}

/**
 * Série pour graphique « jours travaillés » dérivés de la facturation :
 * pour chaque **mois civil complet écoulé** M (jusqu’à M−1 par rapport à aujourd’hui),
 * on prend le **CA HT encaissé du mois M − 2** (mois d’avant le précédent : avant-dernier mois avant M),
 * puis **CA HT ÷ 820 €** (TJM de référence).
 */
export function buildInvoiceWorkedDaysPastMonthsSeries(
  transactions: DashboardTx[],
  scope: "pro" | "personal",
  now = new Date(),
  maxMonths = 24
): InvoiceWorkedDayMonth[] {
  const scoped = transactions.filter((t) => (t.scope ?? "pro") === scope);

  const lastComplete = addCalendarMonths(now.getFullYear(), now.getMonth(), -1);
  const endKey = monthKeyFromYm(lastComplete.y, lastComplete.m0);

  let earliest: string | null = null;
  for (const tx of scoped) {
    if (!isRevenueCategory(tx.category) || tx.amount <= 0) continue;
    const mk = effectiveRevenueAnalyticsDateIso(tx).slice(0, 7);
    if (!earliest || mk < earliest) earliest = mk;
  }
  if (!earliest || earliest > endKey) return [];

  const windowStart = addCalendarMonths(lastComplete.y, lastComplete.m0, -(maxMonths - 1));
  let startKey = monthKeyFromYm(windowStart.y, windowStart.m0);
  if (startKey < earliest) startKey = earliest;

  const monthKeys: string[] = [];
  let cy = Number(startKey.slice(0, 4));
  let cm0 = Number(startKey.slice(5, 7)) - 1;
  const endY = lastComplete.y;
  const endM0 = lastComplete.m0;
  for (;;) {
    const key = monthKeyFromYm(cy, cm0);
    monthKeys.push(key);
    if (cy === endY && cm0 === endM0) break;
    const next = addCalendarMonths(cy, cm0, 1);
    cy = next.y;
    cm0 = next.m0;
  }

  const caTtcByMonth = new Map<string, number>();
  for (const tx of scoped) {
    if (!isRevenueCategory(tx.category)) continue;
    const mk = effectiveRevenueAnalyticsDateIso(tx).slice(0, 7);
    if (mk > endKey) continue;
    caTtcByMonth.set(mk, (caTtcByMonth.get(mk) ?? 0) + tx.amount);
  }

  const labelFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

  return monthKeys.map((mk) => {
    const { y, m0 } = parseMonthKey(mk);
    const src = addCalendarMonths(y, m0, -2);
    const sourceMonthKey = monthKeyFromYm(src.y, src.m0);
    const caTtc = caTtcByMonth.get(sourceMonthKey) ?? 0;
    const caHt = caTtc / (1 + VAT_RATE);
    const days = caHt / BILLABLE_CLIENT_TJM_HT;
    const m = Number(mk.slice(5, 7));
    const label = labelFmt.format(new Date(y, m - 1, 1));
    return {
      monthKey: mk,
      label,
      days: Math.round(days * 10) / 10,
      caHt: Math.round(caHt * 100) / 100,
      sourceMonthKey
    };
  });
}
