/**
 * Vacances scolaires — académie de Paris (calendrier **zone C**, métropole).
 * Périodes inclusives (premier au dernier jour sans école), alignées sur les arrêtés publiés
 * (Toussaint, Noël, hiver, printemps, été). Les dates de rentrée sont exclues.
 *
 * Zone C : Paris, Créteil, Montpellier, Toulouse, Versailles.
 */

export type ParisSchoolBreak = {
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
  /** Libellé court pour infobulle / légende */
  label: string;
};

/**
 * Plages successives (pas de chevauchement). Étendue : rentrée 2024 → fin été 2027.
 * Sources : calendriers officiels Ministère / zone C (2024-2025 à 2026-2027).
 */
export const PARIS_ZONE_C_SCHOOL_BREAKS: readonly ParisSchoolBreak[] = [
  { start: "2024-07-06", end: "2024-09-01", label: "Vacances d’été" },
  { start: "2024-10-19", end: "2024-11-03", label: "Vacances de la Toussaint" },
  { start: "2024-12-21", end: "2025-01-05", label: "Vacances de Noël" },
  { start: "2025-02-22", end: "2025-03-09", label: "Vacances d’hiver" },
  { start: "2025-04-19", end: "2025-05-04", label: "Vacances de printemps" },
  { start: "2025-07-05", end: "2025-08-31", label: "Vacances d’été" },
  { start: "2025-10-18", end: "2025-11-02", label: "Vacances de la Toussaint" },
  { start: "2025-12-20", end: "2026-01-04", label: "Vacances de Noël" },
  { start: "2026-02-21", end: "2026-03-08", label: "Vacances d’hiver" },
  { start: "2026-04-18", end: "2026-05-03", label: "Vacances de printemps" },
  { start: "2026-07-04", end: "2026-08-31", label: "Vacances d’été" },
  { start: "2026-10-17", end: "2026-11-01", label: "Vacances de la Toussaint" },
  { start: "2026-12-19", end: "2027-01-03", label: "Vacances de Noël" },
  { start: "2027-02-06", end: "2027-02-21", label: "Vacances d’hiver" },
  { start: "2027-04-03", end: "2027-04-18", label: "Vacances de printemps" },
  { start: "2027-07-03", end: "2027-08-31", label: "Vacances d’été" }
] as const;

/** Libellé de la période si `iso` (YYYY-MM-DD) tombe en vacances scolaires zone C (Paris), sinon `undefined`. */
export function getParisZoneCSchoolVacationLabel(iso: string): string | undefined {
  for (const b of PARIS_ZONE_C_SCHOOL_BREAKS) {
    if (iso >= b.start && iso <= b.end) return b.label;
  }
  return undefined;
}
