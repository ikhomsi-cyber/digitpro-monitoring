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
  ChevronDown,
  CloudDownload,
  Landmark,
  Receipt,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import { ExpenseTotalMiniChart } from "@/components/charts/ExpenseTotalMiniChart";
import { RevenueMiniChart } from "@/components/charts/RevenueMiniChart";
import { BillableDaysCalendarBlock } from "@/components/dashboard/BillableDaysCalendarBlock";
import { CounterpartyLogo } from "@/components/dashboard/CounterpartyLogo";
import { Card, CardBody, CardHeader, CardTitle, CardValue } from "@/components/ui/Card";
import { Chatbot } from "@/components/Chatbot";
import { formatEur } from "@/lib/format";
import { categoryGlyph } from "@/lib/category-glyph";
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
  countsTowardDashboardExpenseTotal,
  expenseCategoryColor,
  filterDashboardTransactions,
  omitExpenseCategoriesFromBreakdown,
  transactionAnalyticsDayIso,
  TVA_DERIVED_EXPENSE_BUCKET,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { syncQontoTransactionsFromApi, syncRevolutPersonalPowensFromApi } from "./actions";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";

export type { DashboardTx };

const dashboardIconToneClass: Record<
  "default" | "revenue" | "expense" | "chart" | "crew",
  string
> = {
  default:
    "border-ink-200 bg-white text-ink-700 shadow-sm dark:border-ink-700 dark:bg-ink-800/90 dark:text-ink-100 dark:shadow-none",
  revenue:
    "border-emerald-200/90 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100/40 dark:border-emerald-800/70 dark:bg-emerald-950/45 dark:text-emerald-300 dark:shadow-none",
  expense:
    "border-rose-200/90 bg-rose-50 text-rose-700 shadow-sm shadow-rose-100/40 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200 dark:shadow-none",
  chart:
    "border-violet-200/90 bg-violet-50 text-violet-700 shadow-sm shadow-violet-100/40 dark:border-violet-800/70 dark:bg-violet-950/40 dark:text-violet-200 dark:shadow-none",
  crew:
    "border-amber-200/90 bg-amber-50 text-amber-700 shadow-sm shadow-amber-100/40 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-200 dark:shadow-none"
};

/** Catégories dérivées listées sous Total expenses : les plus importantes d’abord (même vue que les %). */
const TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES = 6;

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
  /** Contrepartie CA sélectionnée dans la carte Total revenues (liste des encaissements). */
  const [revenueCounterpartyDetail, setRevenueCounterpartyDetail] = useState<string | null>(null);
  /** Catégorie dérivée sélectionnée dans Total expenses (liste des opérations). */
  const [expenseCategoryDetail, setExpenseCategoryDetail] = useState<string | null>(null);
  /** Filtre global des dépenses (buckets dérivés) : vide = toutes les catégories. */
  const [selectedExpenseCategoryFilters, setSelectedExpenseCategoryFilters] = useState<string[]>([]);

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [syncKey, initialTransactions]);

  useEffect(() => {
    setRevenueCounterpartyDetail(null);
    setExpenseCategoryDetail(null);
    setSelectedExpenseCategoryFilters([]);
  }, [scope, selectedYears, syncKey]);

  useEffect(() => {
    setExpenseCategoryDetail(null);
  }, [totalExpensesMonthFilter, selectedExpenseCategoryFilters]);

  // If the dataset contains personal transactions, default the toggle based on what exists.
  // Otherwise stay on "pro" for backwards-compat.
  useEffect(() => {
    const hasPersonal = initialTransactions.some((t) => t.scope === "personal");
    if (!hasPersonal) setScope("pro");
  }, [initialTransactions]);

  const [isPending, startTransition] = useTransition();

  const canUsePowens = canWrite && runtimeMode === "SUPABASE";

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

  const onClickConnectRevolutPowens = useCallback(async () => {
    if (!canUsePowens) return;
    try {
      const initRes = await fetch("/api/powens/init", { method: "POST" });
      const initJson = (await initRes.json().catch(() => null)) as null | { ok?: boolean; error?: string };
      if (!initRes.ok || !initJson?.ok) {
        throw new Error(initJson?.error || `Powens init failed (${initRes.status})`);
      }

      const urlRes = await fetch("/api/powens/connect-url", { method: "GET" });
      const urlJson = (await urlRes.json().catch(() => null)) as null | { ok?: boolean; url?: string; error?: string };
      if (!urlRes.ok || !urlJson?.ok || !urlJson.url) {
        throw new Error(urlJson?.error || `Powens connect-url failed (${urlRes.status})`);
      }

      window.open(urlJson.url, "_blank", "noopener,noreferrer");
      toast.success("Powens Connect : choisis Revolut (compte personnel), puis reviens synchroniser.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de démarrer Powens Connect.");
    }
  }, [canUsePowens]);

  function onClickSyncRevolutPowens() {
    if (!canUsePowens) return;
    const toastId = toast.loading("Synchronisation Revolut (Powens)…");
    startTransition(async () => {
      try {
        const json = await syncRevolutPersonalPowensFromApi();
        toast.success("Revolut synchronisé", {
          id: toastId,
          description: `Comptes: ${json.accounts.kept} · lignes Powens: ${json.transactions.upserted} · import dashboard: ${json.dashboardImported}${
            json.hint ? ` · ${json.hint}` : ""
          }`
        });
        try {
          await router.refresh();
        } catch {
          toast.message("Si les chiffres ne se mettent pas à jour, rechargez la page (F5).", { duration: 8000 });
        }
      } catch (e) {
        toast.error("Synchronisation Revolut impossible", {
          id: toastId,
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  const analyticsFilter = useMemo(() => ({ years: selectedYears }), [selectedYears]);

  const scopedTx = useMemo(
    () => transactions.filter((t) => (t.scope ?? "pro") === scope),
    [transactions, scope]
  );

  const periodFilteredTx = useMemo(
    () => filterDashboardTransactions(scopedTx, analyticsFilter),
    [scopedTx, analyticsFilter]
  );

  const filteredTx = useMemo(() => {
    if (!selectedExpenseCategoryFilters.length) return periodFilteredTx;
    const allow = new Set(selectedExpenseCategoryFilters);
    return periodFilteredTx.filter((tx) => {
      if (tx.amount >= 0) return true;
      return allow.has(deriveExpenseBucket(tx));
    });
  }, [periodFilteredTx, selectedExpenseCategoryFilters]);

  const expenseCategoryFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const tx of periodFilteredTx) {
      if (!countsTowardDashboardExpenseTotal(tx)) continue;
      set.add(deriveExpenseBucket(tx));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [periodFilteredTx]);

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
    let withTotals: { name: string; total: number }[];
    if (!totalExpensesMonthFilter) {
      const totals = new Map<string, number>();
      for (const c of cats) totals.set(c, 0);
      for (const row of expenseCategoryBreakdownMain.rows) {
        for (const c of cats) {
          totals.set(c, (totals.get(c) ?? 0) + (row.values[c] ?? 0));
        }
      }
      withTotals = cats
        .map((name) => ({ name, total: totals.get(name) ?? 0 }))
        .filter((x) => x.total > 0);
    } else {
      const row = expenseCategoryBreakdownMain.rows.find((r) => r.monthKey === totalExpensesMonthFilter);
      if (!row) return [];
      withTotals = cats
        .map((name) => ({ name, total: row.values[name] ?? 0 }))
        .filter((x) => x.total > 0);
    }
    return withTotals
      .sort((a, b) => b.total - a.total)
      .slice(0, TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES);
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

  const revenueTransactionsForCounterparty = useMemo(() => {
    if (!revenueCounterpartyDetail) return [];
    return filteredTx
      .filter(
        (tx) =>
          isRevenueCategory(tx.category) &&
          tx.amount > 0 &&
          revenueCounterpartyDisplayName(tx) === revenueCounterpartyDetail
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [filteredTx, revenueCounterpartyDetail]);

  const expenseTransactionsForCategory = useMemo(() => {
    if (!expenseCategoryDetail) return [];
    return filteredTx
      .filter((tx) => {
        if (tx.amount >= 0) return false;
        if (deriveExpenseBucket(tx) !== expenseCategoryDetail) return false;
        if (totalExpensesMonthFilter && tx.date.slice(0, 7) !== totalExpensesMonthFilter) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [filteredTx, expenseCategoryDetail, totalExpensesMonthFilter]);

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
    let s: string;
    if (totalExpensesMonthFilter) {
      s = `${base} · ${monthLabelFr(totalExpensesMonthFilter)} (mois sélectionné) · ${periodLabel}`;
    } else {
      s = `${base} · ${periodLabel}`;
    }
    if (selectedExpenseCategoryFilters.length) {
      const n = selectedExpenseCategoryFilters.length;
      s += ` · Filtre : ${n} catégorie${n > 1 ? "s" : ""}`;
    }
    return s;
  }, [totalExpensesMonthFilter, periodLabel, selectedExpenseCategoryFilters]);

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
        toast.success("Qonto synchronisé", {
          id: toastId,
          description: `${result.inserted} nouvelle(s) · ${result.merged} fusion(s) · ${result.totalFromApi} ligne(s) API · ${result.bankAccountSummary}`
        });
        router.refresh();
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

  const toggleExpenseCategoryFilter = useCallback((cat: string) => {
    setSelectedExpenseCategoryFilters((prev) => {
      const s = new Set(prev);
      if (s.has(cat)) s.delete(cat);
      else s.add(cat);
      return Array.from(s).sort((a, b) => a.localeCompare(b, "fr"));
    });
  }, []);

  return (
    <main className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
      <BillableDaysCalendarBlock
        tjmHt={billableTjmEffective}
        persistToSupabase={persistBillableToSupabase}
        initialWorkDayIsos={initialBillableWorkDays}
        onWorkDaysChange={onBillableWorkDaysChange}
        treasuryTransactions={transactions}
        treasuryScope={scope}
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900/50 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
              <CalendarRange className="h-4 w-4 text-ink-400" aria-hidden />
              Fenêtre d’analyse
            </span>
            <div className="inline-flex max-w-full rounded-full border border-ink-300 bg-ink-50/80 p-1 dark:border-ink-700 dark:bg-ink-950/80">
              <button
                type="button"
                aria-pressed={scope === "pro"}
                onClick={() => setScope("pro")}
                className={clsx(
                  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 sm:flex-initial",
                  scope === "pro"
                    ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                    : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
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
                  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 sm:flex-initial",
                  scope === "personal"
                    ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                    : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                )}
              >
                <User className="h-3.5 w-3.5 opacity-80" aria-hidden />
                Privé
              </button>
            </div>
            <div className="inline-flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="inline-flex max-w-full rounded-full border border-ink-300 bg-ink-50/80 p-1 dark:border-ink-700 dark:bg-ink-950/80">
                <button
                  type="button"
                  aria-pressed={selectedYears === null}
                  onClick={() => setSelectedYears(null)}
                  className={clsx(
                    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 sm:flex-initial sm:px-4",
                    selectedYears === null
                      ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                      : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
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
                    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 sm:flex-initial sm:px-4",
                    selectedYears !== null
                      ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                      : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
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
                  <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Inclure :</span>
                  {yearOptions.map((y) => {
                    const on = selectedYears.includes(y);
                    return (
                      <button
                        key={y}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleYearInFilter(y)}
                        className={clsx(
                          "min-h-[40px] rounded-full border px-3 py-2 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-950 sm:min-h-0 sm:py-1",
                          on
                            ? "border-brand-500 bg-brand-50 text-brand-900 shadow-sm dark:border-brand-400 dark:bg-brand-900/60 dark:text-white dark:shadow-brand-950/40"
                            : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-ink-600"
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
            {canUsePowens ? (
              <>
                <button
                  type="button"
                  onClick={onClickConnectRevolutPowens}
                  disabled={isPending}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
                  title="Powens Connect : variables POWENS_* côté serveur. Choisis Revolut personnel dans la webview."
                >
                  <Landmark className="h-4 w-4 text-ink-500" aria-hidden />
                  Connecter Revolut
                </button>
                <button
                  type="button"
                  onClick={onClickSyncRevolutPowens}
                  disabled={isPending}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
                  title="Importe les transactions Revolut personnel dans le dashboard (périmètre privé)."
                >
                  <CloudDownload className="h-4 w-4 text-ink-500" aria-hidden />
                  Synchroniser Revolut
                </button>
              </>
            ) : null}
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-ink-500 dark:text-ink-400 lg:text-right">
            Vue active : <span className="font-medium text-ink-700 dark:text-ink-200">{periodLabel}</span>.
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
              <div className="mt-3 flex items-start gap-2.5 text-sm text-ink-500 dark:text-ink-400">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  aria-hidden
                >
                  <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="leading-snug">
                  <span className="font-medium text-ink-700 dark:text-ink-200">Chiffre d’affaires HT</span>
                  <span className="block text-xs font-normal text-ink-500 dark:text-ink-400">
                    Équivalent TTC <span data-private>{formatEur(totalRevenues)}</span> · {periodLabel}
                  </span>
                </span>
              </div>
              <RevenueMiniChart
                data={monthlyRevenueHt}
                ariaLabel={`Évolution du chiffre d’affaires HT par mois — ${periodLabel}`}
              />
              <div
                className="mt-3 rounded-xl border border-emerald-200/90 bg-emerald-50/60 px-3 py-3 dark:border-emerald-700/50 dark:bg-emerald-950/50"
                aria-label={`Projection chiffre d’affaires fin ${revenueYearProjection.calendarYear}`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200/80 bg-white text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/40 dark:text-emerald-300"
                    aria-hidden
                  >
                    <CalendarClock className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/90 dark:text-emerald-300">
                      Projection fin {revenueYearProjection.calendarYear}
                    </p>
                    <p className="font-display text-lg font-bold tabular-nums text-emerald-950 dark:text-emerald-100" data-private>
                      {formatEur(revenueYearProjection.projectedYearEndHt)}{" "}
                      <span className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-400">HT</span>
                    </p>
                    <p className="text-xs text-emerald-900/75 dark:text-emerald-300/80" data-private>
                      Équivalent TTC estimé{" "}
                      <span className="font-medium">{formatEur(revenueYearProjection.projectedYearEndTtc)}</span>
                    </p>
                    <p className="text-xs leading-snug text-emerald-900/70 dark:text-emerald-300/70" data-private>
                      Réalisé YTD HT :{" "}
                      <span className="font-medium text-emerald-950 dark:text-emerald-200">{formatEur(revenueYearProjection.ytdHt)}</span>
                      <span className="text-emerald-800/80 dark:text-emerald-400/80">
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
                    <p className="text-[11px] leading-snug text-emerald-800/70 dark:text-emerald-400/70">
                      {revenueYearProjection.projectionBasis === "workdays" ? (
                        <>
                          Extrapolation au prorata des{" "}
                          <span className="font-medium text-emerald-900 dark:text-emerald-300">
                            jours ouvrés (lun–ven, fériés FR exclus) et de vos coches calendrier
                          </span>{" "}
                          sur {revenueYearProjection.calendarYear}, et non sur 365 jours civils. Périmètre :{" "}
                          <span className="font-medium text-emerald-900 dark:text-emerald-300">{scope === "pro" ? "SASU" : "Privé"}</span>
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
              <div
                className="mt-3 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-3 dark:border-ink-800"
                data-private
              >
                {revenueCounterpartyTotals.length ? (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
                      Contreparties / clients · HT
                    </p>
                    <p className="text-[10px] leading-snug text-ink-500 dark:text-ink-400">
                      Cliquez une ligne pour afficher les encaissements de cette contrepartie.
                    </p>
                    <ul
                      className="max-h-36 space-y-1 overflow-y-auto pr-0.5 text-xs"
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
                        const open = revenueCounterpartyDetail === name;
                        return (
                          <li
                            key={name}
                            className="border-b border-ink-100 pb-1.5 last:border-0 last:pb-0 dark:border-ink-800"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setRevenueCounterpartyDetail((prev) => (prev === name ? null : name))
                              }
                              className={clsx(
                                "flex min-h-[44px] w-full items-baseline justify-between gap-2 rounded-lg px-1.5 py-2 text-left transition sm:min-h-0 sm:py-1",
                                open
                                  ? "bg-emerald-100/80 ring-1 ring-emerald-200/90 dark:bg-emerald-950/50 dark:ring-emerald-800/80"
                                  : "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/25"
                              )}
                              aria-expanded={open}
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                <ChevronDown
                                  className={clsx(
                                    "h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform",
                                    open ? "rotate-0" : "-rotate-90"
                                  )}
                                  aria-hidden
                                />
                                <CounterpartyLogo name={name} size={22} />
                                <span className="min-w-0">
                                  <span className="block truncate text-ink-700 dark:text-ink-200">{name}</span>
                                  {showBillableDays ? (
                                    <span className="mt-0.5 block text-[10px] font-normal leading-snug text-ink-500 dark:text-ink-400">
                                      ≈ {formatWorkedDaysFr(workedDays)} j · TJM{" "}
                                      {formatEur(BILLABLE_CLIENT_TJM_HT)} HT
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                                <span className="font-medium text-emerald-800 dark:text-emerald-300">
                                  {formatEur(totalHt)}
                                </span>
                                <span className="w-8 text-right text-[10px] text-ink-400 dark:text-ink-500">
                                  {pct}%
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {revenueCounterpartyDetail ? (
                      <div className="mt-2 rounded-lg border border-emerald-200/70 bg-white px-2 py-2 shadow-sm dark:border-emerald-800/60 dark:bg-ink-900 dark:shadow-none">
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900/80 dark:text-emerald-200/90">
                            Encaissements · {revenueCounterpartyDetail}
                          </p>
                          <button
                            type="button"
                            onClick={() => setRevenueCounterpartyDetail(null)}
                            className="shrink-0 text-[10px] font-medium text-brand-600 hover:text-brand-800"
                          >
                            Fermer
                          </button>
                        </div>
                        {revenueTransactionsForCounterparty.length ? (
                          <ul
                            className="max-h-52 space-y-1 overflow-y-auto text-[11px]"
                            aria-label={`Encaissements pour ${revenueCounterpartyDetail}`}
                          >
                            {revenueTransactionsForCounterparty.map((tx) => {
                              const ht = tx.amount / (1 + VAT_RATE);
                              return (
                                <li
                                  key={tx.id}
                                  className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-ink-100 py-1.5 last:border-0 dark:border-ink-800"
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-mono text-[10px] text-ink-500 dark:text-ink-400">
                                      {tx.date}
                                    </span>
                                    <span className="block truncate text-ink-800 dark:text-ink-100">
                                      {tx.label}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 flex-col items-end tabular-nums">
                                    <span className="font-medium text-emerald-800">{formatEur(tx.amount)}</span>
                                    <span className="text-[10px] text-ink-400">TTC · {formatEur(ht)} HT</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-[11px] text-ink-500">Aucune opération pour cette contrepartie.</p>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    Aucun encaissement « Chiffre d’affaires » sur cette période.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card className="flex h-full min-h-0 flex-col border-ink-200/90 bg-gradient-to-b from-ink-50/40 to-white dark:border-ink-800 dark:from-ink-900/80 dark:to-ink-950">
            <CardHeader className="flex flex-col gap-4 border-b border-ink-100/80 pb-4 dark:border-ink-800 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200/60 bg-rose-50/80 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300"
                  aria-hidden
                >
                  <TrendingDown className="h-[19px] w-[19px]" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <CardTitle className="!mt-0 text-base font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                    Total expenses
                  </CardTitle>
                  <div className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                    {totalExpensesCardSubtitle}
                  </div>
                  <CardValue className="mt-2">
                    <span data-private>{formatEur(totalExpensesCard)}</span>
                  </CardValue>
                </div>
              </div>
              <div className="flex w-full min-w-0 shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
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
                  className="min-h-[48px] w-full min-w-0 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-base font-medium text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:focus-visible:ring-offset-ink-950 sm:min-h-0 sm:min-w-[11.5rem] sm:text-sm"
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
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-sm dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:shadow-none sm:w-auto sm:justify-end"
                  title={
                    totalExpensesMonthFilter
                      ? undefined
                      : "Nombre de mois écoulés dans la fenêtre (jusqu’au mois en cours), utilisé pour les moyennes"
                  }
                >
                  <Calendar className="h-3.5 w-3.5 text-ink-500 dark:text-ink-400" aria-hidden />
                  {totalExpensesMonthFilter
                    ? monthLabelFr(totalExpensesMonthFilter)
                    : `${monthsElapsedInDashboardPeriod || 0} mois`}
                </div>
              </div>
            </CardHeader>
            <CardBody className="flex flex-1 flex-col pt-6">
              <div className="mb-1 flex items-start gap-2.5 text-sm text-ink-500 dark:text-ink-400">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50/90 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                  aria-hidden
                >
                  <Receipt className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="leading-snug">
                  <span className="font-medium text-ink-700 dark:text-ink-200">Synthèse des dépenses</span>
                  <span className="block text-xs font-normal text-ink-500 dark:text-ink-400">
                    Total sur la période · graphique ci-dessous
                  </span>
                </span>
              </div>
              <ExpenseTotalMiniChart
                data={monthlyTotalExpensesSeries}
                selectedMonthKey={totalExpensesMonthFilter}
                onMonthClick={(monthKey) =>
                  setTotalExpensesMonthFilter((prev) => (prev === monthKey ? null : monthKey))
                }
                ariaLabel={`Évolution des dépenses par mois (hors BNC et TVA) — ${periodLabel}${totalExpensesMonthFilter ? ` — filtre ${monthLabelFr(totalExpensesMonthFilter)}` : ""}. Cliquer un mois sur le graphique applique le même filtre que la liste déroulante.`}
              />
              <div
                className="mt-4 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-4 dark:border-ink-800"
                data-private
              >
                <div className="rounded-xl border border-rose-100/90 bg-rose-50/40 px-2.5 py-2.5 dark:border-rose-900/40 dark:bg-rose-950/25">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-900/75 dark:text-rose-200/90">
                    Catégories (dépenses) · filtre
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-ink-600 dark:text-ink-400">
                    Sélectionnez une ou plusieurs catégories pour restreindre les dépenses ci-dessous (totaux et
                    graphique). Le CA du dashboard reste inchangé.
                  </p>
                  <div
                    className="mt-2 flex max-h-36 flex-wrap items-center gap-2 overflow-y-auto pr-0.5"
                    role="group"
                    aria-label="Filtrer les dépenses par catégorie dérivée"
                  >
                    {selectedExpenseCategoryFilters.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedExpenseCategoryFilters([])}
                        className="min-h-[40px] rounded-full border border-ink-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700 shadow-sm transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700 sm:min-h-0 sm:py-1"
                      >
                        Toutes
                      </button>
                    ) : null}
                    {expenseCategoryFilterOptions.map((cat) => {
                      const on = selectedExpenseCategoryFilters.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleExpenseCategoryFilter(cat)}
                          title={cat}
                          className={clsx(
                            "max-w-full truncate rounded-full border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-950 sm:max-w-[11rem] sm:min-h-0 sm:py-1",
                            on
                              ? "border-rose-400 bg-white text-rose-900 shadow-sm dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-100 dark:shadow-none"
                              : "border-rose-200/80 bg-white/80 text-ink-600 hover:border-rose-300 dark:border-rose-800/60 dark:bg-ink-900/60 dark:text-ink-300 dark:hover:border-rose-600"
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {expenseCategoryTotalsForTotalExpensesCard.length ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
                      {totalExpensesMonthFilter
                        ? `Top ${TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES} catégories · ce mois`
                        : `Top ${TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES} catégories · total période et moy. / mois (période écoulée)`}
                    </p>
                    <p className="text-[10px] leading-snug text-ink-500 dark:text-ink-400">
                      Les {TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES} buckets les plus élevés pour la vue en cours.
                      Cliquez une ligne pour afficher les opérations (même logique que la répartition).
                    </p>
                    <ul
                      className="max-h-[min(28rem,70vh)] space-y-1 overflow-y-auto pr-0.5 text-xs"
                      aria-label={`Top ${TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES} catégories de dépenses`}
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
                        const open = expenseCategoryDetail === name;
                        return (
                          <li
                            key={name}
                            className="border-b border-ink-100 pb-1.5 last:border-0 last:pb-0 dark:border-ink-800"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpenseCategoryDetail((prev) => (prev === name ? null : name))
                              }
                              className={clsx(
                                "flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left transition sm:min-h-0 sm:py-1.5",
                                open
                                  ? "bg-rose-50/90 ring-1 ring-rose-200/90 dark:bg-rose-950/40 dark:ring-rose-800/70"
                                  : "hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
                              )}
                              aria-expanded={open}
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                <ChevronDown
                                  className={clsx(
                                    "h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform",
                                    open ? "rotate-0" : "-rotate-90"
                                  )}
                                  aria-hidden
                                />
                                <span
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-white text-ink-700 shadow-sm dark:bg-ink-900"
                                  style={{ borderColor: color, color }}
                                  aria-hidden
                                >
                                  <CatIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                </span>
                                <span className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                                  {name}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                                <span className="flex items-baseline gap-2">
                                  <span className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                                    {formatEur(total)}
                                  </span>
                                  <span className="w-7 text-right text-[10px] font-medium text-ink-400 dark:text-ink-500">
                                    {pct}%
                                  </span>
                                </span>
                                {!totalExpensesMonthFilter && monthsElapsedInDashboardPeriod > 0 ? (
                                  <span className="text-[11px] font-medium text-rose-700/90 dark:text-rose-300/90">
                                    moy. {formatEur(avgMonthly)}{" "}
                                    <span className="font-normal text-ink-500 dark:text-ink-400">/ mois</span>
                                  </span>
                                ) : null}
                              </span>
                            </button>
                            {open ? (
                              <div className="mt-1.5 rounded-lg border border-rose-200/80 bg-white px-2 py-2 shadow-sm dark:border-rose-800/60 dark:bg-ink-900 dark:shadow-none">
                                <div className="mb-1.5 flex items-start justify-between gap-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-900/85 dark:text-rose-200/90">
                                    Opérations · {name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setExpenseCategoryDetail(null)}
                                    className="shrink-0 text-[10px] font-medium text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
                                  >
                                    Fermer
                                  </button>
                                </div>
                                {expenseTransactionsForCategory.length ? (
                                  <ul
                                    className="max-h-52 space-y-1 overflow-y-auto text-[11px]"
                                    aria-label={`Opérations pour ${name}`}
                                  >
                                    {expenseTransactionsForCategory.map((tx) => (
                                      <li
                                        key={tx.id}
                                        className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-ink-100 py-1.5 last:border-0 dark:border-ink-800"
                                      >
                                        <span className="min-w-0 flex-1">
                                          <span className="block font-mono text-[10px] text-ink-500 dark:text-ink-400">
                                            {tx.date}
                                          </span>
                                          <span className="block truncate text-ink-800 dark:text-ink-100">
                                            {tx.label}
                                          </span>
                                          {tx.company ? (
                                            <span className="mt-0.5 block truncate text-[10px] text-ink-500 dark:text-ink-400">
                                              {tx.company}
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="shrink-0 font-medium tabular-nums text-rose-800 dark:text-rose-300">
                                          {formatEur(Math.abs(tx.amount))}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[11px] text-ink-500 dark:text-ink-400">
                                    Aucune opération pour cette catégorie.
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-ink-500 dark:text-ink-400">Aucune dépense sur cette période.</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </section>


      <Chatbot />
    </main>
  );
}
