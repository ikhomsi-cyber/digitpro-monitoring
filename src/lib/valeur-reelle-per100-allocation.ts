import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";

export type ValeurReellePer100SegmentId = "retained" | "csg" | "personal" | "other";

export type ValeurReellePer100Segment = {
  id: ValeurReellePer100SegmentId;
  label: string;
  shortLabel: string;
  eurPer100: number;
  pct: number;
  sourceEur: number;
};

export type ValeurReellePer100Allocation = {
  /** CA HT used as denominator (same as caFactureEur). */
  baseCaHtEur: number;
  netDisponibleReelEur: number;
  /** round((netDisponibleReel / caHt) * 100) — headline « retenu » for the person. */
  netDisponiblePer100Eur: number;
  segments: ValeurReellePer100Segment[];
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundInt(value: number): number {
  return Math.round(value);
}

/**
 * Per 100 € facturés HT — bar segments are mutually exclusive shares of CA:
 * - Retenu (BNC) = bncEur
 * - CSG = csgEur
 * - Perso = personalChargesEur
 * - Autres = mandatoryFeesEur (frais DigitPro / société)
 *
 * Headline « net disponible réel » = bncEur + personalChargesEur (not double-counted in the bar).
 * Integer €/100 labels are adjusted so segments sum to exactly 100 when CA > 0.
 */
export function buildValeurReellePer100Allocation(tree: ValeurReelleCashTree): ValeurReellePer100Allocation {
  const caHt = Math.max(0, tree.caFactureEur);
  const netDisponibleReelEur = tree.bncEur + tree.personalChargesEur;
  const netDisponiblePer100Eur =
    caHt > 0 ? roundInt((netDisponibleReelEur / caHt) * 100) : 0;

  const rawSegments: Array<Omit<ValeurReellePer100Segment, "eurPer100" | "pct">> = [
    {
      id: "retained",
      label: "Retenu",
      shortLabel: "BNC",
      sourceEur: Math.max(0, tree.bncEur)
    },
    {
      id: "csg",
      label: "CSG",
      shortLabel: "CSG",
      sourceEur: Math.max(0, tree.csgEur)
    },
    {
      id: "personal",
      label: "Frais perso",
      shortLabel: "Perso",
      sourceEur: Math.max(0, tree.personalChargesEur)
    },
    {
      id: "other",
      label: "Autres",
      shortLabel: "Société",
      sourceEur: Math.max(0, tree.mandatoryFeesEur)
    }
  ];

  if (caHt <= 0) {
    return {
      baseCaHtEur: caHt,
      netDisponibleReelEur,
      netDisponiblePer100Eur: 0,
      segments: rawSegments.map((segment) => ({
        ...segment,
        eurPer100: 0,
        pct: 0
      }))
    };
  }

  const withPct = rawSegments.map((segment) => ({
    ...segment,
    pct: round1((segment.sourceEur / caHt) * 100)
  }));

  let eurPer100Values = withPct.map((segment) => roundInt((segment.sourceEur / caHt) * 100));
  const drift = 100 - eurPer100Values.reduce((sum, value) => sum + value, 0);
  if (drift !== 0) {
    const adjustIndex = eurPer100Values.reduce(
      (bestIndex, value, index, arr) => (value > arr[bestIndex] ? index : bestIndex),
      0
    );
    eurPer100Values = eurPer100Values.map((value, index) =>
      index === adjustIndex ? value + drift : value
    );
  }

  const segments: ValeurReellePer100Segment[] = withPct.map((segment, index) => ({
    id: segment.id,
    label: segment.label,
    shortLabel: segment.shortLabel,
    sourceEur: segment.sourceEur,
    pct: segment.pct,
    eurPer100: Math.max(0, eurPer100Values[index] ?? 0)
  }));

  return {
    baseCaHtEur: caHt,
    netDisponibleReelEur,
    netDisponiblePer100Eur,
    segments
  };
}
