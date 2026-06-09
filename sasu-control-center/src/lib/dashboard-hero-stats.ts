import { resolveQontoBalanceEur } from "@/lib/bank";
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
  /** Solde compte Qonto pro (API live si dispo, sinon dernière balance importée). */
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
    caHtEur: number;
    bncEur: number;
    fraisPersoEur: number;
    csgEur: number;
    fraisDigitProEur: number;
  };
  detteCsgDepuisDebutEur: number;
  detteTvaDepuisDebutEur: number;
  detteTotaleDepuisDebutEur: number;
  resteAVerserApresCashEur: number;
  /** BNC versés (virements sortants libellé « BNC ») par mois civil, année en cours. */
  bncYearMonthly: Array<{ month: string; monthLabel: string; bncEur: number }>;
  bncYearTotalEur: number;
};

function foldTxLabel(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Virement sortant pro dont le libellé contient « BNC » (aligné analyse Valeur réelle). */
function isOutgoingBncPayment(tx: DashboardTx): boolean {
  if ((tx.scope ?? "pro") !== "pro") return false;
  return tx.amount < 0 && /\bbnc\b/.test(foldTxLabel(tx.label));
}

function computeBncPaidYearMonthly(
  transactions: readonly DashboardTx[],
  now = new Date()
): { year: number; monthly: DashboardHeroStats["bncYearMonthly"]; totalEur: number } {
  const year = now.getFullYear();
  const currentMonth0 = now.getMonth();
  const byMonth = new Map<string, number>();

  for (let m0 = 0; m0 <= currentMonth0; m0++) {
    byMonth.set(`${year}-${String(m0 + 1).padStart(2, "0")}`, 0);
  }

  for (const tx of transactions) {
    if (!isOutgoingBncPayment(tx)) continue;
    const monthKey = transactionAnalyticsDayIso(tx).slice(0, 7);
    if (!monthKey.startsWith(`${year}-`)) continue;
    const month0 = Number(monthKey.slice(5, 7)) - 1;
    if (month0 > currentMonth0) continue;
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + Math.abs(tx.amount));
  }

  const monthly = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bncEur]) => ({
      month,
      monthLabel: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
        new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
      ),
      bncEur: Math.round(bncEur * 100) / 100
    }));

  const totalEur = Math.round(monthly.reduce((sum, row) => sum + row.bncEur, 0) * 100) / 100;
  return { year, monthly, totalEur };
}

/**
 * KPIs du hero : dernier mois de la série « 12 mois glissants » (aligné `last12MonthsKeys` + `computeMetricsFromTransactions`),
 * périmètre SASU (`scope` pro) après le même filtre fenêtre que le tableau de bord.
 */
export type ComputeDashboardHeroStatsOptions = {
  /** Solde courant renvoyé par l’API Qonto (prioritaire sur la balance des transactions). */
  qontoLiveBalanceEur?: number | null;
};

export function computeDashboardHeroStats(
  transactions: DashboardTx[],
  now = new Date(),
  options: ComputeDashboardHeroStatsOptions = {}
): DashboardHeroStats {
  const proTxs = transactions.filter((t) => (t.scope ?? "pro") === "pro");
  const windowed = filterDashboardTransactions(proTxs, { years: null }, now);
  const monthly = computeMetricsFromTransactions(windowed, now);
  const last = monthly.length ? monthly[monthly.length - 1]! : { month: "", revenue: 0, expenses: 0 };
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear = now.getFullYear();
  const valueAnalysis = analyzeValeurReelle(transactions, { years: null, month: currentMonth, now });
  const tjmRepartitionMois = {
    caHtEur: Math.max(0, valueAnalysis.cashTree.caFactureEur),
    bncEur: Math.max(0, valueAnalysis.cashTree.bncEur),
    fraisPersoEur: Math.max(0, valueAnalysis.cashTree.personalChargesEur),
    csgEur: Math.max(0, valueAnalysis.cashTree.csgEur),
    fraisDigitProEur: Math.max(0, valueAnalysis.cashTree.mandatoryFeesEur)
  };
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

  const soldeQontoEur = resolveQontoBalanceEur(transactions, options.qontoLiveBalanceEur, "pro");
  const detteCsgDepuisDebutEur = Math.max(0, allTimeValueAnalysis.cashTree.csgEur);
  const detteTvaDepuisDebutEur =
    Math.round(Math.max(0, allTimeValueAnalysis.vatLiability.remainingVatEur) * (1 + VAT_DEBT_SAFETY_MARGIN_RATE) * 100) /
    100;
  const detteTotaleDepuisDebutEur = Math.round((detteCsgDepuisDebutEur + detteTvaDepuisDebutEur) * 100) / 100;
  const cashDisponibleEur = Math.max(0, soldeQontoEur ?? 0);
  const bncYear = computeBncPaidYearMonthly(proTxs, now);

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
      caHtEur: Math.round(tjmRepartitionMois.caHtEur * 100) / 100,
      bncEur: Math.round(tjmRepartitionMois.bncEur * 100) / 100,
      fraisPersoEur: Math.round(tjmRepartitionMois.fraisPersoEur * 100) / 100,
      csgEur: Math.round(tjmRepartitionMois.csgEur * 100) / 100,
      fraisDigitProEur: Math.round(tjmRepartitionMois.fraisDigitProEur * 100) / 100
    },
    detteCsgDepuisDebutEur,
    detteTvaDepuisDebutEur,
    detteTotaleDepuisDebutEur,
    resteAVerserApresCashEur: Math.max(0, Math.round((detteTotaleDepuisDebutEur - cashDisponibleEur) * 100) / 100),
    bncYearMonthly: bncYear.monthly,
    bncYearTotalEur: bncYear.totalEur
  };
}
