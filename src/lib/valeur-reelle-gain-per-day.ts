import { computeTjmWorkdayGauge } from "@/lib/billable-calendar-metrics";
import { dashboardMonthKeyNowLocal } from "@/lib/dashboard-period";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  analyzeValeurReelle,
  type ValeurReelleCashTree
} from "@/lib/valeur-reelle-analyze";

export type GainPerWorkDayEstimate = {
  gainPerDayEur: number;
  /** Jours ouvrés cochés du mois passé — dénominateur du gain moyen. */
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

function previousMonthKey(monthKey: string): string {
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
    const gain = gainEurFromCashTree(analysis.cashTree);
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
    previousMonthWorkedDays > 0 ? previousMonthWorkedDays : currentMonthWorkedDays;

  const actualGain = gainEurFromCashTree(cashTree);
  const caHt = cashTree.caFactureEur;
  const history = computeHistoricalGainSignals(transactions, billableWorkDayIsos, now);

  let estimatedGain = actualGain;
  let usesHistoricalEstimate = false;

  if (history.marginPerCaHt != null && caHt > 0) {
    const fromCa = Math.round(caHt * history.marginPerCaHt * 100) / 100;
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

  if (gainAverageWorkedDays > 0) {
    return {
      gainPerDayEur: Math.round((estimatedGain / gainAverageWorkedDays) * 100) / 100,
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
