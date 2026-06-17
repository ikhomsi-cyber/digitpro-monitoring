export type TaxLiabilityCoverageTone = "green" | "orange" | "red" | "neutral";

/** Troncature vers 0 à 2 décimales (pas d’arrondi). */
export function truncatePctTwoDecimals(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.trunc(ratio * 10_000) / 100;
}

export function formatTruncatedPctFr(pct: number): string {
  if (!Number.isFinite(pct)) return "0,00";
  return pct.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export type TaxLiabilityCoverage = {
  totalLiabilityEur: number;
  vatEur: number;
  csgEur: number;
  cashEur: number;
  coveragePct: number | null;
  /** Part des dettes non couverte par la trésorerie (0 si excédent). */
  shortfallPct: number | null;
  /** Marge de trésorerie au-delà des dettes (0 si insuffisant). */
  surplusPct: number | null;
  coverageTone: TaxLiabilityCoverageTone;
};

export function computeTaxLiabilityCoverage(
  cashEur: number | null,
  totalLiabilityEur: number,
  vatEur: number,
  csgEur: number
): TaxLiabilityCoverage {
  const cash = Math.max(0, cashEur ?? 0);
  const total = Math.max(0, totalLiabilityEur);
  const vat = Math.max(0, vatEur);
  const csg = Math.max(0, csgEur);

  let coveragePct: number | null = null;
  let shortfallPct: number | null = null;
  let surplusPct: number | null = null;
  let coverageTone: TaxLiabilityCoverageTone = "neutral";

  if (total > 0) {
    const coverageRatio = (cash / total) * 100;
    coveragePct = truncatePctTwoDecimals(cash / total);
    if (cash < total) {
      shortfallPct = truncatePctTwoDecimals((total - cash) / total);
    } else if (cash > total) {
      surplusPct = truncatePctTwoDecimals((cash - total) / total);
    }
    if (coverageRatio > 120) coverageTone = "green";
    else if (coverageRatio >= 100) coverageTone = "orange";
    else coverageTone = "red";
  } else if (cash > 0) {
    coverageTone = "green";
  }

  return {
    totalLiabilityEur: Math.round(total * 100) / 100,
    vatEur: Math.round(vat * 100) / 100,
    csgEur: Math.round(csg * 100) / 100,
    cashEur: Math.round(cash * 100) / 100,
    coveragePct,
    shortfallPct,
    surplusPct,
    coverageTone
  };
}
