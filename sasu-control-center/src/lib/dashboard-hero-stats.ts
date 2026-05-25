import { computeLatestQontoBalanceEur } from "@/lib/bank";
import {
  countsTowardDashboardExpenseTotal,
  computeDashboardMonthlyMetrics,
  computeMetricsFromTransactions,
  computeRevenueYearToDateProjection,
  filterDashboardTransactions,
  transactionAnalyticsDayIso,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import {
  isValeurReelleMandatoryFeeLine,
  isValeurReellePersonalChargeLine,
  amountNetOfRecoverableVat,
  analyzeValeurReelle
} from "@/lib/valeur-reelle-analyze";

const VAT_DEBT_SAFETY_MARGIN_RATE = 0.07;

function isCsgExpenseLine(tx: DashboardTx): boolean {
  const blob = `${tx.label ?? ""} ${tx.category ?? ""} ${tx.company ?? ""}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return (
    blob.includes("csg") ||
    blob.includes("contribution sociale") ||
    blob.includes("cotisation sociale")
  );
}

export type DashboardHeroStats = {
  /**
   * Encaissements « Chiffre d’affaires » TTC sur le **dernier mois** de la fenêtre 12 mois glissants
   * (même clé mois et mêmes règles de date analytique que le graphique / carte revenus du dashboard).
   */
  caMensuelEur: number;
  /** Dernier solde compte (colonne balance import Qonto), périmètre pro. */
  soldeQontoEur: number | null;
  /**
   * Dépenses TTC du **même mois** : même agrégation que la carte « Total expenses » (sorties hors BNC et TVA),
   * périmètre SASU, sur les transactions incluses dans la fenêtre 12 mois glissants.
   */
  depensesQontoSasuMoisEur: number;
  depensesQontoSasuMoisHtEur: number;
  caAnnuelEncaisseHtEur: number;
  caAnnuelEncaisseTtcEur: number;
  depensesAnnuelPasseesTtcEur: number;
  ytdMonthly: Array<{
    month: string;
    revenueHtEur: number;
    expensesEur: number;
  }>;
  depensesDigitProMoisEur: number;
  depensesPersoMoisEur: number;
  netDansMaPocheMoisEur: number;
  tjmRepartitionMois: {
    bncEur: number;
    ikEur: number;
    ndfEur: number;
  };
  detteCsgDepuisDebutEur: number;
  detteTvaDepuisDebutEur: number;
  detteTotaleDepuisDebutEur: number;
  resteAVerserApresCashEur: number;
};

/**
 * KPIs du hero : dernier mois de la série « 12 mois glissants » (aligné `last12MonthsKeys` + `computeMetricsFromTransactions`),
 * périmètre SASU (`scope` pro) après le même filtre fenêtre que le tableau de bord.
 */
export function computeDashboardHeroStats(transactions: DashboardTx[], now = new Date()): DashboardHeroStats {
  const proTxs = transactions.filter((t) => (t.scope ?? "pro") === "pro");
  const windowed = filterDashboardTransactions(proTxs, { years: null }, now);
  const monthly = computeMetricsFromTransactions(windowed, now);
  const last = monthly.length ? monthly[monthly.length - 1]! : { month: "", revenue: 0, expenses: 0 };
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear = now.getFullYear();
  const valueAnalysis = analyzeValeurReelle(transactions, { years: null, month: currentMonth, now });
  const tjmRepartitionMois = valueAnalysis.cashTree.personalChargesBreakdown.reduce(
    (acc, row) => {
      if (row.label === "Indemnités kilométriques") acc.ikEur += row.amountEur;
      if (row.label === "Repas du dirigeant" || row.label === "Repas d’affaires") acc.ndfEur += row.amountEur;
      return acc;
    },
    { bncEur: Math.max(0, valueAnalysis.cashTree.bncEur), ikEur: 0, ndfEur: 0 }
  );
  const allYears = Array.from(
    new Set(
      proTxs
        .map((tx) => Number(tx.date.slice(0, 4)))
        .filter((year) => Number.isFinite(year))
    )
  ).sort((a, b) => a - b);
  const allTimeValueAnalysis = analyzeValeurReelle(transactions, {
    years: allYears.length ? allYears : [now.getFullYear()],
    now
  });
  const yearRevenue = computeRevenueYearToDateProjection(proTxs, { now });
  let depensesDigitProMoisEur = 0;
  let depensesPersoMoisEur = 0;
  let depensesQontoSasuMoisHtEur = 0;
  const currentYearSasuTxs = filterDashboardTransactions(proTxs, { years: [currentYear] }, now).filter(
    (tx) => !isCsgExpenseLine(tx)
  );
  const currentYearMonthlyMetrics = computeDashboardMonthlyMetrics(
    currentYearSasuTxs,
    { years: [currentYear], kpiMode: "sasu" },
    now
  );
  const depensesAnnuelPasseesTtcEur = currentYearMonthlyMetrics.reduce((sum, month) => sum + month.expenses, 0);

  for (const tx of windowed) {
    if (tx.amount >= 0 || transactionAnalyticsDayIso(tx).slice(0, 7) !== last.month) continue;
    const bucket = deriveExpenseBucket(tx);
    const amount = Math.abs(tx.amount);
    if (countsTowardDashboardExpenseTotal(tx)) {
      depensesQontoSasuMoisHtEur += amountNetOfRecoverableVat(tx, bucket, amount);
    }
    if (isValeurReelleMandatoryFeeLine(tx, bucket)) {
      depensesDigitProMoisEur += amount;
    }
    if (isValeurReellePersonalChargeLine(bucket)) {
      depensesPersoMoisEur += amount;
    }
  }

  const soldeQontoEur = computeLatestQontoBalanceEur(transactions, "pro");
  const detteCsgDepuisDebutEur = Math.max(0, allTimeValueAnalysis.cashTree.csgEur);
  const detteTvaDepuisDebutEur =
    Math.round(Math.max(0, allTimeValueAnalysis.vatLiability.remainingVatEur) * (1 + VAT_DEBT_SAFETY_MARGIN_RATE) * 100) /
    100;
  const detteTotaleDepuisDebutEur = Math.round((detteCsgDepuisDebutEur + detteTvaDepuisDebutEur) * 100) / 100;
  const cashDisponibleEur = Math.max(0, soldeQontoEur ?? 0);

  return {
    caMensuelEur: last.revenue,
    soldeQontoEur,
    depensesQontoSasuMoisEur: last.expenses,
    depensesQontoSasuMoisHtEur: Math.round(depensesQontoSasuMoisHtEur * 100) / 100,
    caAnnuelEncaisseHtEur: Math.round(yearRevenue.ytdHt * 100) / 100,
    caAnnuelEncaisseTtcEur: Math.round(yearRevenue.ytdTtc * 100) / 100,
    depensesAnnuelPasseesTtcEur: Math.round(depensesAnnuelPasseesTtcEur * 100) / 100,
    ytdMonthly: currentYearMonthlyMetrics
      .filter((month) => month.month <= currentMonth)
      .map((month) => ({
        month: month.month,
        revenueHtEur: Math.round((month.revenue / 1.2) * 100) / 100,
        expensesEur: Math.round(month.expenses * 100) / 100
      })),
    depensesDigitProMoisEur,
    depensesPersoMoisEur,
    netDansMaPocheMoisEur: valueAnalysis.cashTree.bncEur + valueAnalysis.cashTree.personalChargesEur,
    tjmRepartitionMois: {
      bncEur: Math.round(tjmRepartitionMois.bncEur * 100) / 100,
      ikEur: Math.round(tjmRepartitionMois.ikEur * 100) / 100,
      ndfEur: Math.round(tjmRepartitionMois.ndfEur * 100) / 100
    },
    detteCsgDepuisDebutEur,
    detteTvaDepuisDebutEur,
    detteTotaleDepuisDebutEur,
    resteAVerserApresCashEur: Math.max(0, Math.round((detteTotaleDepuisDebutEur - cashDisponibleEur) * 100) / 100)
  };
}
