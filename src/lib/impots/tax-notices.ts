import type { TaxNotice } from "./types";

/**
 * Avis d'impôt du foyer KHOMSI / SEKKAT, saisis depuis les avis officiels
 * (2023 → 2026). Les montants « avis » font foi pour l'historique ; le moteur
 * fiscal reconstitue le calcul et attribue l'IR au BNC.
 */
export const TAX_NOTICES: TaxNotice[] = [
  {
    revenusYear: 2022,
    avisYear: 2023,
    parts: 2.5,
    declarants: [
      { label: "Déclarant 1", salaireNetImposable: 74605, bncImposable: 41322 },
      { label: "Déclarant 2", salaireNetImposable: 32315, bncImposable: 0 }
    ],
    chargesDeductibles: [],
    reductions: [],
    credits: [
      { kind: "emploi_domicile", label: "Emploi salarié à domicile", amount: 1750 },
      { kind: "frais_garde", label: "Frais de garde des jeunes enfants", amount: 0 }
    ],
    avis: {
      revenuBrutGlobal: 136182,
      revenuImposable: 136182,
      impotBareme: 26364,
      impotNet: 24614,
      revenuFiscalReference: 136182,
      tauxMoyen: 18.07,
      tauxMarginal: 30
    }
  },
  {
    revenusYear: 2023,
    avisYear: 2024,
    parts: 3,
    declarants: [
      { label: "Déclarant 1", salaireNetImposable: 18850, bncImposable: 153186 },
      { label: "Déclarant 2", salaireNetImposable: 32989, bncImposable: 0 }
    ],
    chargesDeductibles: [
      { kind: "pension_alimentaire", label: "Pension alimentaire", amount: 12455 }
    ],
    reductions: [
      { kind: "girardin", label: "Investissement outre-mer (entreprise)", amount: 22562 }
    ],
    credits: [{ kind: "frais_garde", label: "Frais de garde des jeunes enfants", amount: 1914 }],
    avis: {
      revenuBrutGlobal: 205025,
      revenuImposable: 192570,
      impotBareme: 43893,
      impotNet: 19417,
      revenuFiscalReference: 193020,
      tauxMoyen: 10.08,
      tauxMarginal: 41
    }
  },
  {
    revenusYear: 2024,
    avisYear: 2025,
    parts: 3,
    declarants: [
      { label: "Déclarant 1", salaireNetImposable: 0, bncImposable: 106352 },
      { label: "Déclarant 2", salaireNetImposable: 30740, bncImposable: 0 }
    ],
    chargesDeductibles: [
      { kind: "pension_alimentaire", label: "Pension alimentaire", amount: 9516 }
    ],
    reductions: [],
    credits: [{ kind: "frais_garde", label: "Frais de garde des jeunes enfants", amount: 2016 }],
    avis: {
      revenuBrutGlobal: 137092,
      revenuImposable: 127576,
      impotBareme: 21022,
      impotNet: 19006,
      revenuFiscalReference: 127576,
      tauxMoyen: 14.9,
      tauxMarginal: 30
    }
  },
  {
    revenusYear: 2025,
    avisYear: 2026,
    parts: 3,
    declarative: true,
    lmnpImposable: 311,
    declarants: [
      { label: "Déclarant 1", salaireNetImposable: 0, bncImposable: 158566 },
      { label: "Déclarant 2", salaireNetImposable: 30457, bncImposable: 0 }
    ],
    chargesDeductibles: [
      { kind: "pension_alimentaire", label: "Pension alimentaire", amount: 9740 },
      { kind: "per", label: "Versements épargne retraite (PER)", amount: 30000 }
    ],
    reductions: [],
    credits: [{ kind: "frais_garde", label: "Frais de garde des jeunes enfants", amount: 2189 }],
    avis: {
      revenuBrutGlobal: 189334,
      revenuImposable: 149594,
      impotBareme: 27472,
      impotNet: 25283,
      prelevementsSociaux: 58,
      revenuFiscalReference: 179594,
      tauxMoyen: 16.9,
      tauxMarginal: 30
    }
  }
];

export function getLatestNotice(): TaxNotice {
  return TAX_NOTICES[TAX_NOTICES.length - 1];
}
