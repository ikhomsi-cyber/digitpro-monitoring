import type { BillableRatePeriod } from "@/lib/billable-client-days";
import {
  computeMonthActivityCaHt,
  countAnnualAgendaBillableDays,
  countBillableWorkDaysInMonth,
  countSelectedDaysInMonth
} from "@/lib/billable-calendar-metrics";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { dashboardMonthKeyNowLocal } from "@/lib/dashboard-period";
import { summarizeNdfDigitProForMonth } from "@/lib/ndf-digitpro";
import { indemniteKmPerWorkDayForAnnualDaysEur } from "@/lib/pluxee-commute-indemnity";
import {
  analyzeValeurReelle,
  CSG_ON_BNC_RATE,
  type ValeurReelleCashTree,
  type ValeurReelleWaterfallBreakdownRow
} from "@/lib/valeur-reelle-analyze";
import { previousMonthKey, type GainPerWorkDayEstimate } from "@/lib/valeur-reelle-gain-per-day";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ValeurReelleCurrentMonthProjectionInput = {
  monthKey: string;
  transactions: readonly DashboardTx[];
  billableSelected: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  now?: Date;
};

export type ValeurReelleDailyBreakdown = {
  caHtPerDay: number;
  csgPerDay: number;
  /** Impôt sur le revenu imputé au BNC / jour. */
  impotPerDay: number;
  /** Frais DigitPro + frais perso, part journalière du coût total imputé au CA. */
  expensesPerDay: number;
  mandatoryFeesPerDay: number;
  personalChargesPerDay: number;
  /** Indemnités kilométriques / jour (barème annuel, mois en cours). */
  ikPerDay: number;
  /** BNC versé / jour, avant affichage informatif de l'IR. */
  bncPerDay: number;
  /** BNC + frais perso + IK / jour — l'IR reste isolé à titre informatif. */
  netPerDay: number;
  /** Valeur retenue > TJM (avantages perso récupérés en plus du CA facturé). */
  netExceedsTjm: boolean;
  tjmHt: number;
  workedDays: number;
  isEstimate: boolean;
  estimateNote: string | null;
};

function repasAffaireEurFromBreakdown(
  breakdown: readonly ValeurReelleWaterfallBreakdownRow[]
): number {
  return breakdown
    .filter((row) => /repas d.?affaire/i.test(row.label))
    .reduce((sum, row) => sum + row.amountEur, 0);
}

/** Notes de frais repas du mois passé (NDF DigitPro ou repas d'affaire catégorisés). */
function prevMonthRepasNotesDeFraisEur(
  transactions: readonly DashboardTx[],
  prevMonthKey: string,
  personalBreakdown: readonly ValeurReelleWaterfallBreakdownRow[]
): number {
  const ndfEur = summarizeNdfDigitProForMonth(transactions, prevMonthKey).totalEur;
  if (ndfEur > 0) return ndfEur;
  return repasAffaireEurFromBreakdown(personalBreakdown);
}

function computeCsgPerDayOnTjm(
  tjmHt: number,
  digitProPerDay: number,
  personalPerDay: number
): number {
  const operatingPerDay = Math.max(0, tjmHt - digitProPerDay - personalPerDay);
  return round2(operatingPerDay * CSG_ON_BNC_RATE);
}

/**
 * Mois en cours — décomposition / jour sur base TJM :
 * - DigitPro facturés ÷ jours facturés du mois
 * - Frais perso = quote-part repas d'affaire du mois passé ÷ jours cochés (1 jour)
 * - CSG = 9,7 % × (TJM − DigitPro − frais perso)
 * - IR = impôt annuel réel/proratisé par le module Impôts (isolé, non déduit du retenu)
 * - BNC à verser = TJM − DigitPro − frais perso − IK − CSG
 * - Retenu = BNC + frais perso + IK
 */
function computeCurrentMonthDailyBreakdown(input: {
  tree: ValeurReelleCashTree;
  projection: ValeurReelleCurrentMonthProjectionInput;
}): ValeurReelleDailyBreakdown | null {
  const { tree, projection } = input;
  const now = projection.now ?? new Date();
  const { monthKey, transactions, billableSelected, billableRatePeriods, fallbackTjmHt } =
    projection;

  const year = Number(monthKey.slice(0, 4));
  const month0 = Number(monthKey.slice(5, 7)) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month0)) return null;

  const activity = computeMonthActivityCaHt(
    billableSelected,
    billableRatePeriods,
    fallbackTjmHt,
    monthKey,
    now
  );
  const billableDays = activity.billableDays;
  const tjmHt = activity.tjmHt;
  if (billableDays <= 0 || tjmHt <= 0) return null;
  const plannedBillableDays = countSelectedDaysInMonth(billableSelected, year, month0);

  const perBillableDay = (periodEur: number) =>
    round2(periodEur / billableDays);
  const perPlannedBillableDay = (periodEur: number) =>
    round2(periodEur / Math.max(1, plannedBillableDays || billableDays));

  const caHtPerDay = tjmHt;
  const mandatoryFeesPerDay = perBillableDay(tree.mandatoryFeesEur);

  const prevMonthKey = previousMonthKey(monthKey);
  const prevYear = Number(prevMonthKey.slice(0, 4));
  const prevMonth0 = Number(prevMonthKey.slice(5, 7)) - 1;
  const prevBillableDays =
    Number.isFinite(prevYear) && Number.isFinite(prevMonth0)
      ? countBillableWorkDaysInMonth(billableSelected, prevYear, prevMonth0, now)
      : 0;
  const prevMonthAnalysis = analyzeValeurReelle(transactions, {
    years: null,
    month: prevMonthKey,
    now
  });
  const prevRepasMonthEur = prevMonthRepasNotesDeFraisEur(
    transactions,
    prevMonthKey,
    prevMonthAnalysis.cashTree.personalChargesBreakdown
  );
  /** Frais perso / jour : quote-part 1 j. ouvré facturé (ex. 500 € ÷ 22 j. = 22,73 €). */
  const personalChargesPerDay =
    prevBillableDays > 0 ? round2(prevRepasMonthEur / prevBillableDays) : 0;

  const annualBilledDays = countAnnualAgendaBillableDays(billableSelected, year);
  const ikPerDay = indemniteKmPerWorkDayForAnnualDaysEur(annualBilledDays);

  const csgPerDay = computeCsgPerDayOnTjm(tjmHt, mandatoryFeesPerDay, personalChargesPerDay);

  const bncBeforeIrPerDay = round2(
    Math.max(
      0,
      tjmHt - mandatoryFeesPerDay - personalChargesPerDay - ikPerDay - csgPerDay
    )
  );
  // L'IR vient du module Impôts (annuel / mensuel). Sur le mois en cours, on le lisse
  // sur tous les jours facturables prévus du mois, pas seulement sur les jours déjà faits.
  const impotPerDay = perPlannedBillableDay(tree.impotUtiliseEur);
  const bncPerDay = bncBeforeIrPerDay;

  const netPerDay = round2(bncPerDay + personalChargesPerDay + ikPerDay);
  const expensesPerDay = round2(mandatoryFeesPerDay + personalChargesPerDay + ikPerDay);

  return {
    caHtPerDay,
    csgPerDay,
    impotPerDay,
    expensesPerDay,
    mandatoryFeesPerDay,
    personalChargesPerDay,
    ikPerDay,
    bncPerDay,
    netPerDay,
    netExceedsTjm: netPerDay > caHtPerDay + 0.01,
    tjmHt,
    workedDays: billableDays,
    isEstimate: true,
    estimateNote:
      "Mois en cours · TJM · frais perso = quote-part 1 j. (repas d'affaire mois passé)"
  };
}

/**
 * Décomposition journalière d'une journée travaillée sur la période filtrée.
 *
 * Mois en cours : voir `computeCurrentMonthDailyBreakdown`.
 * Autres périodes : montants période ÷ jours cochés calendrier.
 */
export function computeValeurReelleDailyBreakdown(input: {
  tree: ValeurReelleCashTree;
  tjmHt: number;
  /** Jours cochés dans le calendrier sur la période filtrée. */
  billableDays: number;
  gainPerWorkDayEstimate?: GainPerWorkDayEstimate | null;
  currentMonthProjection?: ValeurReelleCurrentMonthProjectionInput | null;
}): ValeurReelleDailyBreakdown {
  const { tree, billableDays, currentMonthProjection } = input;
  const now = currentMonthProjection?.now ?? new Date();

  if (
    currentMonthProjection &&
    currentMonthProjection.monthKey === dashboardMonthKeyNowLocal(now)
  ) {
    const current = computeCurrentMonthDailyBreakdown({
      tree,
      projection: currentMonthProjection
    });
    if (current) return current;
  }

  const tjmHt =
    Number.isFinite(input.tjmHt) && input.tjmHt > 0
      ? input.tjmHt
      : billableDays > 0
        ? round2(tree.caFactureEur / billableDays)
        : 0;

  const workedDays = Math.max(0, billableDays);

  if (workedDays > 0) {
    const caHtPerDay = round2(tree.caFactureEur / workedDays);
    const mandatoryFeesPerDay = round2(tree.mandatoryFeesEur / workedDays);
    const personalChargesPerDay = round2(tree.personalChargesEur / workedDays);
    const csgPerDay = round2(tree.csgEur / workedDays);
    const impotPerDay = round2(tree.impotUtiliseEur / workedDays);
    const expensesPerDay = round2(mandatoryFeesPerDay + personalChargesPerDay);
    const bncPerDay = round2(Math.max(0, tree.bncEur) / workedDays);
    const netPerDay = round2(bncPerDay + personalChargesPerDay);

    return {
      caHtPerDay: caHtPerDay > 0 ? caHtPerDay : tjmHt,
      csgPerDay,
      impotPerDay,
      expensesPerDay,
      mandatoryFeesPerDay,
      personalChargesPerDay,
      ikPerDay: 0,
      bncPerDay,
      netPerDay,
      netExceedsTjm: netPerDay > (caHtPerDay > 0 ? caHtPerDay : tjmHt) + 0.01,
      tjmHt: caHtPerDay > 0 ? caHtPerDay : tjmHt,
      workedDays,
      isEstimate: false,
      estimateNote: null
    };
  }

  const caHtPerDay = tjmHt > 0 ? tjmHt : 0;
  const caBase = Math.max(0, tree.caFactureEur);
  const csgRatio = caBase > 0 ? tree.csgEur / caBase : 0;
  const mandatoryRatio = caBase > 0 ? tree.mandatoryFeesEur / caBase : 0;
  const personalRatio = caBase > 0 ? tree.personalChargesEur / caBase : 0;
  const bncRatio = caBase > 0 ? tree.bncEur / caBase : 0;
  const impotRatio = caBase > 0 ? tree.impotUtiliseEur / caBase : 0;

  const csgPerDay = round2(caHtPerDay * csgRatio);
  const impotPerDay = round2(caHtPerDay * impotRatio);
  const mandatoryFeesPerDay = round2(caHtPerDay * mandatoryRatio);
  const personalChargesPerDay = round2(caHtPerDay * personalRatio);
  const expensesPerDay = round2(mandatoryFeesPerDay + personalChargesPerDay);
  const bncPerDay = round2(Math.max(0, caHtPerDay * bncRatio));
  const netPerDay = round2(bncPerDay + personalChargesPerDay);

  return {
    caHtPerDay,
    csgPerDay,
    impotPerDay,
    expensesPerDay,
    mandatoryFeesPerDay,
    personalChargesPerDay,
    ikPerDay: 0,
    bncPerDay,
    netPerDay,
    netExceedsTjm: netPerDay > caHtPerDay + 0.01,
    tjmHt: caHtPerDay,
    workedDays: 0,
    isEstimate: true,
    estimateNote: "TJM et ratios période"
  };
}
