import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";
import type { GainPerWorkDayEstimate } from "@/lib/valeur-reelle-gain-per-day";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ValeurReelleDailyBreakdown = {
  caHtPerDay: number;
  csgPerDay: number;
  /** Frais DigitPro + frais perso, part journalière du coût total imputé au CA. */
  expensesPerDay: number;
  mandatoryFeesPerDay: number;
  personalChargesPerDay: number;
  /** BNC versé / jour. */
  bncPerDay: number;
  /** BNC + frais perso / jour — aligné sur « net disponible réel » et gain / jour. */
  netPerDay: number;
  /** Valeur retenue > TJM (avantages perso récupérés en plus du CA facturé). */
  netExceedsTjm: boolean;
  tjmHt: number;
  workedDays: number;
  isEstimate: boolean;
  estimateNote: string | null;
};

/**
 * Décomposition journalière d'une journée travaillée sur la période filtrée.
 *
 * Formules (workedDays > 0, même dénominateur que gain/jour) :
 * - revenu / jour = TJM HT (ou caFactureEur / workedDays en secours)
 * - CSG / jour = csgEur / workedDays
 * - frais perso / jour = personalChargesEur / workedDays
 * - frais pro / jour = mandatoryFeesEur / workedDays
 * - valeur retenue / jour = (bncEur + personalChargesEur) / workedDays
 *   (= revenu − CSG − frais pro ; les frais perso sont réintégrés dans le net disponible)
 *
 * Dénominateur : jours travaillés cochés (mois en cours) ou jours facturés (CA / TJM).
 */
export function computeValeurReelleDailyBreakdown(input: {
  tree: ValeurReelleCashTree;
  tjmHt: number;
  billableDays: number;
  gainPerWorkDayEstimate: GainPerWorkDayEstimate | null;
}): ValeurReelleDailyBreakdown {
  const { tree, billableDays, gainPerWorkDayEstimate } = input;
  const tjmHt =
    Number.isFinite(input.tjmHt) && input.tjmHt > 0
      ? input.tjmHt
      : billableDays > 0
        ? round2(tree.caFactureEur / billableDays)
        : 0;

  const isCurrentMonthEstimate = gainPerWorkDayEstimate != null;
  const workedDays = isCurrentMonthEstimate
    ? gainPerWorkDayEstimate.currentMonthWorkedDays
    : billableDays;
  const denominator = workedDays > 0 ? workedDays : billableDays;

  const caHtPerDay =
    tjmHt > 0
      ? tjmHt
      : denominator > 0
        ? round2(tree.caFactureEur / denominator)
        : 0;

  if (denominator > 0) {
    const mandatoryFeesPerDay = round2(tree.mandatoryFeesEur / denominator);
    const personalChargesPerDay = round2(tree.personalChargesEur / denominator);
    const csgPerDay = round2(tree.csgEur / denominator);
    const expensesPerDay = round2(mandatoryFeesPerDay + personalChargesPerDay);
    const bncPerDay = round2(tree.bncEur / denominator);
    const netPerDay = isCurrentMonthEstimate
      ? gainPerWorkDayEstimate.gainPerDayEur
      : round2(bncPerDay + personalChargesPerDay);

    return {
      caHtPerDay,
      csgPerDay,
      expensesPerDay,
      mandatoryFeesPerDay,
      personalChargesPerDay,
      bncPerDay,
      netPerDay,
      netExceedsTjm: netPerDay > caHtPerDay + 0.01,
      tjmHt: caHtPerDay,
      workedDays: denominator,
      isEstimate: isCurrentMonthEstimate && gainPerWorkDayEstimate.usesHistoricalEstimate,
      estimateNote:
        isCurrentMonthEstimate && gainPerWorkDayEstimate.usesHistoricalEstimate
          ? "estimé sur historique"
          : null
    };
  }

  const caBase = Math.max(0, tree.caFactureEur);
  const csgRatio = caBase > 0 ? tree.csgEur / caBase : 0;
  const mandatoryRatio = caBase > 0 ? tree.mandatoryFeesEur / caBase : 0;
  const personalRatio = caBase > 0 ? tree.personalChargesEur / caBase : 0;

  const csgPerDay = round2(caHtPerDay * csgRatio);
  const mandatoryFeesPerDay = round2(caHtPerDay * mandatoryRatio);
  const personalChargesPerDay = round2(caHtPerDay * personalRatio);
  const expensesPerDay = round2(mandatoryFeesPerDay + personalChargesPerDay);

  const netFromHistory = gainPerWorkDayEstimate?.gainPerDayEur ?? null;
  const bncPerDay = round2(caHtPerDay * (caBase > 0 ? tree.bncEur / caBase : 0));
  const netPerDay =
    netFromHistory != null
      ? netFromHistory
      : round2(Math.max(0, bncPerDay + personalChargesPerDay));

  return {
    caHtPerDay,
    csgPerDay,
    expensesPerDay,
    mandatoryFeesPerDay,
    personalChargesPerDay,
    bncPerDay,
    netPerDay,
    netExceedsTjm: netPerDay > caHtPerDay + 0.01,
    tjmHt: caHtPerDay,
    workedDays: 0,
    isEstimate: true,
    estimateNote: netFromHistory != null ? "estimé sur historique" : "TJM et ratios période"
  };
}
