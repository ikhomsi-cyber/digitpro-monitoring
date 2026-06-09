import type {
  ValeurReelleCashTree,
  ValeurReelleWaterfallBreakdownRow
} from "@/lib/valeur-reelle-analyze";

export type ValeurReelleWaterfallStepKind = "start" | "decrease" | "total";

export type ValeurReelleWaterfallStep = {
  id: string;
  label: string;
  deltaEur: number;
  cumulativeEur: number;
  kind: ValeurReelleWaterfallStepKind;
  /** Part du montant absolu vs CA HT (0–100). */
  pctOfCaHt: number;
  detail?: string;
  breakdown?: ValeurReelleWaterfallBreakdownRow[];
};

export type ValeurReelleWaterfallModel = {
  steps: ValeurReelleWaterfallStep[];
  caHtEur: number;
  /** CA HT − CSG − Frais DigitPro − Frais perso */
  valeurNetteEur: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pctOfCa(amount: number, caHt: number): number {
  if (caHt <= 0) return 0;
  return Math.round((Math.abs(amount) / caHt) * 1000) / 10;
}

/**
 * Cascade Valeur : CA HT → CSG → Frais DigitPro → Frais perso → Valeur nette.
 * Valeur nette = CA HT − CSG − Frais DigitPro − Frais perso (tous affichés en déduction).
 */
export function buildValeurReelleWaterfall(tree: ValeurReelleCashTree): ValeurReelleWaterfallModel {
  const caHt = Math.max(0, tree.caFactureEur);
  const csg = Math.max(0, tree.csgEur);
  const digitPro = Math.max(0, tree.mandatoryFeesEur);
  const personal = Math.max(0, tree.personalChargesEur);
  const valeurNette = round2(Math.max(0, caHt - csg - digitPro - personal));

  let cumulative = caHt;
  const steps: ValeurReelleWaterfallStep[] = [
    {
      id: "ca_ht",
      label: "CA HT",
      deltaEur: caHt,
      cumulativeEur: cumulative,
      kind: "start",
      pctOfCaHt: caHt > 0 ? 100 : 0,
      detail: `CA TTC encaissé ${round2(tree.caTtcEur).toLocaleString("fr-FR")} € / 1,20`
    }
  ];

  cumulative = round2(cumulative - csg);
  steps.push({
    id: "csg",
    label: "CSG",
    deltaEur: -csg,
    cumulativeEur: cumulative,
    kind: "decrease",
    pctOfCaHt: pctOfCa(csg, caHt),
    detail: "9,7 % de (CA HT − frais obligatoires − charges perso)"
  });

  cumulative = round2(cumulative - digitPro);
  steps.push({
    id: "digitpro",
    label: "Frais DigitPro",
    deltaEur: -digitPro,
    cumulativeEur: cumulative,
    kind: "decrease",
    pctOfCaHt: pctOfCa(digitPro, caHt),
    breakdown: tree.mandatoryFeesBreakdown
  });

  cumulative = round2(cumulative - personal);
  steps.push({
    id: "personal",
    label: "Frais perso",
    deltaEur: -personal,
    cumulativeEur: cumulative,
    kind: "decrease",
    pctOfCaHt: pctOfCa(personal, caHt),
    breakdown: tree.personalChargesBreakdown
  });

  steps.push({
    id: "valeur_nette",
    label: "Valeur nette",
    deltaEur: valeurNette,
    cumulativeEur: valeurNette,
    kind: "total",
    pctOfCaHt: pctOfCa(valeurNette, caHt),
    detail: "CA HT − CSG − Frais DigitPro − Frais perso"
  });

  return { steps, caHtEur: caHt, valeurNetteEur: valeurNette };
}

export function valeurReelleWaterfallBarGeometry(
  step: ValeurReelleWaterfallStep,
  prevCumulative: number,
  index: number,
  maxValue: number,
  chartW: number,
  chartH: number,
  gap: number,
  barW: number
) {
  const scale = (v: number) => (v / maxValue) * chartH;
  const x = index * (barW + gap) + gap;
  const topValue =
    step.kind === "start" || step.kind === "total" ? step.cumulativeEur : prevCumulative;
  const bottomValue = step.kind === "start" || step.kind === "total" ? 0 : step.cumulativeEur;
  const yTop = chartH - scale(topValue);
  const yBottom = chartH - scale(bottomValue);
  const height = Math.max(2, yBottom - yTop);
  return { x, y: yTop, width: barW, height };
}
