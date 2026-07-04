import { getBareme, type TaxBracket } from "./tax-brackets";
import type { BaremeResult } from "./types";

/** Impôt brut pour un nombre de parts donné (barème progressif, sans plafonnement). */
function taxForParts(taxableIncome: number, parts: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0 || parts <= 0) return 0;
  const perPart = taxableIncome / parts;
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    if (perPart > bracket.upTo) {
      tax += (bracket.upTo - lower) * bracket.rate;
      lower = bracket.upTo;
    } else {
      tax += (perPart - lower) * bracket.rate;
      break;
    }
  }
  return tax * parts;
}

/** Nombre de parts « de base » (foyer sans enfant) : couple = 2, célibataire = 1. */
function baseParts(parts: number): number {
  return parts >= 2 ? 2 : 1;
}

/**
 * Calcule l'impôt au barème avec quotient familial, plafonnement de l'avantage
 * et décote. Reproduit le calcul DGFiP.
 */
export function computeBareme(taxableIncome: number, parts: number, year: number): BaremeResult {
  const bareme = getBareme(year);
  const income = Math.max(0, Math.round(taxableIncome));

  const impotAvecQuotient = taxForParts(income, parts, bareme.brackets);
  const base = baseParts(parts);
  const impotSansEnfants = taxForParts(income, base, bareme.brackets);

  const halfParts = Math.round((parts - base) / 0.5);
  const plafondQuotient = Math.max(0, halfParts) * bareme.plafondDemiPart;
  const avantageQuotient = Math.max(0, impotSansEnfants - impotAvecQuotient);
  const plafonnementApplique = avantageQuotient > plafondQuotient;

  let impot = plafonnementApplique ? impotSansEnfants - plafondQuotient : impotAvecQuotient;

  // Décote (foyers faiblement imposés).
  const isCouple = parts >= 2;
  const seuil = isCouple ? bareme.decote.seuilCouple : bareme.decote.seuilCelibataire;
  const montant = isCouple ? bareme.decote.montantCouple : bareme.decote.montantCelibataire;
  let decote = 0;
  if (impot > 0 && impot < seuil) {
    decote = Math.max(0, Math.round(montant - impot * bareme.decote.taux));
    decote = Math.min(decote, impot);
  }
  impot = Math.max(0, impot - decote);

  return {
    taxableIncome: income,
    parts,
    impotAvecQuotient: Math.round(impotAvecQuotient),
    impotSansEnfants: Math.round(impotSansEnfants),
    avantageQuotient: Math.round(avantageQuotient),
    plafondQuotient,
    plafonnementApplique,
    decote,
    impotBareme: Math.round(impot)
  };
}

/** Impôt au barème (montant seul) — raccourci. */
export function baremeTax(taxableIncome: number, parts: number, year: number): number {
  return computeBareme(taxableIncome, parts, year).impotBareme;
}

/** Taux marginal d'imposition (tranche du barème atteinte par le revenu / part). */
export function tauxMarginal(taxableIncome: number, parts: number, year: number): number {
  const bareme = getBareme(year);
  const perPart = taxableIncome / Math.max(1, parts);
  let rate = 0;
  for (const bracket of bareme.brackets) {
    if (perPart > bracket.upTo) {
      rate = bracket.rate;
    } else {
      rate = bracket.rate;
      break;
    }
  }
  return Math.round(rate * 100);
}
