import { baremeTax, computeBareme, tauxMarginal } from "./tax-engine";
import { TAX_NOTICES } from "./tax-notices";
import type {
  TaxNotice,
  TaxOptimizationBreakdown,
  TaxSimulationInput,
  TaxYearAnalysis
} from "./types";

type PeriodFilter = {
  years?: number[] | null;
  month?: string | null;
  months?: string[] | null;
  now?: Date;
};

function sumBnc(notice: TaxNotice): number {
  return notice.declarants.reduce((acc, d) => acc + d.bncImposable, 0);
}

/** Économie d'impôt procurée par chaque optimisation du foyer. */
function computeOptimizations(notice: TaxNotice): TaxOptimizationBreakdown[] {
  const { parts, revenusYear } = notice;
  const ri = notice.avis.revenuImposable;
  const out: TaxOptimizationBreakdown[] = [];

  // Charges déductibles (pension alimentaire, PER) : elles réduisent le revenu
  // imposable → économie = impôt sans la charge − impôt avec.
  for (const charge of notice.chargesDeductibles) {
    const impotAvec = baremeTax(ri, parts, revenusYear);
    const impotSans = baremeTax(ri + charge.amount, parts, revenusYear);
    out.push({
      kind: charge.kind,
      label: charge.label,
      montant: charge.amount,
      economie: Math.max(0, Math.round(impotSans - impotAvec))
    });
  }

  // Réductions d'impôt (Girardin…) : imputées directement sur l'impôt.
  for (const reduction of notice.reductions) {
    out.push({
      kind: reduction.kind,
      label: reduction.label,
      montant: reduction.amount,
      economie: Math.round(reduction.amount)
    });
  }

  // Crédits d'impôt (frais de garde, emploi à domicile…).
  for (const credit of notice.credits) {
    if (credit.amount <= 0) continue;
    out.push({
      kind: credit.kind,
      label: credit.label,
      montant: credit.amount,
      economie: Math.round(credit.amount)
    });
  }

  return out;
}

export function analyzeNotice(notice: TaxNotice): TaxYearAnalysis {
  const { parts, revenusYear } = notice;
  const ri = notice.avis.revenuImposable;
  const bncBrut = sumBnc(notice);

  const impotNet = notice.avis.impotNet;
  const prelevementsSociaux = notice.avis.prelevementsSociaux ?? 0;
  const impotTotal = impotNet + prelevementsSociaux;

  // Attribution marginale de l'IR au BNC : différence de barème avec / sans BNC,
  // pondérée par le ratio impôt net / impôt barème (répartit réductions & crédits).
  const impotBaremeAvec = baremeTax(ri, parts, revenusYear);
  const impotBaremeSans = baremeTax(Math.max(0, ri - bncBrut), parts, revenusYear);
  const marginBncBrut = Math.max(0, impotBaremeAvec - impotBaremeSans);
  const ratioNet = notice.avis.impotBareme > 0 ? impotNet / notice.avis.impotBareme : 0;
  const irAttribuableBnc = Math.round(marginBncBrut * ratioNet);
  const bncNetApresImpot = Math.max(0, bncBrut - irAttribuableBnc);
  const tauxEffectifBnc = bncBrut > 0 ? (irAttribuableBnc / bncBrut) * 100 : 0;

  const optimizations = computeOptimizations(notice);
  const totalOptimizations = optimizations.reduce((acc, o) => acc + o.economie, 0);

  const reconstruit = computeBareme(ri, parts, revenusYear).impotBareme;

  return {
    notice,
    revenuImposable: ri,
    impotNet,
    prelevementsSociaux,
    impotTotal,
    impotMensuel: Math.round(impotTotal / 12),
    tauxMoyen: notice.avis.tauxMoyen,
    tauxMarginal: notice.avis.tauxMarginal,
    revenuFiscalReference: notice.avis.revenuFiscalReference,
    bncBrut,
    irAttribuableBnc,
    bncNetApresImpot,
    tauxEffectifBnc,
    optimizations,
    totalOptimizations,
    reconstitution: {
      impotBareme: reconstruit,
      ecartAvis: reconstruit - notice.avis.impotBareme
    }
  };
}

export function analyzeAllNotices(): TaxYearAnalysis[] {
  return TAX_NOTICES.map(analyzeNotice).sort((a, b) => a.notice.revenusYear - b.notice.revenusYear);
}

function last12MonthKeys(now: Date): string[] {
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function periodMonthsByYear(filter: PeriodFilter): Map<number, number> {
  const now = filter.now ?? new Date();
  const monthKeys =
    filter.months && filter.months.length > 0
      ? filter.months
      : filter.month
        ? [filter.month]
        : null;

  if (monthKeys) {
    const map = new Map<number, Set<string>>();
    for (const key of monthKeys) {
      const year = Number(key.slice(0, 4));
      const month = key.slice(5, 7);
      if (!Number.isFinite(year) || !/^\d{2}$/.test(month)) continue;
      const set = map.get(year) ?? new Set<string>();
      set.add(month);
      map.set(year, set);
    }
    return new Map(Array.from(map.entries()).map(([year, months]) => [year, months.size]));
  }

  if (filter.years && filter.years.length > 0) {
    const map = new Map<number, number>();
    for (const year of filter.years) {
      if (!Number.isFinite(year)) continue;
      map.set(year, year === now.getFullYear() ? now.getMonth() + 1 : 12);
    }
    return map;
  }

  const map = new Map<number, number>();
  for (const key of last12MonthKeys(now)) {
    const year = Number(key.slice(0, 4));
    if (Number.isFinite(year)) map.set(year, (map.get(year) ?? 0) + 1);
  }
  return map;
}

/**
 * Impôt IR attribuable au BNC, appliqué à une période Valeur réelle :
 * - années avec avis : IR annuel attribué au BNC ÷ 12 × nombre de mois affichés ;
 * - années sans avis : estimation via le dernier taux effectif BNC connu.
 */
export function allocateIncomeTaxToPeriod(
  filter: PeriodFilter,
  periodBncBaseEur: number
): { amountEur: number; estimated: boolean } {
  const analyses = analyzeAllNotices();
  const byYear = new Map(analyses.map((analysis) => [analysis.notice.revenusYear, analysis]));
  const monthsByYear = periodMonthsByYear(filter);
  const totalMonths = Array.from(monthsByYear.values()).reduce((sum, count) => sum + count, 0);
  if (totalMonths <= 0) return { amountEur: 0, estimated: true };

  const latestWithBnc = [...analyses]
    .reverse()
    .find((analysis) => analysis.bncBrut > 0 && analysis.irAttribuableBnc > 0);
  const fallbackRate =
    latestWithBnc && latestWithBnc.bncBrut > 0
      ? latestWithBnc.irAttribuableBnc / latestWithBnc.bncBrut
      : 0;

  let amount = 0;
  let estimated = false;
  let knownMonths = 0;

  for (const [year, monthCount] of monthsByYear) {
    const analysis = byYear.get(year);
    if (analysis) {
      amount += (analysis.irAttribuableBnc * monthCount) / 12;
      knownMonths += monthCount;
    } else {
      estimated = true;
    }
  }

  const unknownMonths = Math.max(0, totalMonths - knownMonths);
  if (unknownMonths > 0 && fallbackRate > 0) {
    const unknownBncBase = Math.max(0, periodBncBaseEur) * (unknownMonths / totalMonths);
    amount += unknownBncBase * fallbackRate;
  }

  return { amountEur: Math.round(Math.max(0, amount) * 100) / 100, estimated };
}

/** Résultat d'une simulation interactive (année en cours / projection). */
export type TaxSimulationResult = {
  revenuImposable: number;
  impotBareme: number;
  impotNet: number;
  impotMensuel: number;
  tauxMoyen: number;
  tauxMarginal: number;
  bncBrut: number;
  irAttribuableBnc: number;
  bncNetApresImpot: number;
  tauxEffectifBnc: number;
  economiePensionPer: number;
};

export function simulateTax(input: TaxSimulationInput): TaxSimulationResult {
  const salaires = Math.max(0, input.salaireNetDeclarant1) + Math.max(0, input.salaireNetDeclarant2);
  const bnc = Math.max(0, input.bncImposable);
  const chargesDeductibles = Math.max(0, input.pensionAlimentaire) + Math.max(0, input.perDeduction);
  const revenuImposable = Math.max(0, salaires + bnc - chargesDeductibles);

  const impotBareme = baremeTax(revenuImposable, input.parts, input.year);

  // Crédit frais de garde (50 %, plafond 3 500 € / enfant simplifié à saisie directe).
  const creditFraisGarde = Math.max(0, input.fraisGarde) * 0.5;
  const impotNet = Math.max(0, impotBareme - creditFraisGarde - Math.max(0, input.autresReductions));

  const impotBaremeSansBnc = baremeTax(Math.max(0, revenuImposable - bnc), input.parts, input.year);
  const marginBncBrut = Math.max(0, impotBareme - impotBaremeSansBnc);
  const ratioNet = impotBareme > 0 ? impotNet / impotBareme : 0;
  const irAttribuableBnc = Math.round(marginBncBrut * ratioNet);

  // Économie procurée par pension + PER.
  const impotSansCharges = baremeTax(revenuImposable + chargesDeductibles, input.parts, input.year);
  const economiePensionPer = Math.max(0, Math.round(impotSansCharges - impotBareme));

  return {
    revenuImposable,
    impotBareme,
    impotNet,
    impotMensuel: Math.round(impotNet / 12),
    tauxMoyen: revenuImposable > 0 ? (impotNet / revenuImposable) * 100 : 0,
    tauxMarginal: tauxMarginal(revenuImposable, input.parts, input.year),
    bncBrut: bnc,
    irAttribuableBnc,
    bncNetApresImpot: Math.max(0, bnc - irAttribuableBnc),
    tauxEffectifBnc: bnc > 0 ? (irAttribuableBnc / bnc) * 100 : 0,
    economiePensionPer
  };
}
