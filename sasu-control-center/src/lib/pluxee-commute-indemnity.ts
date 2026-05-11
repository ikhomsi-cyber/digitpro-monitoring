/**
 * Indemnité kilométrique domicile (Sartrouville) → Pluxee (Issy-les-Moulineaux).
 * Distance indicative + barème fiscal €/km (8 CV, tranche &lt; 5000 km/an).
 */

export const COMMUTE_HOME_LABEL = "226 rue Maurice Berteaux, 78500 Sartrouville";
export const COMMUTE_WORK_LABEL = "Pluxee · Issy-les-Moulineaux";

/** Chevaux fiscaux (barème « 7 CV et plus » dès 7 CV, identique pour 8 CV). */
export const IK_VEHICLE_CHEVAUX_FISCAUX = 8;

/**
 * Coordonnées approximatives pour estimer la distance route (facteur appliqué au vol d’oiseau).
 * Affinez si besoin (Google Maps, etc.).
 */
const HOME_LAT_LON = { lat: 48.9371, lon: 2.1624 } as const;
const PLUXEE_ISSY_LAT_LON = { lat: 48.8292, lon: 2.2704 } as const;

/** Majoration vol d’oiseau → km route (périphérie / rocade, indicatif). */
const ROAD_DISTANCE_FACTOR = 1.28;

/**
 * Barème kilométrique €/km — véhicule **7 CV et plus**, distance pro. **≤ 5000 km/an**
 * (barème fiscal 2024–2025, stable en 2025).
 */
export const IK_EUR_PER_KM = 0.697;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Distance aller simple domicile → travail, km (estimation). */
export function commuteOneWayRoadKm(): number {
  const bird = haversineKm(HOME_LAT_LON, PLUXEE_ISSY_LAT_LON);
  return Math.round(bird * ROAD_DISTANCE_FACTOR * 10) / 10;
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
