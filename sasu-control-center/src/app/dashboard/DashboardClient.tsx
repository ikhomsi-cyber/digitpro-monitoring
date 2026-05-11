"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarRange,
  CloudDownload,
  Receipt,
  TrendingDown,
  TrendingUp,
  User,
  Users
} from "lucide-react";
import { ExpenseTotalMiniChart } from "@/components/charts/ExpenseTotalMiniChart";
import { RevenueMiniChart } from "@/components/charts/RevenueMiniChart";
import { MonthlyStackedExpenseChart } from "@/components/charts/MonthlyStackedExpenseChart";
import { BillableDaysCalendarBlock } from "@/components/dashboard/BillableDaysCalendarBlock";
import { CounterpartyLogo } from "@/components/dashboard/CounterpartyLogo";
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
  computeRevenueYearToDateProjection,
  expenseCategoryColor,
  filterDashboardTransactions,
  omitExpenseCategoriesFromBreakdown,
  singleCategoryExpenseBreakdown,
  transactionAnalyticsDayIso,
  TVA_DERIVED_EXPENSE_BUCKET,
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

/** Mois civil courant (local), aligné avec les dates des transactions YYYY-MM-DD. */
function dashboardMonthKeyNowLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardClient({
  runtimeMode,
  canWrite,
  syncKey,
  initialTransactions,
  initialBillableWorkDays,
  initialBillableTjmHt
}: {
  runtimeMode: SupabaseRuntimeMode;
  canWrite: boolean;
  syncKey: string;
  initialTransactions: DashboardTx[];
  initialBillableWorkDays: string[];
  initialBillableTjmHt: number | null;
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<DashboardTx[]>(initialTransactions);
  const [scope, setScope] = useState<"pro" | "personal">("pro");
  /** null = fenêtre glissante 12 mois ; sinon une ou plusieurs années civiles */
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null);
  /** null = total sur toute la fenêtre d’analyse ; sinon un seul mois (YYYY-MM) pour la carte Total expenses. */
  const [totalExpensesMonthFilter, setTotalExpensesMonthFilter] = useState<string | null>(null);

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

  const billableTjmEffective = initialBillableTjmHt ?? BILLABLE_CLIENT_TJM_HT;
  const persistBillableToSupabase = canWrite && runtimeMode === "SUPABASE";

  const serverBillableKey = useMemo(
    () => [...initialBillableWorkDays].sort().join("|"),
    [initialBillableWorkDays]
  );
  const [billableWorkDayIsos, setBillableWorkDayIsos] = useState<string[]>(() =>
    [...initialBillableWorkDays].sort()
  );
  useEffect(() => {
    setBillableWorkDayIsos([...initialBillableWorkDays].sort());
  }, [serverBillableKey, initialBillableWorkDays]);

  const onBillableWorkDaysChange = useCallback((isos: readonly string[]) => {
    setBillableWorkDayIsos((prev) => {
      const next = [...isos].sort();
      if (prev.join("|") === next.join("|")) return prev;
      return next;
    });
  }, []);

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

  /** Mois de la fenêtre d’analyse déjà écoulés (≤ mois en cours), pour les moyennes. */
  const monthsElapsedInDashboardPeriod = useMemo(() => {
    if (!metrics.length) return 0;
    const cap = dashboardMonthKeyNowLocal();
    return metrics.filter((m) => m.month <= cap).length;
  }, [metrics]);

  useEffect(() => {
    if (totalExpensesMonthFilter == null) return;
    const keys = new Set(metrics.map((m) => m.month));
    if (!keys.has(totalExpensesMonthFilter)) setTotalExpensesMonthFilter(null);
  }, [metrics, totalExpensesMonthFilter]);

  const expenseCategoryBreakdown = useMemo(
    () => computeDerivedExpenseCategoryMonthlyBreakdown(filteredTx, { years: selectedYears }),
    [filteredTx, selectedYears]
  );

  const expenseCategoryBreakdownMain = useMemo(
    () =>
      omitExpenseCategoriesFromBreakdown(expenseCategoryBreakdown, [
        BNC_PAYROLL_EXPENSE_CATEGORY,
        TVA_DERIVED_EXPENSE_BUCKET
      ]),
    [expenseCategoryBreakdown]
  );

  const bncExpenseBreakdown = useMemo(
    () => singleCategoryExpenseBreakdown(expenseCategoryBreakdown, BNC_PAYROLL_EXPENSE_CATEGORY),
    [expenseCategoryBreakdown]
  );

  const stackedBncChartData = useMemo(() => {
    const cat = BNC_PAYROLL_EXPENSE_CATEGORY;
    return bncExpenseBreakdown.rows.map((r) => ({
      month: monthLabelFr(r.monthKey),
      monthKey: r.monthKey,
      [cat]: r.values[cat] ?? 0
    }));
  }, [bncExpenseBreakdown.rows]);

  const totalBncPeriod = useMemo(() => {
    const cat = BNC_PAYROLL_EXPENSE_CATEGORY;
    return sum(bncExpenseBreakdown.rows.map((r) => r.values[cat] ?? 0));
  }, [bncExpenseBreakdown.rows]);

  const avgMonthlyBnc = useMemo(() => {
    if (!monthsElapsedInDashboardPeriod) return 0;
    return totalBncPeriod / monthsElapsedInDashboardPeriod;
  }, [totalBncPeriod, monthsElapsedInDashboardPeriod]);

  const totalExpensesCard = useMemo(() => {
    if (totalExpensesMonthFilter) {
      const m = metrics.find((x) => x.month === totalExpensesMonthFilter);
      return m ? m.expenses : 0;
    }
    return sum(metrics.map((x) => x.expenses));
  }, [metrics, totalExpensesMonthFilter]);

  const expenseCategoryTotalsForTotalExpensesCard = useMemo(() => {
    const cats = expenseCategoryBreakdownMain.categories;
    if (!cats.length) return [];
    if (!totalExpensesMonthFilter) {
      const totals = new Map<string, number>();
      for (const c of cats) totals.set(c, 0);
      for (const row of expenseCategoryBreakdownMain.rows) {
        for (const c of cats) {
          totals.set(c, (totals.get(c) ?? 0) + (row.values[c] ?? 0));
        }
      }
      return cats
        .map((name) => ({ name, total: totals.get(name) ?? 0 }))
        .filter((x) => x.total > 0);
    }
    const row = expenseCategoryBreakdownMain.rows.find((r) => r.monthKey === totalExpensesMonthFilter);
    if (!row) return [];
    return cats
      .map((name) => ({ name, total: row.values[name] ?? 0 }))
      .filter((x) => x.total > 0);
  }, [expenseCategoryBreakdownMain, totalExpensesMonthFilter]);

  const VAT_RATE = 0.2;
  const totalRevenues = useMemo(() => sum(metrics.map((m) => m.revenue)), [metrics]);
  const totalRevenuesHt = useMemo(() => totalRevenues / (1 + VAT_RATE), [totalRevenues]);

  const revenueYearProjection = useMemo(
    () =>
      computeRevenueYearToDateProjection(scopedTx, {
        vatRate: VAT_RATE,
        billableWorkDayIsos: billableWorkDayIsos
      }),
    [scopedTx, billableWorkDayIsos, VAT_RATE]
  );

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

  const periodLabel = useMemo(() => {
    if (selectedYears == null) return "12 derniers mois (fenêtre glissante)";
    if (selectedYears.length === 1) return `Année ${selectedYears[0]}`;
    const sorted = [...selectedYears].sort((a, b) => a - b);
    return `Années ${sorted.join(", ")}`;
  }, [selectedYears]);

  const totalExpensesCardSubtitle = useMemo(() => {
    const base = `Hors ${BNC_PAYROLL_EXPENSE_CATEGORY} et ${TVA_DERIVED_EXPENSE_BUCKET}`;
    if (totalExpensesMonthFilter) {
      return `${base} · ${monthLabelFr(totalExpensesMonthFilter)} (mois sélectionné) · ${periodLabel}`;
    }
    return `${base} · ${periodLabel}`;
  }, [totalExpensesMonthFilter, periodLabel]);

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
      <BillableDaysCalendarBlock
        tjmHt={billableTjmEffective}
        persistToSupabase={persistBillableToSupabase}
        initialWorkDayIsos={initialBillableWorkDays}
        onWorkDaysChange={onBillableWorkDaysChange}
        treasuryTransactions={transactions}
        treasuryScope={scope}
      />

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
                  <span className="font-medium text-ink-700">Chiffre d’affaires HT</span>
                  <span className="block text-xs font-normal text-ink-500">
                    Équivalent TTC <span data-private>{formatEur(totalRevenues)}</span> · {periodLabel}
                  </span>
                </span>
              </div>
              <RevenueMiniChart
                data={monthlyRevenueHt}
                ariaLabel={`Évolution du chiffre d’affaires HT par mois — ${periodLabel}`}
              />
              <div
                className="mt-3 rounded-xl border border-emerald-200/90 bg-emerald-50/50 px-3 py-3"
                aria-label={`Projection chiffre d’affaires fin ${revenueYearProjection.calendarYear}`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200/80 bg-white text-emerald-700"
                    aria-hidden
                  >
                    <CalendarClock className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/90">
                      Projection fin {revenueYearProjection.calendarYear}
                    </p>
                    <p className="font-display text-lg font-bold tabular-nums text-emerald-950" data-private>
                      {formatEur(revenueYearProjection.projectedYearEndHt)}{" "}
                      <span className="text-xs font-semibold text-emerald-800/80">HT</span>
                    </p>
                    <p className="text-xs text-emerald-900/75" data-private>
                      Équivalent TTC estimé{" "}
                      <span className="font-medium">{formatEur(revenueYearProjection.projectedYearEndTtc)}</span>
                    </p>
                    <p className="text-xs leading-snug text-emerald-900/70" data-private>
                      Réalisé YTD HT :{" "}
                      <span className="font-medium text-emerald-950">{formatEur(revenueYearProjection.ytdHt)}</span>
                      <span className="text-emerald-800/80">
                        {" "}
                        ·{" "}
                        {revenueYearProjection.projectionBasis === "workdays" ? (
                          <>
                            {revenueYearProjection.capacityDaysElapsed} /{" "}
                            {revenueYearProjection.capacityDaysTotal} jours prévus (
                            {Math.round(revenueYearProjection.fractionOfYearElapsed * 100)} % écoulés)
                          </>
                        ) : (
                          <>
                            jour civil {revenueYearProjection.dayOfYear}/{revenueYearProjection.daysInYear} (
                            {Math.round(revenueYearProjection.fractionOfYearElapsed * 100)} % de l’année)
                          </>
                        )}
                      </span>
                    </p>
                    <p className="text-[11px] leading-snug text-emerald-800/75">
                      {revenueYearProjection.projectionBasis === "workdays" ? (
                        <>
                          Extrapolation au prorata des{" "}
                          <span className="font-medium text-emerald-900">
                            jours ouvrés (lun–ven, fériés FR exclus) et de vos coches calendrier
                          </span>{" "}
                          sur {revenueYearProjection.calendarYear}, et non sur 365 jours civils. Périmètre :{" "}
                          <span className="font-medium text-emerald-900">{scope === "pro" ? "SASU" : "Privé"}</span>
                          , hors fenêtre graphique.
                        </>
                      ) : (
                        <>
                          Extrapolation au prorata calendaire (CA réalisé ÷ part d’année écoulée). Périmètre :{" "}
                          <span className="font-medium text-emerald-900">{scope === "pro" ? "SASU" : "Privé"}</span>
                          , indépendamment de la fenêtre graphique ci-dessus.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-3" data-private>
                {revenueCounterpartyTotals.length ? (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                      Contreparties / clients · HT
                    </p>
                    <ul
                      className="max-h-36 space-y-1.5 overflow-y-auto pr-0.5 text-xs"
                      aria-label="Montants encaissés par contrepartie"
                    >
                      {revenueCounterpartyTotals.map(({ name, total }) => {
                        const totalHt = total / (1 + VAT_RATE);
                        const pct =
                          totalRevenuesHt > 0
                            ? Math.min(100, Math.round((totalHt / totalRevenuesHt) * 100))
                            : 0;
                        const showBillableDays = isCounterpartyBillableDaysAtTjm(name);
                        const htForClient = totalHt;
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
                              <span className="font-medium text-emerald-800">{formatEur(totalHt)}</span>
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

          <Card className="flex h-full min-h-0 flex-col border-ink-200/90 bg-gradient-to-b from-ink-50/40 to-white">
            <CardHeader className="flex flex-col gap-4 border-b border-ink-100/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200/60 bg-rose-50/80 text-rose-700"
                  aria-hidden
                >
                  <TrendingDown className="h-[19px] w-[19px]" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <CardTitle className="!mt-0 text-base font-semibold tracking-tight text-ink-900">
                    Total expenses
                  </CardTitle>
                  <div className="mt-1 text-xs leading-relaxed text-ink-500">{totalExpensesCardSubtitle}</div>
                  <CardValue className="mt-2">
                    <span data-private>{formatEur(totalExpensesCard)}</span>
                  </CardValue>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <label htmlFor="total-expenses-month-filter" className="sr-only">
                  Filtrer Total expenses par mois
                </label>
                <select
                  id="total-expenses-month-filter"
                  value={totalExpensesMonthFilter ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTotalExpensesMonthFilter(v === "" ? null : v);
                  }}
                  className="min-w-[11.5rem] rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  aria-label="Filtrer les totaux et catégories par mois civil"
                >
                  <option value="">Toute la période</option>
                  {metrics.map((m) => (
                    <option key={m.month} value={m.month}>
                      {monthLabelFr(m.month)}
                    </option>
                  ))}
                </select>
                <div
                  className="inline-flex items-center justify-end gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-sm"
                  title={
                    totalExpensesMonthFilter
                      ? undefined
                      : "Nombre de mois écoulés dans la fenêtre (jusqu’au mois en cours), utilisé pour les moyennes"
                  }
                >
                  <Calendar className="h-3.5 w-3.5 text-ink-500" aria-hidden />
                  {totalExpensesMonthFilter
                    ? monthLabelFr(totalExpensesMonthFilter)
                    : `${monthsElapsedInDashboardPeriod || 0} mois`}
                </div>
              </div>
            </CardHeader>
            <CardBody className="flex flex-1 flex-col pt-6">
              <div className="mb-1 flex items-start gap-2.5 text-sm text-ink-500">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50/90 text-rose-700"
                  aria-hidden
                >
                  <Receipt className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="leading-snug">
                  <span className="font-medium text-ink-700">Synthèse des dépenses</span>
                  <span className="block text-xs font-normal text-ink-500">
                    Total sur la période · graphique ci-dessous
                  </span>
                </span>
              </div>
              <ExpenseTotalMiniChart
                data={monthlyTotalExpensesSeries}
                ariaLabel={`Évolution des dépenses par mois (hors BNC et TVA) — ${periodLabel}${totalExpensesMonthFilter ? ` — filtre ${monthLabelFr(totalExpensesMonthFilter)}` : ""}`}
              />
              <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-4" data-private>
                {expenseCategoryTotalsForTotalExpensesCard.length ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      {totalExpensesMonthFilter
                        ? "Catégories · ce mois"
                        : "Catégories · total période et moy. / mois (période écoulée)"}
                    </p>
                    <ul
                      className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5 text-xs"
                      aria-label="Détail des dépenses par catégorie"
                    >
                      {expenseCategoryTotalsForTotalExpensesCard.map(({ name, total }) => {
                        const pct =
                          totalExpensesCard > 0 ? Math.min(100, Math.round((total / totalExpensesCard) * 100)) : 0;
                        const color = expenseCategoryColor(name);
                        const CatIcon = categoryGlyph(name);
                        const avgMonthly =
                          monthsElapsedInDashboardPeriod > 0
                            ? total / monthsElapsedInDashboardPeriod
                            : 0;
                        return (
                          <li
                            key={name}
                            className="flex items-center justify-between gap-2 border-b border-ink-100 pb-2 last:border-0 last:pb-0"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-white text-ink-700 shadow-sm"
                                style={{ borderColor: color, color }}
                                aria-hidden
                              >
                                <CatIcon className="h-3.5 w-3.5" strokeWidth={2} />
                              </span>
                              <span className="truncate text-sm font-medium text-ink-800">{name}</span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                              <span className="flex items-baseline gap-2">
                                <span className="text-sm font-semibold text-ink-900">{formatEur(total)}</span>
                                <span className="w-7 text-right text-[10px] font-medium text-ink-400">
                                  {pct}%
                                </span>
                              </span>
                              {!totalExpensesMonthFilter && monthsElapsedInDashboardPeriod > 0 ? (
                                <span className="text-[11px] font-medium text-rose-700/90">
                                  moy. {formatEur(avgMonthly)} <span className="font-normal text-ink-500">/ mois</span>
                                </span>
                              ) : null}
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

      <section className="space-y-4" aria-label="Graphiques des dépenses">
        <Card>
          <CardHeader className="items-start">
            <div>
              <DashboardBlockTitle icon={Users} iconTone="crew">
                BNC
              </DashboardBlockTitle>
              <CardValue>
                <span data-private>{formatEur(totalBncPeriod)}</span>
              </CardValue>
              <div className="mt-1 text-xs text-ink-500">Total sur la période · {periodLabel}</div>
              <div className="mt-0.5 text-xs text-ink-400">{BNC_PAYROLL_EXPENSE_CATEGORY} uniquement</div>
              <div className="mt-4 border-t border-ink-200 pt-3">
                <div
                  className="font-display text-xl font-semibold tabular-nums text-ink-900"
                  data-private
                >
                  {formatEur(avgMonthlyBnc)}
                </div>
                <div className="mt-1 text-xs text-ink-500">
                  Moyenne mensuelle <span className="text-ink-400">(période écoulée)</span>
                </div>
              </div>
            </div>
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700"
              title="Mois écoulés dans la fenêtre (jusqu’au mois en cours), base de la moyenne BNC"
            >
              <Calendar className="h-3.5 w-3.5 text-ink-500" aria-hidden />
              {monthsElapsedInDashboardPeriod || 0} mois
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
      </section>


      <Chatbot />
    </main>
  );
}
