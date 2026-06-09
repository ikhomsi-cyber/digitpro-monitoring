export type TaxLiabilityCoverageTone = "green" | "orange" | "red" | "neutral";

export type TaxLiabilityCoverage = {
  totalLiabilityEur: number;
  vatEur: number;
  csgEur: number;
  cashEur: number;
  coveragePct: number | null;
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
  let coverageTone: TaxLiabilityCoverageTone = "neutral";

  if (total > 0) {
    coveragePct = Math.round((cash / total) * 1000) / 10;
    if (coveragePct > 120) coverageTone = "green";
    else if (coveragePct >= 100) coverageTone = "orange";
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
    coverageTone
  };
}
