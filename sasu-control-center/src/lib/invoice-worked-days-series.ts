import type { DashboardTx } from "./dashboard-metrics";
import { effectiveRevenueAnalyticsDateIso } from "./dashboard-metrics";
import { countAgendaWorkDaysInMonth } from "./billable-calendar-metrics";
import { BILLABLE_CLIENT_TJM_HT } from "./billable-client-days";
import { isRevenueCategory } from "./revenue-category";

const VAT_RATE = 0.2;

/** Premier mois affiché sur l’axe du graphique « Jours facturés » (mois-barre B, format YYYY-MM). */
export const INVOICE_WORKED_DAYS_FIRST_BAR_MONTH_KEY = "2022-10";

export type InvoiceWorkedDayKind = "encaisse" | "deja_facture" | "a_facturer";

export type InvoiceWorkedDayMonth = {
  /** Mois sur l’axe du graphique (mois « décalé » : la barre est placée 2 mois avant l’encaissement CA). */
  monthKey: string;
  label: string;
  /** Jours = CA HT du mois d’encaissement (mois barre + 2) ÷ 820 €. */
  days: number;
  /** CA HT retenu pour le calcul (encaissements du mois source). */
  caHt: number;
  /** Mois d’encaissement du CA (deux mois après le mois de la barre). */
  sourceMonthKey: string;
  kind: InvoiceWorkedDayKind;
};

export function monthKeyFromYm(y: number, month0: number): string {
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
 * Série pour le graphique « Jours facturés » :
 * pour chaque mois civil **B** affiché sur l’axe, la hauteur de la barre vient du **CA HT encaissé
 * en B + 2** (ex. encaissements avril → barre en février), puis **CA HT ÷ 820 €** (TJM de référence).
 * Les encaissements sont pris jusqu’au **mois civil en cours** (inclut le mois partiel en cours).
 * L’axe commence au plus tôt en **`INVOICE_WORKED_DAYS_FIRST_BAR_MONTH_KEY`** (oct. 2022).
 * Passez `maxMonths` pour limiter en plus aux N derniers mois-barres (lisibilité).
 */
export function buildInvoiceWorkedDaysPastMonthsSeries(
  transactions: DashboardTx[],
  scope: "pro" | "personal",
  now = new Date(),
  /** Si défini et strictement positif : au plus ce nombre de mois-barres ; sinon tout l’historique. */
  maxMonths?: number
): InvoiceWorkedDayMonth[] {
  const scoped = transactions.filter((t) => (t.scope ?? "pro") === scope);

  /** Dernier mois d’encaissement pris en compte (mois calendaire courant, y compris partiel). */
  const end = { y: now.getFullYear(), m0: now.getMonth() };
  const endKey = monthKeyFromYm(end.y, end.m0);

  let earliestEnc: string | null = null;
  for (const tx of scoped) {
    if (!isRevenueCategory(tx.category) || tx.amount <= 0) continue;
    const mk = effectiveRevenueAnalyticsDateIso(tx).slice(0, 7);
    if (!earliestEnc || mk < earliestEnc) earliestEnc = mk;
  }
  if (!earliestEnc || earliestEnc > endKey) return [];

  /** Dernier mois B pour lequel B+2 ≤ mois courant (encaissements connus jusqu’à ce mois). */
  const lastBar = addCalendarMonths(end.y, end.m0, -2);
  const lastBarKey = monthKeyFromYm(lastBar.y, lastBar.m0);

  /** Premier mois B pour lequel on a au moins un encaissement en B+2. */
  const ep = parseMonthKey(earliestEnc);
  const firstBarFromData = addCalendarMonths(ep.y, ep.m0, -2);
  const firstBarKey = monthKeyFromYm(firstBarFromData.y, firstBarFromData.m0);

  const lastBarParsed = parseMonthKey(lastBarKey);
  let startKey: string;
  if (maxMonths != null && maxMonths > 0) {
    const windowBack = addCalendarMonths(lastBarParsed.y, lastBarParsed.m0, -(maxMonths - 1));
    startKey = monthKeyFromYm(windowBack.y, windowBack.m0);
    if (startKey < firstBarKey) startKey = firstBarKey;
  } else {
    startKey = firstBarKey;
  }

  if (startKey < INVOICE_WORKED_DAYS_FIRST_BAR_MONTH_KEY) {
    startKey = INVOICE_WORKED_DAYS_FIRST_BAR_MONTH_KEY;
  }

  if (startKey > lastBarKey) return [];

  const caTtcByMonth = new Map<string, number>();
  for (const tx of scoped) {
    if (!isRevenueCategory(tx.category)) continue;
    const mk = effectiveRevenueAnalyticsDateIso(tx).slice(0, 7);
    if (mk > endKey) continue;
    caTtcByMonth.set(mk, (caTtcByMonth.get(mk) ?? 0) + tx.amount);
  }

  const labelFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

  const monthKeys: string[] = [];
  let cy = Number(startKey.slice(0, 4));
  let cm0 = Number(startKey.slice(5, 7)) - 1;
  const endY = Number(lastBarKey.slice(0, 4));
  const endM0 = Number(lastBarKey.slice(5, 7)) - 1;
  for (;;) {
    const key = monthKeyFromYm(cy, cm0);
    monthKeys.push(key);
    if (cy === endY && cm0 === endM0) break;
    const next = addCalendarMonths(cy, cm0, 1);
    cy = next.y;
    cm0 = next.m0;
  }

  return monthKeys.map((mk) => {
    const { y, m0 } = parseMonthKey(mk);
    const src = addCalendarMonths(y, m0, 2);
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
      sourceMonthKey,
      kind: "encaisse"
    };
  });
}

const chartLabelFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

function agendaMonthBar(
  year: number,
  month0: number,
  days: number,
  tjmHt: number,
  kind: "deja_facture" | "a_facturer"
): InvoiceWorkedDayMonth {
  const monthKey = monthKeyFromYm(year, month0);
  const caHt = Math.round(days * tjmHt * 100) / 100;
  return {
    monthKey,
    label: chartLabelFmt.format(new Date(year, month0, 1)),
    days: Math.round(days * 10) / 10,
    caHt,
    sourceMonthKey: monthKey,
    kind
  };
}

/** Ajoute les barres agenda (mois dernier + mois en cours) après la série encaissée. */
export function appendAgendaWorkedDayMonths(
  encaisseRows: readonly InvoiceWorkedDayMonth[],
  selected: ReadonlySet<string>,
  tjmHt: number,
  refDate = new Date()
): InvoiceWorkedDayMonth[] {
  const base = encaisseRows.map((r) => ({ ...r, kind: r.kind ?? ("encaisse" as const) }));
  const existingKeys = new Set(base.map((r) => r.monthKey));

  const cy = refDate.getFullYear();
  const cm0 = refDate.getMonth();
  const last =
    cm0 === 0 ? { y: cy - 1, m0: 11 } : { y: cy, m0: cm0 - 1 };

  const extras: InvoiceWorkedDayMonth[] = [];

  const lastKey = monthKeyFromYm(last.y, last.m0);
  if (!existingKeys.has(lastKey)) {
    const days = countAgendaWorkDaysInMonth(selected, last.y, last.m0, refDate);
    extras.push(agendaMonthBar(last.y, last.m0, days, tjmHt, "deja_facture"));
  }

  const currentKey = monthKeyFromYm(cy, cm0);
  if (!existingKeys.has(currentKey)) {
    const days = countAgendaWorkDaysInMonth(selected, cy, cm0, refDate);
    extras.push(agendaMonthBar(cy, cm0, days, tjmHt, "a_facturer"));
  }

  return [...base, ...extras].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}
