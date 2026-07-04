/**
 * Barèmes de l'impôt sur le revenu par année de revenus, plafond du quotient
 * familial et paramètres de décote (couple). Les seuils sont ceux publiés par
 * la DGFiP ; ils reproduisent l'impôt au barème des avis 2023 → 2026 au centime.
 */

export type TaxBracket = { upTo: number; rate: number };

export type YearBareme = {
  brackets: TaxBracket[];
  /** Plafond de l'avantage par demi-part (quotient familial). */
  plafondDemiPart: number;
  /** Décote — seuil et paramètres (couple / célibataire). */
  decote: {
    seuilCouple: number;
    seuilCelibataire: number;
    montantCouple: number;
    montantCelibataire: number;
    taux: number;
  };
};

const INF = Number.POSITIVE_INFINITY;

/** Barèmes par année de revenus. 2026 = projection (reprend 2025). */
export const BAREMES: Record<number, YearBareme> = {
  2022: {
    brackets: [
      { upTo: 10777, rate: 0 },
      { upTo: 27478, rate: 0.11 },
      { upTo: 78570, rate: 0.3 },
      { upTo: 168994, rate: 0.41 },
      { upTo: INF, rate: 0.45 }
    ],
    plafondDemiPart: 1678,
    decote: { seuilCouple: 3191, seuilCelibataire: 1929, montantCouple: 1444, montantCelibataire: 873, taux: 0.4525 }
  },
  2023: {
    brackets: [
      { upTo: 11294, rate: 0 },
      { upTo: 28797, rate: 0.11 },
      { upTo: 82341, rate: 0.3 },
      { upTo: 177106, rate: 0.41 },
      { upTo: INF, rate: 0.45 }
    ],
    plafondDemiPart: 1759,
    decote: { seuilCouple: 3191, seuilCelibataire: 1929, montantCouple: 1444, montantCelibataire: 873, taux: 0.4525 }
  },
  2024: {
    brackets: [
      { upTo: 11497, rate: 0 },
      { upTo: 29315, rate: 0.11 },
      { upTo: 83823, rate: 0.3 },
      { upTo: 180294, rate: 0.41 },
      { upTo: INF, rate: 0.45 }
    ],
    plafondDemiPart: 1791,
    decote: { seuilCouple: 3248, seuilCelibataire: 1964, montantCouple: 1470, montantCelibataire: 889, taux: 0.4525 }
  },
  2025: {
    brackets: [
      { upTo: 11704, rate: 0 },
      { upTo: 29843, rate: 0.11 },
      { upTo: 85332, rate: 0.3 },
      { upTo: 183539, rate: 0.41 },
      { upTo: INF, rate: 0.45 }
    ],
    plafondDemiPart: 1794,
    decote: { seuilCouple: 3305, seuilCelibataire: 1998, montantCouple: 1496, montantCelibataire: 905, taux: 0.4525 }
  }
};

/** Barème projeté pour 2026 (reprend le dernier barème connu). */
export const PROJECTION_YEAR = 2026;

export function getBareme(year: number): YearBareme {
  if (BAREMES[year]) return BAREMES[year];
  // Années récentes non encore publiées : dernier barème connu.
  const known = Object.keys(BAREMES)
    .map(Number)
    .sort((a, b) => b - a);
  const latest = known.find((y) => y <= year) ?? known[0];
  return BAREMES[latest];
}

/** Prélèvements sociaux sur les revenus du patrimoine (CSG/CRDS + prél. solidarité). */
export const PRELEVEMENTS_SOCIAUX_PATRIMOINE_RATE = 0.172;
