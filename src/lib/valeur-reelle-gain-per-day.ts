import { computeTjmWorkdayGauge } from "@/lib/billable-calendar-metrics";
import {
  BILLABLE_CLIENT_TJM_HT,
  resolveBillableTjmForClientMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";
import { dashboardMonthKeyNowLocal } from "@/lib/dashboard-period";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  analyzeValeurReelle,
  type ValeurReelleCashTree
} from "@/lib/valeur-reelle-analyze";

export type GainPerWorkDayEstimate = {
  gainPerDayEur: number;
  /** Jours ouvrés cochés du mois courant — dénominateur du gain moyen estimé. */
  workedDays: number;
  /** Clé `YYYY-MM` du mois passé utilisé pour le gain moyen. */
  gainAverageMonthKey: string;
  /** Jours ouvrés cochés jusqu'à aujourd'hui dans le mois en cours. */
  currentMonthWorkedDays: number;
  /** Gain total estimé (BNC + frais perso) sur la base historique + mois partiel. */
  estimatedGainEur: number;
  /** Indique si une part de l'estimation provient de l'historique (pas seulement le réalisé). */
  usesHistoricalEstimate: boolean;
};

function gainEurFromCashTree(tree: ValeurReelleCashTree): number {
  return Math.max(0, tree.bncEur + tree.personalChargesEur);
}

function capGainToCa(gainEur: number, caHtEur: number): number {
  if (caHtEur <= 0) return Math.max(0, gainEur);
  return Math.min(Math.max(0, gainEur), caHtEur);
}

/**
 * Le gain de l'activité ne peut pas dépasser le CA HT généré par jour.
 * Les remboursements de frais ou sorties BNC peuvent être décalés dans le temps :
 * ils restent visibles dans le cash disponible, mais ne gonflent pas le gain/jour.
 */
export function computeCappedGainPerWorkDay(
  gainEur: number,
  caHtEur: number,
  workedDays: number
): number {
  if (!Number.isFinite(workedDays) || workedDays <= 0) return 0;
  const gainPerDay = Math.max(0, gainEur) / workedDays;
  const caHtPerDay = caHtEur > 0 ? caHtEur / workedDays : null;
  const bounded = caHtPerDay == null ? gainPerDay : Math.min(gainPerDay, caHtPerDay);
  return Math.round(bounded * 100) / 100;
}

function workedBillableDaysInMonth(
  selected: ReadonlySet<string>,
  monthKey: string,
  refDate: Date
): number {
  const y = Number(monthKey.slice(0, 4));
  const month0 = Number(monthKey.slice(5, 7)) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(month0)) return 0;
  return computeTjmWorkdayGauge(selected, y, month0, refDate).countedBillable;
}

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const cursor = new Date(y, m - 2, 1);
  return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
}

/** Mois civils passés (hors mois en cours), les plus récents en premier. */
function listPastMonthKeys(now: Date, maxMonths = 12): string[] {
  const keys: string[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (let i = 0; i < maxMonths; i++) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return keys;
}

type HistoricalGainSignals = {
  marginPerCaHt: number | null;
  gainPerWorkDayEur: number | null;
  sampleWorkedDays: number;
};

function computeHistoricalGainSignals(
  transactions: readonly DashboardTx[],
  billableWorkDayIsos: ReadonlySet<string>,
  now: Date
): HistoricalGainSignals {
  let marginWeighted = 0;
  let marginWeight = 0;
  let gainSum = 0;
  let workedDaysSum = 0;

  for (const monthKey of listPastMonthKeys(now)) {
    const analysis = analyzeValeurReelle(transactions, { years: null, month: monthKey, now });
    const caHt = analysis.cashTree.caFactureEur;
    const gain = capGainToCa(gainEurFromCashTree(analysis.cashTree), caHt);
    const workedDays = workedBillableDaysInMonth(billableWorkDayIsos, monthKey, now);
    if (workedDays <= 0 || gain <= 0) continue;

    gainSum += gain;
    workedDaysSum += workedDays;
    if (caHt > 0) {
      marginWeighted += (gain / caHt) * workedDays;
      marginWeight += workedDays;
    }
  }

  return {
    marginPerCaHt: marginWeight > 0 ? marginWeighted / marginWeight : null,
    gainPerWorkDayEur: workedDaysSum > 0 ? gainSum / workedDaysSum : null,
    sampleWorkedDays: workedDaysSum
  };
}

/**
 * Mois en cours : gain / jour estimé à partir du réalisé partiel, du CA HT du mois
 * et du rythme historique (BNC + frais perso par jour ouvré coché).
 */
export function estimateCurrentMonthGainPerWorkDay(
  transactions: readonly DashboardTx[],
  cashTree: ValeurReelleCashTree,
  billableWorkDayIsos: ReadonlySet<string>,
  monthKey: string,
  now = new Date()
): GainPerWorkDayEstimate | null {
  if (monthKey !== dashboardMonthKeyNowLocal(now)) return null;

  const currentMonthWorkedDays = workedBillableDaysInMonth(billableWorkDayIsos, monthKey, now);
  const gainAverageMonthKey = previousMonthKey(monthKey);
  const previousMonthWorkedDays = workedBillableDaysInMonth(
    billableWorkDayIsos,
    gainAverageMonthKey,
    now
  );
  const gainAverageWorkedDays =
    currentMonthWorkedDays > 0 ? currentMonthWorkedDays : previousMonthWorkedDays;

  const actualGain = gainEurFromCashTree(cashTree);
  const caHt = cashTree.caFactureEur;
  const history = computeHistoricalGainSignals(transactions, billableWorkDayIsos, now);

  let estimatedGain = actualGain;
  let usesHistoricalEstimate = false;

  if (history.marginPerCaHt != null && caHt > 0) {
    const fromCa = Math.round(caHt * Math.min(1, history.marginPerCaHt) * 100) / 100;
    if (fromCa > estimatedGain) {
      estimatedGain = fromCa;
      usesHistoricalEstimate = true;
    }
  } else if (history.gainPerWorkDayEur != null && currentMonthWorkedDays > 0) {
    const fromHistory = Math.round(history.gainPerWorkDayEur * currentMonthWorkedDays * 100) / 100;
    if (fromHistory > estimatedGain) {
      estimatedGain = fromHistory;
      usesHistoricalEstimate = true;
    }
  }

  if (caHt > 0) {
    estimatedGain = Math.min(estimatedGain, caHt);
  }

  if (gainAverageWorkedDays > 0) {
    return {
      gainPerDayEur: computeCappedGainPerWorkDay(estimatedGain, caHt, gainAverageWorkedDays),
      workedDays: gainAverageWorkedDays,
      gainAverageMonthKey,
      currentMonthWorkedDays,
      estimatedGainEur: estimatedGain,
      usesHistoricalEstimate
    };
  }

  if (history.gainPerWorkDayEur != null) {
    return {
      gainPerDayEur: Math.round(history.gainPerWorkDayEur * 100) / 100,
      workedDays: 0,
      gainAverageMonthKey,
      currentMonthWorkedDays,
      estimatedGainEur: 0,
      usesHistoricalEstimate: true
    };
  }

  return null;
}

const TRAILING_GAIN_PER_DAY_MONTHS = 12;

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const cursor = new Date(y, (m ?? 1) - 1 + delta, 1);
  return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
}

function billableDaysFromCaHt(caHt: number, tjmHt: number): number {
  if (!Number.isFinite(tjmHt) || tjmHt <= 0 || caHt <= 0) return 0;
  return Math.round((caHt / tjmHt) * 10) / 10;
}

/**
 * Les jours cochés sont la source principale, mais un encaissement peut couvrir
 * davantage de jours que ceux déjà renseignés dans l'agenda. On ne doit jamais
 * diviser le gain par moins de jours que le CA le permet au TJM configuré.
 */
export function resolveWorkedDaysForGain(
  calendarWorkedDays: number,
  caHtEur: number,
  tjmHt: number
): number {
  return Math.max(Math.max(0, calendarWorkedDays), billableDaysFromCaHt(caHtEur, tjmHt));
}

function resolveGainDenominatorDays(
  transactions: readonly DashboardTx[],
  monthKey: string,
  billableWorkDayIsos: ReadonlySet<string>,
  billableRatePeriods: readonly BillableRatePeriod[],
  fallbackTjmHt: number,
  now: Date
): number {
  const analysis = analyzeValeurReelle(transactions, { years: null, month: monthKey, now });
  const tjmHt = resolveBillableTjmForClientMonth(
    billableRatePeriods,
    billableRatePeriods[0]?.clientName ?? "",
    monthKey,
    fallbackTjmHt
  );
  const calendarWorkedDays = workedBillableDaysInMonth(billableWorkDayIsos, monthKey, now);
  return resolveWorkedDaysForGain(calendarWorkedDays, analysis.cashTree.caFactureEur, tjmHt);
}

function gainPerDayForMonth(
  transactions: readonly DashboardTx[],
  monthKey: string,
  billableWorkDayIsos: ReadonlySet<string>,
  billableRatePeriods: readonly BillableRatePeriod[],
  fallbackTjmHt: number,
  now: Date
): number {
  const analysis = analyzeValeurReelle(transactions, { years: null, month: monthKey, now });
  const estimate =
    monthKey === dashboardMonthKeyNowLocal(now)
      ? estimateCurrentMonthGainPerWorkDay(
          transactions,
          analysis.cashTree,
          billableWorkDayIsos,
          monthKey,
          now
        )
      : null;
  if (estimate?.gainPerDayEur) return estimate.gainPerDayEur;

  const gain = gainEurFromCashTree(analysis.cashTree);
  const workedDays = resolveGainDenominatorDays(
    transactions,
    monthKey,
    billableWorkDayIsos,
    billableRatePeriods,
    fallbackTjmHt,
    now
  );
  return computeCappedGainPerWorkDay(gain, analysis.cashTree.caFactureEur, workedDays);
}

/** Point mensuel — gain moyen / jour (sparkline Cash disponible). */
export type TrailingGainPerDayPoint = {
  monthKey: string;
  monthLabel: string;
  gainPerDayEur: number;
};

function monthShortLabel(monthKey: string, includeYear = false): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const month = new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(new Date(y, m - 1, 1))
    .replace(/\.$/, "");
  return includeYear ? `${month} '${String(y).slice(-2)}` : month;
}

function monthRangeLabel(startMonthKey: string, endMonthKey: string): string {
  const [startY, startM] = startMonthKey.split("-").map(Number);
  const [endY, endM] = endMonthKey.split("-").map(Number);
  if (!startY || !startM || !endY || !endM) return "12 derniers mois";
  const fmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" });
  const start = fmt.format(new Date(startY, startM - 1, 1)).replace(/\.$/, "");
  const end = fmt.format(new Date(endY, endM - 1, 1)).replace(/\.$/, "");
  return `${start} – ${end}`;
}

/** Gain moyen / jour sur les 12 derniers mois (série pour graphique). */
export function buildTrailingGainPerWorkDayPoints(
  transactions: readonly DashboardTx[],
  billableWorkDayIsos: ReadonlySet<string>,
  endMonthKey: string = dashboardMonthKeyNowLocal(),
  months = TRAILING_GAIN_PER_DAY_MONTHS,
  now = new Date(),
  billableRatePeriods: readonly BillableRatePeriod[] = [],
  fallbackTjmHt = BILLABLE_CLIENT_TJM_HT
): TrailingGainPerDayPoint[] {
  const monthKeys = Array.from({ length: months }, (_, index) =>
    shiftMonthKey(endMonthKey, -(months - 1 - index))
  );
  const spansMultipleYears = new Set(monthKeys.map((key) => key.slice(0, 4))).size > 1;

  return monthKeys.map((monthKey) => ({
    monthKey,
    monthLabel: monthShortLabel(monthKey, spansMultipleYears),
    gainPerDayEur: gainPerDayForMonth(
      transactions,
      monthKey,
      billableWorkDayIsos,
      billableRatePeriods,
      fallbackTjmHt,
      now
    )
  }));
}

export function formatTrailingGainPerDayRange(points: readonly TrailingGainPerDayPoint[]): string {
  if (points.length < 2) return "12 derniers mois";
  return monthRangeLabel(points[0]!.monthKey, points[points.length - 1]!.monthKey);
}
