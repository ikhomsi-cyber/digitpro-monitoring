/**
 * Indemnité kilométrique domicile (Sartrouville) → Pluxee (Issy-les-Moulineaux).
 * Distance route retenue + barème fiscal €/km (8 CV, tranche &lt; 5000 km/an).
 */

export const COMMUTE_HOME_LABEL = "Avenue Maurice Berteaux, 78500 Sartrouville";
export const COMMUTE_WORK_LABEL = "Pluxee · Issy-les-Moulineaux";

/** Chevaux fiscaux (barème « 7 CV et plus » dès 7 CV, identique pour 8 CV). */
export const IK_VEHICLE_CHEVAUX_FISCAUX = 8;

/** Distance route aller simple retenue pour coller au simulateur Hiway (~43 km A/R). */
export const COMMUTE_ONE_WAY_ROAD_KM = 21.5;

/**
 * Barème kilométrique €/km — véhicule **7 CV et plus**, distance pro. **≤ 5000 km/an**
 * (barème fiscal 2026 pour les revenus 2025, non revalorisé).
 */
export const IK_EUR_PER_KM = 0.697;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Distance aller simple domicile → travail, km (estimation). */
export function commuteOneWayRoadKm(): number {
  return COMMUTE_ONE_WAY_ROAD_KM;
}

/** Aller-retour, km. */
export function commuteRoundTripKm(): number {
  return Math.round(commuteOneWayRoadKm() * 2 * 10) / 10;
}

/**
 * Barème kilométrique progressif — voiture **7 CV et plus** (revenus 2024 / 2025) :
 * - jusqu'à 5 000 km : d × 0,697
 * - de 5 001 à 20 000 km : (d × 0,394) + 1 515
 * - au-delà de 20 000 km : d × 0,472
 * Retourne l'indemnité **annuelle** pour un kilométrage professionnel total `annualKm`.
 */
export function annualMileageAllowanceEur(annualKm: number): number {
  if (!Number.isFinite(annualKm) || annualKm <= 0) return 0;
  if (annualKm <= 5000) return round2(annualKm * IK_EUR_PER_KM);
  if (annualKm <= 20000) return round2(annualKm * 0.394 + 1515);
  return round2(annualKm * 0.472);
}

/**
 * Inverse du barème : kilométrage approximatif correspondant à une indemnité `allowanceEur`.
 * Sert à afficher « X km » derrière un montant d'IK déjà calculé/remboursé.
 */
export function kmFromMileageAllowanceEur(allowanceEur: number): number {
  if (!Number.isFinite(allowanceEur) || allowanceEur <= 0) return 0;
  const tier1Max = 5000 * IK_EUR_PER_KM; // ≤ 5 000 km
  const tier2Max = 20000 * 0.394 + 1515; // ≤ 20 000 km
  if (allowanceEur <= tier1Max) return Math.round(allowanceEur / IK_EUR_PER_KM);
  if (allowanceEur <= tier2Max) return Math.round((allowanceEur - 1515) / 0.394);
  return Math.round(allowanceEur / 0.472);
}

/**
 * Indemnité par jour travaillé, **dérivée du barème annuel** : le kilométrage annuel
 * (aller-retours × jours facturés sur l'année) détermine la tranche, puis on répartit
 * l'indemnité annuelle sur les jours. Aucun kilométrage à saisir manuellement.
 */
export function indemniteKmPerWorkDayForAnnualDaysEur(annualBilledDays: number): number {
  const roundTripKm = commuteRoundTripKm();
  if (!Number.isFinite(annualBilledDays) || annualBilledDays <= 0) {
    // Pas encore de trajet enregistré : on retombe sur la tranche ≤ 5 000 km.
    return round2(roundTripKm * IK_EUR_PER_KM);
  }
  const annualKm = annualBilledDays * roundTripKm;
  return round2(annualMileageAllowanceEur(annualKm) / annualBilledDays);
}

/** Indemnité pour un aller-retour (km A/R × €/km, tranche ≤ 5 000 km). */
export function indemniteKmRoundTripEur(): number {
  return round2(commuteRoundTripKm() * IK_EUR_PER_KM);
}

/** Indemnité par jour travaillé sur site (un aller-retour complet, tranche ≤ 5 000 km). */
export function indemniteKmPerWorkDayEur(): number {
  return indemniteKmRoundTripEur();
}
