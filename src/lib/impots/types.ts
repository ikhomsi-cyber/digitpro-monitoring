/**
 * Types du moteur fiscal (impôt sur le revenu du foyer).
 * Reconstitue le calcul de la DGFiP : barème progressif, quotient familial,
 * plafonnement du QF, décote, réductions et crédits d'impôt.
 */

export type TaxDeclarant = {
  label: string;
  /** Salaires, pensions, rentes NETS (après déduction 10 % / frais réels). */
  salaireNetImposable: number;
  /** BNC professionnels imposables (rémunération SASU pilotée dans l'app). */
  bncImposable: number;
};

export type TaxOptimizationKind =
  | "pension_alimentaire"
  | "per"
  | "frais_garde"
  | "emploi_domicile"
  | "girardin"
  | "autre";

export type TaxLineItem = {
  kind: TaxOptimizationKind;
  label: string;
  amount: number;
};

export type TaxNotice = {
  /** Année des revenus (ex. 2024). */
  revenusYear: number;
  /** Année d'établissement de l'avis (ex. 2025). */
  avisYear: number;
  /** Nombre de parts du foyer (quotient familial). */
  parts: number;
  declarants: TaxDeclarant[];
  /** Revenus locations meublées non pro imposables (le cas échéant). */
  lmnpImposable?: number;

  /** Charges déductibles du revenu global. */
  chargesDeductibles: TaxLineItem[];

  /** Réductions d'impôt (Girardin / outre-mer, dons…). */
  reductions: TaxLineItem[];
  /** Crédits d'impôt (frais de garde, emploi à domicile…). */
  credits: TaxLineItem[];

  /** Valeurs officielles reprises de l'avis (font foi pour l'historique). */
  avis: {
    revenuBrutGlobal: number;
    revenuImposable: number;
    /** Impôt sur les revenus soumis au barème. */
    impotBareme: number;
    /** Impôt net après réductions et crédits. */
    impotNet: number;
    /** Prélèvements sociaux nets (CSG/CRDS/prél. solidarité sur revenus du patrimoine). */
    prelevementsSociaux?: number;
    /** Prélèvement à la source déjà retenu sur l'année de revenus. */
    prelevementSource?: number;
    /** Acomptes déjà prélevés sur le compte bancaire. */
    acomptesPreleves?: number;
    /** Avance de réductions ou crédits d'impôt perçue. */
    avanceCreditsImpots?: number;
    /** Solde officiel restant à payer selon l'avis. */
    soldeRestantAPayer?: number;
    revenuFiscalReference: number;
    tauxMoyen: number;
    tauxMarginal: number;
  };

  /** true = avis de situation déclarative (revenus 2025) et non avis définitif. */
  declarative?: boolean;
};

/** Résultat d'un calcul de barème (quotient familial + plafonnement). */
export type BaremeResult = {
  taxableIncome: number;
  parts: number;
  /** Impôt avec quotient familial complet (avant plafonnement). */
  impotAvecQuotient: number;
  /** Impôt sans les demi-parts supplémentaires (base couple/célibataire). */
  impotSansEnfants: number;
  /** Avantage brut procuré par le quotient familial. */
  avantageQuotient: number;
  /** Plafond de l'avantage. */
  plafondQuotient: number;
  /** true si l'avantage a été plafonné. */
  plafonnementApplique: boolean;
  /** Décote appliquée (0 si non concerné). */
  decote: number;
  /** Impôt au barème après plafonnement QF et décote (arrondi). */
  impotBareme: number;
};

/** Entrée d'une simulation interactive. */
export type TaxSimulationInput = {
  year: number;
  parts: number;
  salaireNetDeclarant1: number;
  salaireNetDeclarant2: number;
  bncImposable: number;
  pensionAlimentaire: number;
  perDeduction: number;
  fraisGarde: number;
  autresReductions: number;
};

/** Résultat enrichi d'une année (avis + reconstitution + attribution BNC). */
export type TaxYearAnalysis = {
  notice: TaxNotice;
  revenuImposable: number;
  impotNet: number;
  prelevementsSociaux: number;
  impotTotal: number;
  /** Solde officiel restant à payer, une fois le PAS, les acomptes et avances imputés. */
  soldeRestantAPayer: number | null;
  impotMensuel: number;
  tauxMoyen: number;
  tauxMarginal: number;
  revenuFiscalReference: number;
  /** BNC brut imposable du foyer. */
  bncBrut: number;
  /** IR marginal attribuable au BNC (barème avec BNC − barème sans BNC). */
  irAttribuableBnc: number;
  /** BNC net après impôt attribuable. */
  bncNetApresImpot: number;
  /** Taux effectif d'imposition du BNC. */
  tauxEffectifBnc: number;
  /** Économies d'impôt procurées par les optimisations. */
  optimizations: TaxOptimizationBreakdown[];
  totalOptimizations: number;
  /** Contrôle : impôt reconstitué par le moteur vs avis. */
  reconstitution: {
    impotBareme: number;
    ecartAvis: number;
  };
};

export type TaxOptimizationBreakdown = {
  kind: TaxOptimizationKind;
  label: string;
  /** Montant investi / versé / déclaré. */
  montant: number;
  /** Impôt économisé grâce à l'optimisation. */
  economie: number;
};
