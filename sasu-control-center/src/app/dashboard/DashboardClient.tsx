"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Calendar,
  CalendarRange,
  CloudDownload,
  Layers,
  Receipt,
  TrendingDown,
  TrendingUp,
  User,
  Users
} from "lucide-react";
import { MonthlyAreaChart } from "@/components/charts/MonthlyAreaChart";
import { ExpenseTotalMiniChart } from "@/components/charts/ExpenseTotalMiniChart";
import { RevenueMiniChart } from "@/components/charts/RevenueMiniChart";
import { MonthlyStackedExpenseChart } from "@/components/charts/MonthlyStackedExpenseChart";
import { CounterpartyLogo } from "@/components/dashboard/CounterpartyLogo";
import { DashboardExpenseDonutSection } from "@/components/dashboard/DashboardExpenseDonutSection";
import type { StackedExpenseChartRow } from "@/components/charts/MonthlyStackedExpenseChartClient";
import { Card, CardBody, CardHeader, CardTitle, CardValue } from "@/components/ui/Card";
import { Chatbot } from "@/components/Chatbot";
import { formatEur } from "@/lib/format";
import { categoryGlyph } from "@/lib/analyse-category-meta";
import {
  BILLABLE_CLIENT_TJM_HT,
  formatWorkedDaysFr,
  isCounterpartyBillableDaysAtTjm
} from "@/lib/billable-client-days";
import { isRevenueCategory, revenueCounterpartyDisplayName } from "@/lib/revenue-category";
import {
  BNC_PAYROLL_EXPENSE_CATEGORY,
  computeDashboardMonthlyMetrics,
  computeDerivedExpenseCategoryMonthlyBreakdown,
  expenseCategoryColor,
  filterDashboardTransactions,
  omitExpenseCategoriesFromBreakdown,
  singleCategoryExpenseBreakdown,
  transactionAnalyticsDayIso,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { syncQontoTransactionsFromApi } from "./actions";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

export type { DashboardTx };

const dashboardIconToneClass: Record<
  "default" | "revenue" | "expense" | "chart" | "crew",
  string
> = {
  default: "border-ink-200 bg-white text-ink-700 shadow-sm",
  revenue:
    "border-emerald-200/90 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100/40",
  expense: "border-rose-200/90 bg-rose-50 text-rose-700 shadow-sm shadow-rose-100/40",
  chart: "border-violet-200/90 bg-violet-50 text-violet-700 shadow-sm shadow-violet-100/40",
  crew: "border-amber-200/90 bg-amber-50 text-amber-700 shadow-sm shadow-amber-100/40"
};

function DashboardBlockTitle({
  icon: Icon,
  children,
  titleClassName,
  iconTone = "default"
}: {
  icon: LucideIcon;
  children: ReactNode;
  titleClassName?: string;
  iconTone?: keyof typeof dashboardIconToneClass;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={clsx(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          dashboardIconToneClass[iconTone]
        )}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <CardTitle className={clsx("min-w-0 flex-1 !mt-0 leading-snug", titleClassName)}>
        {children}
      </CardTitle>
    </div>
  );
}

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0);
}

function monthLabelFr(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(d);
}

export function DashboardClient({
  runtimeMode,
  canWrite,
  syncKey,
  initialTransactions
}: {
  runtimeMode: SupabaseRuntimeMode;
  canWrite: boolean;
  syncKey: string;
  initialTransactions: DashboardTx[];
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<DashboardTx[]>(initialTransactions);
  const [scope, setScope] = useState<"pro" | "personal">("pro");
  /** null = fenêtre glissante 12 mois ; sinon une ou plusieurs années civiles */
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null);
  /** Catégories masquées dans le graphique empilé des dépenses (la légende permet de les réactiver). */
  const [hiddenExpenseCategories, setHiddenExpenseCategories] = useState<Set<string>>(() => new Set());
  /** Drill-down mois (YYYY-MM) pour la liste des transactions sous les graphiques. */

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [syncKey, initialTransactions]);

  // If the dataset contains personal transactions, default the toggle based on what exists.
  // Otherwise stay on "pro" for backwards-compat.
  useEffect(() => {
    const hasPersonal = initialTransactions.some((t) => t.scope === "personal");
    if (!hasPersonal) setScope("pro");
  }, [initialTransactions]);

  const [isPending, startTransition] = useTransition();

  const analyticsFilter = useMemo(() => ({ years: selectedYears }), [selectedYears]);

  const scopedTx = useMemo(
    () => transactions.filter((t) => (t.scope ?? "pro") === scope),
    [transactions, scope]
  );

  const filteredTx = useMemo(
    () => filterDashboardTransactions(scopedTx, analyticsFilter),
    [scopedTx, analyticsFilter]
  );

  const metrics = useMemo(
    () => computeDashboardMonthlyMetrics(filteredTx, { years: selectedYears }),
    [filteredTx, selectedYears]
  );

  const expenseCategoryBreakdown = useMemo(
    () => computeDerivedExpenseCategoryMonthlyBreakdown(filteredTx, { years: selectedYears }),
    [filteredTx, selectedYears]
  );

  const expenseCategoryBreakdownMain = useMemo(
    () => omitExpenseCategoriesFromBreakdown(expenseCategoryBreakdown, [BNC_PAYROLL_EXPENSE_CATEGORY]),
    [expenseCategoryBreakdown]
  );

  const bncExpenseBreakdown = useMemo(
    () => singleCategoryExpenseBreakdown(expenseCategoryBreakdown, BNC_PAYROLL_EXPENSE_CATEGORY),
    [expenseCategoryBreakdown]
  );

  const visibleExpenseCategories = useMemo(
    () => expenseCategoryBreakdownMain.categories.filter((c) => !hiddenExpenseCategories.has(c)),
    [expenseCategoryBreakdownMain.categories, hiddenExpenseCategories]
  );

  const stackedExpenseChartData = useMemo(() => {
    const rows: StackedExpenseChartRow[] = expenseCategoryBreakdownMain.rows.map((r) => {
      const row: StackedExpenseChartRow = {
        month: monthLabelFr(r.monthKey),
        monthKey: r.monthKey
      };
      for (const c of visibleExpenseCategories) {
        row[c] = r.values[c] ?? 0;
      }
      return row;
    });
    return rows;
  }, [expenseCategoryBreakdownMain.rows, visibleExpenseCategories]);

  const stackedBncChartData = useMemo(() => {
    const cat = BNC_PAYROLL_EXPENSE_CATEGORY;
    return bncExpenseBreakdown.rows.map((r) => ({
      month: monthLabelFr(r.monthKey),
      monthKey: r.monthKey,
      [cat]: r.values[cat] ?? 0
    }));
  }, [bncExpenseBreakdown.rows]);

  const monthlyExpensesExcludingBnc = useMemo(
    () =>
      expenseCategoryBreakdownMain.rows.map((r) => ({
        month: monthLabelFr(r.monthKey),
        monthKey: r.monthKey,
        value: Math.round(sum(Object.values(r.values)))
      })),
    [expenseCategoryBreakdownMain.rows]
  );

  const avgMonthlyExpensesMain = useMemo(() => {
    if (!monthlyExpensesExcludingBnc.length) return 0;
    return sum(monthlyExpensesExcludingBnc.map((p) => p.value)) / monthlyExpensesExcludingBnc.length;
  }, [monthlyExpensesExcludingBnc]);

  const avgMonthlyBnc = useMemo(() => {
    const cat = BNC_PAYROLL_EXPENSE_CATEGORY;
    if (!bncExpenseBreakdown.rows.length) return 0;
    return sum(bncExpenseBreakdown.rows.map((r) => r.values[cat] ?? 0)) / bncExpenseBreakdown.rows.length;
  }, [bncExpenseBreakdown.rows]);

  const totalExpenses = useMemo(() => sum(metrics.map((m) => m.expenses)), [metrics]);

  const VAT_RATE = 0.2;
  const totalRevenues = useMemo(() => sum(metrics.map((m) => m.revenue)), [metrics]);
  const totalRevenuesHt = useMemo(() => totalRevenues / (1 + VAT_RATE), [totalRevenues]);

  const monthlyRevenueHt = useMemo(
    () =>
      metrics.map((m) => ({
        month: monthLabelFr(m.month),
        monthKey: m.month,
        value: Math.round((m.revenue / (1 + VAT_RATE)) * 100) / 100
      })),
    [metrics, VAT_RATE]
  );

  /** Contreparties / clients : libellé (contrepartie Qonto) en priorité, voir `revenueCounterpartyDisplayName`. */
  const revenueCounterpartyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredTx) {
      if (!isRevenueCategory(tx.category) || tx.amount <= 0) continue;
      const name = revenueCounterpartyDisplayName(tx);
      map.set(name, (map.get(name) ?? 0) + tx.amount);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredTx]);

  const monthlyTotalExpensesSeries = useMemo(
    () =>
      metrics.map((m) => ({
        month: monthLabelFr(m.month),
        monthKey: m.month,
        value: Math.round(m.expenses * 100) / 100
      })),
    [metrics]
  );

  const expenseCategoryPeriodTotals = useMemo(() => {
    const cats = expenseCategoryBreakdown.categories.filter(
      (c) => c !== BNC_PAYROLL_EXPENSE_CATEGORY
    );
    if (!cats.length) return [];
    const totals = new Map<string, number>();
    for (const c of cats) totals.set(c, 0);
    for (const row of expenseCategoryBreakdown.rows) {
      for (const c of cats) {
        totals.set(c, (totals.get(c) ?? 0) + (row.values[c] ?? 0));
      }
    }
    return cats
      .map((name) => ({ name, total: totals.get(name) ?? 0 }))
      .filter((x) => x.total > 0);
  }, [expenseCategoryBreakdown]);

  const periodLabel = useMemo(() => {
    if (selectedYears == null) return "12 derniers mois (fenêtre glissante)";
    if (selectedYears.length === 1) return `Année ${selectedYears[0]}`;
    const sorted = [...selectedYears].sort((a, b) => a - b);
    return `Années ${sorted.join(", ")}`;
  }, [selectedYears]);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    for (const t of transactions) {
      const y = Number(transactionAnalyticsDayIso(t).slice(0, 4));
      if (Number.isFinite(y)) ys.add(y);
    }
    const list = Array.from(ys).sort((a, b) => b - a);
    return list.length ? list : [new Date().getFullYear()];
  }, [transactions]);

  function onClickSyncQontoApi() {
    if (runtimeMode === "DEMO") {
      toast.warning("API Qonto indisponible en mode démo.");
      return;
    }
    if (!canWrite) {
      toast.warning("Action désactivée", { description: "Aucune base n’est connectée." });
      return;
    }
    const toastId = toast.loading("Synchronisation Qonto (API) en cours…");
    startTransition(async () => {
      try {
        const result = await syncQontoTransactionsFromApi();
        router.refresh();
        toast.success("Qonto synchronisé", {
          id: toastId,
          description: `${result.inserted} nouvelle(s) · ${result.merged} fusion(s) · ${result.totalFromApi} ligne(s) API · ${result.bankAccountSummary}`
        });
      } catch (e) {
        toast.error("Synchronisation Qonto échouée", {
          id: toastId,
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  function toggleYearInFilter(y: number) {
    setSelectedYears((prev) => {
      const base = prev ?? [yearOptions[0] ?? new Date().getFullYear()];
      const next = new Set(base);
      if (next.has(y)) {
        if (next.size <= 1) return prev;
        next.delete(y);
      } else {
        next.add(y);
      }
      return Array.from(next).sort((a, b) => b - a);
    });
  }

  return (
    <main className="mt-8 space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500">
              <CalendarRange className="h-4 w-4 text-ink-400" aria-hidden />
              Fenêtre d’analyse
            </span>
            <div className="inline-flex rounded-full border border-ink-300 bg-ink-50/80 p-1">
              <button
                type="button"
                aria-pressed={scope === "pro"}
                onClick={() => setScope("pro")}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                  scope === "pro" ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
                )}
              >
                <Briefcase className="h-3.5 w-3.5 opacity-80" aria-hidden />
                SASU
              </button>
              <button
                type="button"
                aria-pressed={scope === "personal"}
                onClick={() => setScope("personal")}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                  scope === "personal"
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-600 hover:text-ink-900"
                )}
              >
                <User className="h-3.5 w-3.5 opacity-80" aria-hidden />
                Privé
              </button>
            </div>
            <div className="inline-flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="inline-flex rounded-full border border-ink-300 bg-ink-50/80 p-1">
                <button
                  type="button"
                  aria-pressed={selectedYears === null}
                  onClick={() => setSelectedYears(null)}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                    selectedYears === null
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-600 hover:text-ink-900"
                  )}
                >
                  <CalendarRange className="h-3.5 w-3.5 opacity-80" aria-hidden />
                  12 mois glissants
                </button>
                <button
                  type="button"
                  aria-pressed={selectedYears !== null}
                  onClick={() =>
                    setSelectedYears((prev) => prev ?? [yearOptions[0] ?? new Date().getFullYear()])
                  }
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                    selectedYears !== null
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-600 hover:text-ink-900"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5 opacity-80" aria-hidden />
                  Année(s) civile(s)
                </button>
              </div>
              {selectedYears != null ? (
                <div
                  className="flex max-w-full flex-wrap items-center gap-2 sm:pl-1"
                  role="group"
                  aria-label="Sélection des années à inclure"
                >
                  <span className="text-xs font-medium text-ink-500">Inclure :</span>
                  {yearOptions.map((y) => {
                    const on = selectedYears.includes(y);
                    return (
                      <button
                        key={y}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleYearInFilter(y)}
                        className={clsx(
                          "rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                          on
                            ? "border-brand-500 bg-brand-50 text-brand-900 shadow-sm"
                            : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                        )}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {canWrite ? (
              <button
                type="button"
                onClick={onClickSyncQontoApi}
                disabled={isPending}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
                title="Récupère les transactions via l’API Qonto (variables QONTO_LOGIN et QONTO_SECRET_KEY côté serveur)."
              >
                <CloudDownload className="h-4 w-4 text-ink-500" aria-hidden />
                Synchroniser Qonto (API)
              </button>
            ) : null}
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-ink-500 lg:text-right">
            Vue active : <span className="font-medium text-ink-700">{periodLabel}</span>.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <Card variant="solid" className="flex h-full min-h-0 flex-col">
            <CardHeader className="pb-3">
              <DashboardBlockTitle icon={TrendingUp} iconTone="revenue">
                Total revenues
              </DashboardBlockTitle>
            </CardHeader>
            <CardBody className="flex flex-1 flex-col pt-0">
              <CardValue>
                <span data-private>{formatEur(totalRevenuesHt)}</span>
                <span className="ml-2 align-middle text-xs font-medium text-ink-500">HT</span>
              </CardValue>
              <div className="mt-3 flex items-start gap-2.5 text-sm text-ink-500">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
                  aria-hidden
                >
                  <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="leading-snug">
                  <span className="font-medium text-ink-700">TTC</span>{" "}
                  <span data-private>{formatEur(totalRevenues)}</span>
                  <span className="block text-xs font-normal text-ink-500">{periodLabel}</span>
                </span>
              </div>
              <RevenueMiniChart
                data={monthlyRevenueHt}
                ariaLabel={`Évolution du chiffre d’affaires HT par mois — ${periodLabel}`}
              />
              <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-3" data-private>
                {revenueCounterpartyTotals.length ? (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                      Contreparties / clients
                    </p>
                    <ul
                      className="max-h-36 space-y-1.5 overflow-y-auto pr-0.5 text-xs"
                      aria-label="Montants encaissés par contrepartie"
                    >
                      {revenueCounterpartyTotals.map(({ name, total }) => {
                        const pct =
                          totalRevenues > 0 ? Math.min(100, Math.round((total / totalRevenues) * 100)) : 0;
                        const showBillableDays = isCounterpartyBillableDaysAtTjm(name);
                        const htForClient = total / (1 + VAT_RATE);
                        const workedDays = showBillableDays ? htForClient / BILLABLE_CLIENT_TJM_HT : 0;
                        return (
                          <li
                            key={name}
                            className="flex items-baseline justify-between gap-2 border-b border-ink-100 pb-1.5 last:border-0 last:pb-0"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <CounterpartyLogo name={name} size={22} />
                              <span className="min-w-0">
                                <span className="block truncate text-ink-700">{name}</span>
                                {showBillableDays ? (
                                  <span className="mt-0.5 block text-[10px] font-normal leading-snug text-ink-500">
                                    ≈ {formatWorkedDaysFr(workedDays)} j · TJM{" "}
                                    {formatEur(BILLABLE_CLIENT_TJM_HT)} HT
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                              <span className="font-medium text-emerald-800">{formatEur(total)}</span>
                              <span className="w-8 text-right text-[10px] text-ink-400">{pct}%</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-ink-500">
                    Aucun encaissement « Chiffre d’affaires » sur cette période.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card variant="solid" className="flex h-full min-h-0 flex-col">
          <CardHeader className="pb-3">
            <DashboardBlockTitle icon={TrendingDown} iconTone="expense">
              Total expenses
            </DashboardBlockTitle>
          </CardHeader>
          <CardBody className="flex flex-1 flex-col pt-0">
            <CardValue>
              <span data-private>{formatEur(totalExpenses)}</span>
            </CardValue>
            <div className="mt-3 flex items-start gap-2.5 text-sm text-ink-500">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700"
                aria-hidden
              >
                <Receipt className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="leading-snug">
                <span className="font-medium text-ink-700">Total sorties</span>
                <span className="block text-xs font-normal text-ink-500">{periodLabel}</span>
              </span>
            </div>
            <ExpenseTotalMiniChart
              data={monthlyTotalExpensesSeries}
              ariaLabel={`Évolution des dépenses totales par mois — ${periodLabel}`}
            />
            <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-3" data-private>
              {expenseCategoryPeriodTotals.length ? (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    Détail sur la période
                  </p>
                  <ul className="max-h-36 space-y-1.5 overflow-y-auto pr-0.5 text-xs" aria-label="Détail des dépenses par catégorie">
                    {expenseCategoryPeriodTotals.map(({ name, total }) => {
                      const pct =
                        totalExpenses > 0 ? Math.min(100, Math.round((total / totalExpenses) * 100)) : 0;
                      const color = expenseCategoryColor(name);
                      const CatIcon = categoryGlyph(name);
                      return (
                        <li
                          key={name}
                          className="flex items-baseline justify-between gap-2 border-b border-ink-100 pb-1.5 last:border-0 last:pb-0"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border bg-white text-ink-700 shadow-sm"
                              style={{ borderColor: color, color }}
                              aria-hidden
                            >
                              <CatIcon className="h-3 w-3" strokeWidth={2} />
                            </span>
                            <span className="truncate text-ink-700">{name}</span>
                          </span>
                          <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                            <span className="font-medium text-ink-900">{formatEur(total)}</span>
                            <span className="w-8 text-right text-[10px] text-ink-400">{pct}%</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-ink-500">Aucune dépense sur cette période.</p>
              )}
            </div>
          </CardBody>
        </Card>
        </div>
      </section>

      <section className="space-y-4" aria-label="Graphiques et répartition des dépenses">
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader className="items-start">
            <div>
              <DashboardBlockTitle icon={BarChart3} iconTone="chart">
                Monthly expenses
              </DashboardBlockTitle>
              <CardValue>
                <span data-private>{formatEur(avgMonthlyExpensesMain)}</span>
              </CardValue>
              <div className="mt-1 text-xs text-ink-500">
                Moyenne mensuelle (hors {BNC_PAYROLL_EXPENSE_CATEGORY}) · {periodLabel}
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700">
              <Calendar className="h-3.5 w-3.5 text-ink-500" aria-hidden />
              {metrics.length || 0} mois
            </div>
          </CardHeader>
          <CardBody>
            <div data-private className="space-y-4">
              {expenseCategoryBreakdownMain.categories.length === 0 ? (
                <MonthlyAreaChart
                  data={monthlyExpensesExcludingBnc}
                  color={{ stroke: "#ef4444", fill: "#ef4444" }}
                />
              ) : (
                <>
                  <MonthlyStackedExpenseChart
                    data={stackedExpenseChartData}
                    visibleCategories={visibleExpenseCategories}
                  />
                  <div className="border-t border-ink-200 pt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                      <Layers className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                      Catégories (clic pour afficher ou masquer)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {expenseCategoryBreakdownMain.categories.map((cat) => {
                        const visible = !hiddenExpenseCategories.has(cat);
                        const color = expenseCategoryColor(cat);
                        const CatIcon = categoryGlyph(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setHiddenExpenseCategories((prev) => {
                                const next = new Set(prev);
                                if (next.has(cat)) next.delete(cat);
                                else next.add(cat);
                                return next;
                              });
                            }}
                            className={`chip max-w-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                              visible ? "border-ink-300 opacity-100" : "border-ink-200 opacity-45"
                            }`}
                            aria-pressed={visible}
                            aria-label={
                              visible
                                ? `Masquer la catégorie ${cat} du graphique`
                                : `Afficher la catégorie ${cat} dans le graphique`
                            }
                          >
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border bg-white text-ink-700"
                              style={{ borderColor: color, color }}
                              aria-hidden
                            >
                              <CatIcon className="h-3.5 w-3.5" strokeWidth={2} />
                            </span>
                            <span className="min-w-0 max-w-[16rem] break-words text-left leading-snug">
                              {cat}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="items-start">
            <div>
              <DashboardBlockTitle icon={Users} iconTone="crew">
                BNC
              </DashboardBlockTitle>
              <CardValue>
                <span data-private>{formatEur(avgMonthlyBnc)}</span>
              </CardValue>
              <div className="mt-1 text-xs text-ink-500">Moyenne mensuelle · {periodLabel}</div>
              <div className="mt-0.5 text-xs text-ink-400">{BNC_PAYROLL_EXPENSE_CATEGORY} uniquement</div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700">
              <Calendar className="h-3.5 w-3.5 text-ink-500" aria-hidden />
              {metrics.length || 0} mois
            </div>
          </CardHeader>
          <CardBody>
            <div data-private>
              <MonthlyStackedExpenseChart
                data={stackedBncChartData}
                visibleCategories={bncExpenseBreakdown.categories}
              />
            </div>
          </CardBody>
        </Card>

        <DashboardExpenseDonutSection
          metrics={metrics}
          filteredTx={filteredTx}
          expenseCategoryBreakdown={expenseCategoryBreakdown}
          canWrite={canWrite}
        />
      </section>


      <Chatbot />
    </main>
  );
}
