import { computeUpcomingInvoice } from "@/lib/upcoming-invoice";
import { computeYearToDateInvoicingTotals } from "@/lib/invoice-worked-days-series";
import { computeLatestQontoBalanceEur, isPrimaryBankCompany } from "@/lib/bank";
import { mobileCashForecast } from "@/lib/mobile/cash-forecast";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { analyzeValeurReelle } from "@/lib/valeur-reelle-analyze";
import { buildMobileExpenses } from "@/lib/mobile/expenses";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { computeYearEndProjection } from "@/lib/year-end-projection";
import { computeTreasuryVerserSnapshot } from "@/lib/treasury-verser";
import { analyzeLmnp } from "@/lib/lmnp-analyze";
import { summarizeNdfDigitProForMonth } from "@/lib/ndf-digitpro";
import {
  BILLABLE_CLIENT_TJM_HT,
  resolveBillableTjmForMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";
import { computeCurrentMonthOverview, countAgendaWorkDaysInMonth } from "@/lib/billable-calendar-metrics";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import { additionalCsgFromInvoiceCaHt, sumOutstandingHiwayInvoiceHt } from "@/lib/hiway-invoice-aggregate";

export function buildMobileOverview(transactions: DashboardTx[], activity: {
  days: string[]; rates: BillableRatePeriod[]; tjm: number | null; invoices?: HiwayInvoice[];
}, now = new Date()) {
  const baseDashboard = computeDashboardHeroStats(transactions, now);
  const outstandingInvoiceCsgEur = additionalCsgFromInvoiceCaHt(
    sumOutstandingHiwayInvoiceHt(activity.invoices, transactions, now)
  );
  const dashboard = outstandingInvoiceCsgEur > 0 ? {
    ...baseDashboard,
    detteCsgDepuisDebutEur: Math.round((baseDashboard.detteCsgDepuisDebutEur + outstandingInvoiceCsgEur) * 100) / 100,
    detteTotaleDepuisDebutEur: Math.round((baseDashboard.detteTotaleDepuisDebutEur + outstandingInvoiceCsgEur) * 100) / 100,
    resteAVerserApresCashEur: Math.max(0, Math.round((baseDashboard.detteTotaleDepuisDebutEur + outstandingInvoiceCsgEur - Math.max(0, baseDashboard.soldeQontoEur ?? 0)) * 100) / 100)
  } : baseDashboard;
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activityOverview = computeCurrentMonthOverview(
    new Set(activity.days), activity.rates, activity.tjm ?? BILLABLE_CLIENT_TJM_HT, now
  );
  const selectedDays = new Set(activity.days);
  const fallbackTjm = activity.tjm ?? BILLABLE_CLIENT_TJM_HT;
  const upcoming = computeUpcomingInvoice({ selectedWorkDayIsos: selectedDays, billableRatePeriods: activity.rates, fallbackTjmHt: fallbackTjm, hiwayInvoices: activity.invoices, now });
  const invoicing = computeYearToDateInvoicingTotals(transactions, selectedDays, activity.rates, fallbackTjm, now, activity.invoices);
  const activityMonths = dashboard.ytdMonthly.map((row) => {
    const [year, monthNumber] = row.month.split("-").map(Number);
    return {
      month: row.month,
      revenueHtEur: row.revenueHtEur,
      expensesEur: row.expensesEur,
      workedDays: countAgendaWorkDaysInMonth(selectedDays, year!, monthNumber! - 1, now),
      tjmHtEur: resolveBillableTjmForMonth(activity.rates, row.month, fallbackTjm)
    };
  });
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
  const previousExpenses = analyzeValeurReelle(transactions, { years: null, month: previousMonth, now }).cashTree;
  return {
    version: 1,
    generatedAt: now.toISOString(),
    month,
    transactionCount: transactions.length,
    balanceSource: "imported" as const,
    dashboard,
    generatedRevenueHtEur: invoicing.factureHtEur,
    upcomingInvoice: upcoming,
    cashForecast: mobileCashForecast({ transactions, invoices: activity.invoices, days: activity.days,
      rates: activity.rates, tjm: fallbackTjm, balance: dashboard.soldeQontoEur, now }),
    balanceComparison: mobileBalanceComparison(transactions, now),
    activityMonths,
    widget: {
      nextPaymentDays: upcoming.dueInDays,
      outstandingInvoiceHtEur: upcoming.amountHtEur,
      revenueTtcEur: dashboard.caMensuelEur,
      revenueHtEur: dashboard.ytdMonthly.find(row => row.month === month)?.revenueHtEur ?? 0,
      workedDays: activityOverview.kpis.jours,
      securedRevenueHtEur: activityOverview.kpis.caEstime,
      digitProExpensesEur: dashboard.tjmRepartitionMois.fraisDigitProEur,
      personalExpensesEur: dashboard.tjmRepartitionMois.fraisPersoEur,
      digitProExpensesChangePercent: expenseChangePercent(dashboard.tjmRepartitionMois.fraisDigitProEur, Math.max(0, previousExpenses.mandatoryFeesEur)),
      personalExpensesChangePercent: expenseChangePercent(dashboard.tjmRepartitionMois.fraisPersoEur, Math.max(0, previousExpenses.personalChargesEur))
    },
    expenses: (() => {
      const breakdown = buildMobileExpenses(transactions, now);
      const allocations = new Map<string, { personal: number; digitPro: number }>();
      const allocationFor = (period: string) => {
        const cached = allocations.get(period);
        if (cached) return cached;
        const annual = period.length === 4;
        const tree = analyzeValeurReelle(transactions, { years: annual ? [Number(period)] : null, month: annual ? null : period, now }).cashTree;
        const allocation = { personal: Math.round(Math.max(0, tree.personalChargesEur) * 100) / 100,
          digitPro: Math.round(Math.max(0, tree.mandatoryFeesEur) * 100) / 100 };
        allocations.set(period, allocation);
        return allocation;
      };
      const enrich = (row: (typeof breakdown.months)[number]) => {
        const annual = row.month.length === 4;
        const date = new Date(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7)) - 2, 1);
        const previousPeriod = annual ? String(Number(row.month) - 1) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const allocation = allocationFor(row.month), previous = allocationFor(previousPeriod);
        return { ...row, personalExpensesEur: allocation.personal, digitProExpensesEur: allocation.digitPro,
          personalChangePercent: expenseChangePercent(allocation.personal, previous.personal),
          digitProChangePercent: expenseChangePercent(allocation.digitPro, previous.digitPro) };
      };
      const years = [...new Set([now.getFullYear(), ...transactions.map(tx => Number(tx.date.slice(0, 4)))])]
        .filter(year => Number.isInteger(year) && year >= 2000 && year <= now.getFullYear()).sort();
      return {
        months: breakdown.months.map(enrich),
        years: years.map(year => {
          const months = buildMobileExpenses(transactions, now, [year]).months;
          const categories = new Map<string, (typeof months)[number]["categories"][number]>();
          for (const month of months) for (const category of month.categories) {
            const previous = categories.get(category.name);
            categories.set(category.name, previous ? { ...category, amountHt: previous.amountHt + category.amountHt,
              amountTtc: previous.amountTtc + category.amountTtc, count: previous.count + category.count } : { ...category });
          }
          return enrich({ month: String(year), totalHt: months.reduce((sum, m) => sum + m.totalHt, 0),
            totalTtc: months.reduce((sum, m) => sum + m.totalTtc, 0), categories: [...categories.values()] });
        })
      };
    })(),
    forecast: computeYearEndProjection({
      useCalendarPlan: true,
      selectedWorkDayIsos: activity.days, billableRatePeriods: activity.rates,
      fallbackTjmHt: activity.tjm ?? BILLABLE_CLIENT_TJM_HT,
      transactions, ytdRevenueHtEur: dashboard.caAnnuelEncaisseHtEur,
      tjmRepartition: dashboard.tjmRepartitionMois,
      soldeQontoEur: dashboard.soldeQontoEur,
      detteTotaleEur: dashboard.detteTotaleDepuisDebutEur,
      statsReady: transactions.length > 0, now
    }),
    treasury: (() => {
      const snapshot = computeTreasuryVerserSnapshot(transactions, "pro", now.getFullYear(), now.getMonth());
      // In the iOS forecast, this payout line represents business meals, in TTC.
      const ndfMois = Math.round(transactions.filter(tx => (tx.scope ?? "pro") === "pro"
        && tx.amount < 0 && tx.date.slice(0, 7) === month && deriveExpenseBucket(tx) === "Repas d'affaire")
        .reduce((sum, tx) => sum - tx.amount, 0) * 100) / 100;
      return { ...snapshot, ndfMois, verseCeMois: Math.round((snapshot.bncMois + snapshot.ikMois + ndfMois) * 100) / 100 };
    })(),
    lmnp: analyzeLmnp(transactions),
    ndf: summarizeNdfDigitProForMonth(transactions, month)
  };
}

/** No percentage can be calculated from a zero baseline with new spending. */
export function expenseChangePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Compare imported Qonto snapshots only; never substitute another bank or revenue. */
export function mobileBalanceComparison(transactions: DashboardTx[], now = new Date()) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = `${month}-${String(now.getDate()).padStart(2, "0")}`;
  const rows = transactions.filter(tx => isPrimaryBankCompany(tx.company) && tx.date.slice(0, 10) <= today);
  const current = computeLatestQontoBalanceEur(rows);
  const previous = computeLatestQontoBalanceEur(rows.filter(tx => tx.date.slice(0, 7) < month));
  if (current == null || previous == null) return null;
  const deltaEur = Math.round((current - previous) * 100) / 100;
  return { deltaEur, percent: previous === 0 ? (deltaEur === 0 ? 0 : null) : deltaEur / Math.abs(previous) * 100 };
}
