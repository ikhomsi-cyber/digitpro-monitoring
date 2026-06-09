import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";

export type FinancialWaterfallStepKind = "start" | "decrease" | "total";

export type FinancialWaterfallStep = {
  id: string;
  label: string;
  deltaEur: number;
  cumulativeEur: number;
  kind: FinancialWaterfallStepKind;
};

export type FinancialWaterfallModel = {
  steps: FinancialWaterfallStep[];
  remainingCashEur: number;
  periodLabel: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Cascade mensuelle : Revenu TTC → TVA → Dépenses → CSG → Retraits perso → Cash restant. */
export function buildFinancialWaterfall(
  stats: DashboardHeroStats,
  now = new Date()
): FinancialWaterfallModel {
  const rep = stats.tjmRepartitionMois;
  const revenueTtc = Math.max(0, stats.caMensuelEur);
  const revenueHt = Math.max(0, rep.caHtEur);
  const vat = round2(Math.max(0, revenueTtc - revenueHt));
  const expenses = round2(Math.max(0, rep.fraisDigitProEur));
  const csg = round2(Math.max(0, rep.csgEur));
  const personalWithdrawals = round2(Math.max(0, rep.bncEur + rep.fraisPersoEur));

  let cumulative = revenueTtc;
  const steps: FinancialWaterfallStep[] = [
    {
      id: "revenue",
      label: "Revenue",
      deltaEur: revenueTtc,
      cumulativeEur: cumulative,
      kind: "start"
    }
  ];

  cumulative = round2(cumulative - vat);
  steps.push({
    id: "vat",
    label: "VAT",
    deltaEur: -vat,
    cumulativeEur: cumulative,
    kind: "decrease"
  });

  cumulative = round2(cumulative - expenses);
  steps.push({
    id: "expenses",
    label: "Expenses",
    deltaEur: -expenses,
    cumulativeEur: cumulative,
    kind: "decrease"
  });

  cumulative = round2(cumulative - csg);
  steps.push({
    id: "csg",
    label: "CSG",
    deltaEur: -csg,
    cumulativeEur: cumulative,
    kind: "decrease"
  });

  cumulative = round2(cumulative - personalWithdrawals);
  steps.push({
    id: "personal",
    label: "Personal withdrawals",
    deltaEur: -personalWithdrawals,
    cumulativeEur: cumulative,
    kind: "decrease"
  });

  const remainingCashEur = round2(Math.max(0, cumulative));
  steps.push({
    id: "remaining",
    label: "Remaining cash",
    deltaEur: remainingCashEur,
    cumulativeEur: remainingCashEur,
    kind: "total"
  });

  const periodLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(now);

  return { steps, remainingCashEur, periodLabel };
}
