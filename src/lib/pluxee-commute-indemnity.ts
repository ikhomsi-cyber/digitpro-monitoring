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

/** Distance aller simple domicile → travail, km (estimation). */
export function commuteOneWayRoadKm(): number {
  return COMMUTE_ONE_WAY_ROAD_KM;
}

/** Aller-retour, km. */
export function commuteRoundTripKm(): number {
  return Math.round(commuteOneWayRoadKm() * 2 * 10) / 10;
}

/** Indemnité pour un aller-retour (km A/R × €/km). */
export function indemniteKmRoundTripEur(): number {
  return Math.round(commuteRoundTripKm() * IK_EUR_PER_KM * 100) / 100;
}

/** Indemnité par jour travaillé sur site (un aller-retour complet). */
export function indemniteKmPerWorkDayEur(): number {
  return indemniteKmRoundTripEur();
}
