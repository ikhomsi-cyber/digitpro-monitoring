"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ChevronDown,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { ExpenseTotalMiniChart } from "@/components/charts/ExpenseTotalMiniChart";
import { RevenueMiniChart } from "@/components/charts/RevenueMiniChart";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { BillableDaysCalendarBlock } from "@/components/dashboard/BillableDaysCalendarBlock";
import { ActivityOverviewPremium } from "@/components/dashboard/ActivityOverviewPremium";
import { DashboardInsightPeriodFilter } from "@/components/dashboard/DashboardInsightPeriodFilter";
import { DashboardPeriodFilterSection } from "@/components/dashboard/DashboardPeriodFilterSection";
import { SectionThemeSync } from "@/components/dashboard/SectionThemeSync";
import { DashboardPremiumHero } from "@/components/dashboard/DashboardPremiumHero";
import { RevolutBalanceHero } from "@/components/dashboard/RevolutBalanceHero";
import { RevolutInsightsSection } from "@/components/dashboard/RevolutInsightsSection";
import { TaxLiabilityCard } from "@/components/dashboard/TaxLiabilityCard";
import { RevenueAllocationChart } from "@/components/dashboard/RevenueAllocationChart";
import { computeKpiTrend } from "@/lib/kpi-month-trend";
import { ValeurReelleClient } from "@/components/dashboard/ValeurReelleClient";
import { DashboardCategorisationPanel } from "@/app/dashboard/DashboardCategorisationPanel";
import { CounterpartyLogo } from "@/components/dashboard/CounterpartyLogo";
import { Card, CardBody, CardHeader, CardTitle, CardValue } from "@/components/ui/Card";
import { bankinSubcategoryLabel } from "@/lib/bankin/categorize";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { categoryGlyph } from "@/lib/category-glyph";
import { counterpartyLogoHref } from "@/lib/counterparty-logo";
import {
  buildDashboardMonthOptions,
  defaultDashboardPeriodFilter,
  formatDashboardPeriodLabelWithMonth,
  formatDashboardPeriodLabelWithMonths
} from "@/lib/dashboard-period";
import {
  dashboardAnalysisShell,
  dashboardChartSurface,
  dashboardDonutTrack,
  dashboardEmptyState,
  dashboardEyebrow,
  dashboardFilterPill,
  dashboardGaugeTrack,
  dashboardInsetPanel,
  dashboardPanelTitle,
  dashboardPremiumPanel,
  dashboardRowAmount,
  dashboardRowDivider,
  dashboardRowMeta,
  dashboardRowTitle,
  dashboardSegmentBtn,
  dashboardSegmentShell,
  dashboardSectionStack
} from "@/lib/dashboard-surfaces";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import {
  BILLABLE_CLIENT_TJM_HT,
  formatWorkedDaysFr,
  isCounterpartyBillableDaysAtTjm,
  resolveBillableTjmForClientMonth
} from "@/lib/billable-client-days";
import { isRevenueCategory, revenueCounterpartyDisplayName } from "@/lib/revenue-category";
import {
  BNC_PAYROLL_EXPENSE_CATEGORY,
  computeDashboardMonthlyMetrics,
  computeDerivedExpenseCategoryMonthlyBreakdown,
  computeExpenseCategoryMonthlyBreakdown,
  computePersonalRevenueYearProjection,
  computeRevenueYearToDateProjection,
  countsTowardDashboardExpenseKpi,
  countsTowardDashboardExpenseTotal,
  countsTowardPersonalRevenueKpi,
  expenseCategoryColor,
  expenseDashboardGroupingLabel,
  filterDashboardTransactions,
  omitExpenseCategoriesFromBreakdown,
  transactionAnalyticsDayIso,
  TVA_DERIVED_EXPENSE_BUCKET,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import {
  buildSasuExpenseDonutSlices,
  buildSasuRevenueDonutSlices,
  buildSasuSimplifiedExpenseSlices,
  buildSasuSimplifiedSubcategories,
  sasuSimplifiedExpenseGroup
} from "@/lib/sasu-analytics";
import { dashboardSasuExpenseAmountHt } from "@/lib/recoverable-expense-vat";
import { useDashboardSection } from "@/components/dashboard/DashboardSectionContext";

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

const formatDaysCount = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1
});

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

/** 12 mois glissants vs années civiles — même logique que la section analytics (`selectedYears` → revenus & dépenses). */
function sum(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0);
}

function monthLabelFr(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(d);
}

function compactEuroAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${Math.round(value / 100_000) / 10}M€`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}k€`;
  if (abs >= 1000) return `${Math.round(value / 100) / 10}k€`;
  return `${Math.round(value)}€`;
}

function smoothSvgPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  let path = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

/** Mois civil courant (local), aligné avec les dates des transactions YYYY-MM-DD. */
function dashboardMonthKeyNowLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardClient({
  syncKey,
  initialTransactions,
  transactionYearBounds,
  initialDashboardScope,
  heroStats,
  heroContextMessage,
  showContextBanner,
  demoMode,
  loadError
}: {
  syncKey: string;
  initialTransactions: DashboardTx[];
  /** Années min/max sur toute la table (Supabase) ; évite de n’afficher que les années du lot chargé (ex. 5000 dernières lignes). */
  transactionYearBounds: { minYear: number; maxYear: number } | null;
  /** Dérivé de `?scope=` sur `/dashboard` (pro | personal), sinon défaut SASU. */
  initialDashboardScope?: "pro" | "personal" | null;
  heroStats: DashboardHeroStats;
  heroContextMessage: string;
  showContextBanner: boolean;
  demoMode: boolean;
  loadError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { section: dashboardSection, searchParams } = useDashboardSection();
  const [transactions, setTransactions] = useState<DashboardTx[]>(initialTransactions);
  const [currentHeroStats, setCurrentHeroStats] = useState<DashboardHeroStats>(heroStats);
  const [scope, setScope] = useState<"pro" | "personal">(() =>
    initialDashboardScope === "personal" ? "personal" : "pro"
  );
  /** null = fenêtre glissante 12 mois ; sinon une ou plusieurs années civiles */
  const [selectedYears, setSelectedYears] = useState<number[] | null>(
    () => defaultDashboardPeriodFilter().selectedYears
  );
  /** null = fenêtre/années ; sinon un seul mois civil YYYY-MM (onglet Privé). */
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    () => defaultDashboardPeriodFilter().selectedMonth
  );
  /** Multi-mois pour l’onglet SASU (comme Valeur réelle). */
  const [selectedMonths, setSelectedMonths] = useState<string[]>(
    () => [defaultDashboardPeriodFilter().selectedMonth]
  );
  /** null = total sur toute la fenêtre d’analyse ; sinon un seul mois (YYYY-MM) via clic sur le graphique. */
  const [totalExpensesMonthFilter, setTotalExpensesMonthFilter] = useState<string | null>(null);
  /** Contrepartie CA sélectionnée dans la carte Total revenues (liste des encaissements). */
  const [revenueCounterpartyDetail, setRevenueCounterpartyDetail] = useState<string | null>(null);
  /** Catégorie dérivée sélectionnée dans Total expenses (liste des opérations). */
  const [expenseCategoryDetail, setExpenseCategoryDetail] = useState<string | null>(null);
  const [sasuAnalysisMode, setSasuAnalysisMode] = useState<"revenues" | "expenses">("expenses");
  const [sasuBreakdownMode, setSasuBreakdownMode] = useState<"categories" | "simplified">("categories");
  const [showAllSasuCategoryRows, setShowAllSasuCategoryRows] = useState(false);
  const [expandedSasuSubcategoryGroups, setExpandedSasuSubcategoryGroups] = useState<Set<string>>(() => new Set());
  const [sasuMonthlyCategoryFilters, setSasuMonthlyCategoryFilters] = useState<string[]>([]);
  /** Filtre global des dépenses (buckets dérivés) : vide = toutes les catégories. */
  const [selectedExpenseCategoryFilters, setSelectedExpenseCategoryFilters] = useState<string[]>([]);
  const shouldComputeSasuPanel = dashboardSection === "sasu" || dashboardSection === "private";

  useEffect(() => {
    setTransactions(initialTransactions);
    setCurrentHeroStats(heroStats);
  }, [syncKey, initialTransactions, heroStats]);

  useEffect(() => {
    setRevenueCounterpartyDetail(null);
    setExpenseCategoryDetail(null);
    setSelectedExpenseCategoryFilters([]);
    setTotalExpensesMonthFilter(null);
  }, [scope, selectedMonth, selectedMonths, selectedYears, syncKey]);

  useEffect(() => {
    setExpenseCategoryDetail(null);
  }, [totalExpensesMonthFilter, selectedExpenseCategoryFilters]);

  useEffect(() => {
    if (!pathname.startsWith("/dashboard")) return;
    const sec = searchParams.get("section");
    const q = searchParams.get("scope");
    if (sec === "activite" || sec === "sasu") {
      setScope("pro");
    } else if (sec === "private") {
      setScope("personal");
    } else if (q === "personal") {
      setScope("personal");
    } else if (q === "pro") {
      setScope("pro");
    } else {
      setScope("pro");
    }
  }, [pathname, searchParams]);

  /** Retour webview Powens : query après redirection depuis /api/powens/callback */
  useEffect(() => {
    if (!pathname.startsWith("/dashboard")) return;
    const connect = searchParams.get("powens_connect");
    if (!connect) return;

    if (connect === "ok") {
      const cid = searchParams.get("powens_connection_id");
      toast.success("Powens — liaison terminée", {
        description: cid
          ? `Connexion ${cid}. Vous pouvez lancer la synchronisation des transactions.`
          : "Vous pouvez lancer la synchronisation des transactions."
      });
    } else {
      const code = searchParams.get("powens_error") ?? "erreur";
      const desc = searchParams.get("powens_error_description");
      toast.error("Powens — échec après la webview", {
        description:
          desc && desc !== code
            ? `${code}${desc ? ` — ${desc}` : ""}`
            : code,
        duration: 14_000
      });
    }

    const next = new URLSearchParams(searchParams.toString());
    for (const k of [
      "powens_connect",
      "powens_connection_id",
      "powens_error",
      "powens_error_description"
    ]) {
      next.delete(k);
    }
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const fmt = useDashboardDisplayFormat();

  const taxLiabilityTrend = useMemo(() => {
    const mom = currentHeroStats.momKpis;
    if (!mom) return null;
    return computeKpiTrend(currentHeroStats.detteTotaleDepuisDebutEur, mom.detteTotaleDepuisDebutEur, {
      positiveIsGood: false
    });
  }, [currentHeroStats]);

  const revenueAllocationTrend = useMemo(() => {
    const mom = currentHeroStats.momKpis;
    if (!mom) return null;
    return computeKpiTrend(
      currentHeroStats.tjmRepartitionMois.caHtEur,
      mom.tjmRepartitionMois.caHtEur
    );
  }, [currentHeroStats]);

  const billableActivity = useBillableActivity();
  const { sortedIsos: billableWorkDayIsos } = billableActivity;

  const analyticsFilter = useMemo(() => {
    if (dashboardSection === "sasu") {
      const years = selectedYears ?? [new Date().getFullYear()];
      const months = selectedMonths.filter((m) => years.includes(Number(m.slice(0, 4))));
      return {
        years,
        months: months.length ? months : null,
        month: null as string | null
      };
    }
    return { years: selectedYears, month: selectedMonth };
  }, [dashboardSection, selectedMonth, selectedMonths, selectedYears]);

  const sasuMonthsForYears = useMemo(
    () => {
      if (dashboardSection !== "sasu") return [];
      const years = selectedYears ?? [new Date().getFullYear()];
      return selectedMonths.filter((m) => years.includes(Number(m.slice(0, 4))));
    },
    [dashboardSection, selectedMonths, selectedYears]
  );

  const sasuSingleMonth = sasuMonthsForYears.length === 1 ? sasuMonthsForYears[0]! : null;
  const effectiveMonth = dashboardSection === "sasu" ? sasuSingleMonth : selectedMonth;

  const scopedTx = useMemo(
    () => transactions.filter((t) => (t.scope ?? "pro") === scope),
    [transactions, scope]
  );

  const kpiMode = useMemo(() => (scope === "personal" ? "personal" : "sasu"), [scope]);

  const periodFilteredTx = useMemo(
    () => filterDashboardTransactions(scopedTx, analyticsFilter),
    [scopedTx, analyticsFilter]
  );

  const filteredTx = useMemo(() => {
    if (!selectedExpenseCategoryFilters.length) return periodFilteredTx;
    const allow = new Set(selectedExpenseCategoryFilters);
    return periodFilteredTx.filter((tx) => {
      if (tx.amount >= 0) return true;
      return allow.has(expenseDashboardGroupingLabel(tx, kpiMode));
    });
  }, [periodFilteredTx, selectedExpenseCategoryFilters, kpiMode]);

  const expenseCategoryFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const tx of periodFilteredTx) {
      if (!countsTowardDashboardExpenseKpi(tx, kpiMode)) continue;
      set.add(expenseDashboardGroupingLabel(tx, kpiMode));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [periodFilteredTx, kpiMode]);

  const analyticsYears = useMemo(
    () => (effectiveMonth ? [Number(effectiveMonth.slice(0, 4))] : selectedYears),
    [effectiveMonth, selectedYears]
  );

  const metrics = useMemo(
    () =>
      computeDashboardMonthlyMetrics(filteredTx, {
        years: analyticsYears,
        kpiMode
      }),
    [analyticsYears, filteredTx, kpiMode]
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
    () =>
      kpiMode === "personal"
        ? computeExpenseCategoryMonthlyBreakdown(filteredTx, {
            years: analyticsYears,
            expenseInclude: (tx) => countsTowardDashboardExpenseKpi(tx, "personal"),
            expenseGroup: "personal"
          })
        : computeDerivedExpenseCategoryMonthlyBreakdown(filteredTx, {
            years: analyticsYears,
            useExpenseHt: true
          }),
    [analyticsYears, filteredTx, kpiMode]
  );

  const expenseCategoryBreakdownMain = useMemo(
    () =>
      kpiMode === "personal"
        ? expenseCategoryBreakdown
        : omitExpenseCategoriesFromBreakdown(expenseCategoryBreakdown, [
            BNC_PAYROLL_EXPENSE_CATEGORY,
            TVA_DERIVED_EXPENSE_BUCKET
          ]),
    [expenseCategoryBreakdown, kpiMode]
  );

  const activeExpenseMonthKey = totalExpensesMonthFilter ?? effectiveMonth;

  const totalExpensesCard = useMemo(() => {
    if (activeExpenseMonthKey) {
      const m = metrics.find((x) => x.month === activeExpenseMonthKey);
      return m ? m.expenses : 0;
    }
    return sum(metrics.map((x) => x.expenses));
  }, [activeExpenseMonthKey, metrics]);

  const totalExpensesCardTtc = useMemo(() => {
    if (kpiMode !== "sasu") return totalExpensesCard;
    let ttc = 0;
    for (const tx of filteredTx) {
      if (!countsTowardDashboardExpenseTotal(tx)) continue;
      if (activeExpenseMonthKey && tx.date.slice(0, 7) !== activeExpenseMonthKey) continue;
      ttc += Math.abs(tx.amount);
    }
    return ttc;
  }, [activeExpenseMonthKey, filteredTx, kpiMode, totalExpensesCard]);

  const expenseCategoryTotalsForTotalExpensesCard = useMemo(() => {
    const cats = expenseCategoryBreakdownMain.categories;
    if (!cats.length) return [];
    let withTotals: { name: string; total: number }[];
    if (!activeExpenseMonthKey) {
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
      const row = expenseCategoryBreakdownMain.rows.find((r) => r.monthKey === activeExpenseMonthKey);
      if (!row) return [];
      withTotals = cats
        .map((name) => ({ name, total: row.values[name] ?? 0 }))
        .filter((x) => x.total > 0);
    }
    return withTotals
      .sort((a, b) => {
        if (a.name === "CESU" && b.name !== "CESU") return -1;
        if (b.name === "CESU" && a.name !== "CESU") return 1;
        return b.total - a.total;
      });
  }, [activeExpenseMonthKey, expenseCategoryBreakdownMain]);

  const VAT_RATE = 0.2;
  const totalRevenues = useMemo(() => sum(metrics.map((m) => m.revenue)), [metrics]);
  const totalRevenuesHt = useMemo(() => totalRevenues / (1 + VAT_RATE), [totalRevenues]);

  const revenueYearProjection = useMemo(
    () =>
      kpiMode === "personal"
        ? computePersonalRevenueYearProjection(scopedTx, { now: new Date() })
        : computeRevenueYearToDateProjection(scopedTx, {
            vatRate: VAT_RATE,
            billableWorkDayIsos: billableWorkDayIsos
          }),
    [scopedTx, billableWorkDayIsos, VAT_RATE, kpiMode]
  );

  const monthlyRevenueChartSeries = useMemo(
    () =>
      metrics.map((m) => ({
        month: monthLabelFr(m.month),
        monthKey: m.month,
        value:
          Math.round((kpiMode === "personal" ? m.revenue : m.revenue / (1 + VAT_RATE)) * 100) / 100
      })),
    [metrics, kpiMode, VAT_RATE]
  );

  /** Encaissements perso : regroupement par sous-catégorie Bankin ; SASU : par contrepartie (libellé). */
  const revenueCounterpartyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredTx) {
      if (kpiMode === "personal") {
        if (!countsTowardPersonalRevenueKpi(tx)) continue;
        const name = bankinSubcategoryLabel(tx.category);
        map.set(name, (map.get(name) ?? 0) + tx.amount);
      } else {
        if (!isRevenueCategory(tx.category) || tx.amount <= 0) continue;
        const name = revenueCounterpartyDisplayName(tx);
        map.set(name, (map.get(name) ?? 0) + tx.amount);
      }
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredTx, kpiMode]);

  const sasuExpenseDonutSlices = useMemo(() => {
    if (!shouldComputeSasuPanel) return [];
    return buildSasuExpenseDonutSlices(expenseCategoryTotalsForTotalExpensesCard, totalExpensesCard);
  }, [expenseCategoryTotalsForTotalExpensesCard, shouldComputeSasuPanel, totalExpensesCard]);

  const sasuRevenueDonutSlices = useMemo(() => {
    if (!shouldComputeSasuPanel) return [];
    return buildSasuRevenueDonutSlices(revenueCounterpartyTotals, totalRevenuesHt, VAT_RATE);
  }, [revenueCounterpartyTotals, shouldComputeSasuPanel, totalRevenuesHt, VAT_RATE]);

  const sasuSimplifiedExpenseSlices = useMemo(() => {
    if (!shouldComputeSasuPanel) return [];
    const txs = activeExpenseMonthKey
      ? filteredTx.filter((tx) => tx.date.slice(0, 7) === activeExpenseMonthKey)
      : filteredTx;
    return buildSasuSimplifiedExpenseSlices(txs);
  }, [activeExpenseMonthKey, filteredTx, shouldComputeSasuPanel]);

  const sasuSimplifiedSubcategories = useMemo(() => {
    if (!shouldComputeSasuPanel) return {};
    return buildSasuSimplifiedSubcategories(filteredTx);
  }, [filteredTx, kpiMode, shouldComputeSasuPanel]);

  const revenueTransactionsForCounterparty = useMemo(() => {
    if (!revenueCounterpartyDetail) return [];
    return filteredTx
      .filter((tx) => {
        if (kpiMode === "personal") {
          if (!countsTowardPersonalRevenueKpi(tx)) return false;
          return bankinSubcategoryLabel(tx.category) === revenueCounterpartyDetail;
        }
        return (
          isRevenueCategory(tx.category) &&
          tx.amount > 0 &&
          revenueCounterpartyDisplayName(tx) === revenueCounterpartyDetail
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [filteredTx, revenueCounterpartyDetail, kpiMode]);

  const expenseTransactionsForCategory = useMemo(() => {
    if (!expenseCategoryDetail) return [];
    return filteredTx
      .filter((tx) => {
        if (tx.amount >= 0) return false;
        if (expenseDashboardGroupingLabel(tx, kpiMode) !== expenseCategoryDetail) return false;
        if (activeExpenseMonthKey && tx.date.slice(0, 7) !== activeExpenseMonthKey) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [activeExpenseMonthKey, filteredTx, expenseCategoryDetail, kpiMode]);

  const monthlyTotalExpensesSeries = useMemo(
    () =>
      metrics.map((m) => ({
        month: monthLabelFr(m.month),
        monthKey: m.month,
        value: Math.round(m.expenses * 100) / 100
      })),
    [metrics]
  );

  const sasuMonthlyEvolutionBuckets = useMemo(() => {
    const totals = new Map<string, number>();
    const monthly = new Map<string, Map<string, number>>();
    if (!shouldComputeSasuPanel) return { totals, monthly };
    for (const metric of metrics) {
      monthly.set(metric.month, new Map());
    }

    for (const tx of periodFilteredTx) {
      if (!countsTowardDashboardExpenseKpi(tx, kpiMode)) continue;
      const monthKey = tx.date.slice(0, 7);
      const monthBucket = monthly.get(monthKey);
      if (!monthBucket) continue;
      const name =
        sasuBreakdownMode === "simplified"
          ? sasuSimplifiedExpenseGroup(tx)
          : expenseDashboardGroupingLabel(tx, kpiMode);
      if (!name) continue;
      const amount = kpiMode === "sasu" ? dashboardSasuExpenseAmountHt(tx) : Math.abs(tx.amount);
      totals.set(name, (totals.get(name) ?? 0) + amount);
      monthBucket.set(name, (monthBucket.get(name) ?? 0) + amount);
    }

    return { totals, monthly };
  }, [metrics, periodFilteredTx, kpiMode, sasuBreakdownMode, shouldComputeSasuPanel]);

  const sasuMonthlyEvolutionOptions = useMemo(() => {
    const { totals } = sasuMonthlyEvolutionBuckets;
    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [sasuMonthlyEvolutionBuckets]);

  const sasuMonthlyEvolutionColorByName = useMemo(() => {
    const total = sum(sasuMonthlyEvolutionOptions.map((item) => item.total));
    const slices =
      sasuBreakdownMode === "simplified"
        ? sasuMonthlyEvolutionOptions.map((item) => ({
            ...item,
            color: item.name === "Frais DigitPro" ? "#ff8733" : "#11c7cb"
          }))
        : buildSasuExpenseDonutSlices(sasuMonthlyEvolutionOptions, total);
    return new Map(slices.map((slice) => [slice.name, slice.color]));
  }, [sasuBreakdownMode, sasuMonthlyEvolutionOptions]);

  useEffect(() => {
    setSasuMonthlyCategoryFilters((prev) => {
      if (!prev.length) return prev;
      const allowed = new Set(sasuMonthlyEvolutionOptions.map((item) => item.name));
      const next = prev.filter((name) => allowed.has(name));
      return next.length === prev.length ? prev : next;
    });
  }, [sasuMonthlyEvolutionOptions]);

  const sasuMonthlyEvolutionSeries = useMemo(() => {
    if (!shouldComputeSasuPanel) return [];
    const optionNames = sasuMonthlyEvolutionOptions.map((item) => item.name);
    const selectedNames = sasuMonthlyCategoryFilters.length ? sasuMonthlyCategoryFilters : optionNames;
    const selected = new Set(selectedNames);
    return metrics.map((metric) => {
      const monthKey = metric.month;
      let total = 0;
      const byCategory: Array<{ name: string; value: number; color: string }> = [];
      const monthBucket = sasuMonthlyEvolutionBuckets.monthly.get(monthKey);
      for (const name of selectedNames) {
        if (!selected.has(name)) continue;
        const value = monthBucket?.get(name) ?? 0;
        if (value > 0) {
          total += value;
          const color = sasuMonthlyEvolutionColorByName.get(name) ?? "#4f7eea";
          byCategory.push({ name, value, color });
        }
      }
      return {
        month: monthLabelFr(monthKey),
        monthKey,
        value: Math.round(total * 100) / 100,
        byCategory
      };
    });
  }, [
    metrics,
    sasuMonthlyCategoryFilters,
    sasuMonthlyEvolutionOptions,
    sasuMonthlyEvolutionColorByName,
    sasuMonthlyEvolutionBuckets,
    shouldComputeSasuPanel
  ]);

  const sasuMonthlyLineNames = useMemo(
    () =>
      sasuMonthlyCategoryFilters.length
        ? sasuMonthlyCategoryFilters
        : sasuMonthlyEvolutionOptions.slice(0, 4).map((item) => item.name),
    [sasuMonthlyCategoryFilters, sasuMonthlyEvolutionOptions]
  );

  const maxSasuMonthlyChartValue = useMemo(() => {
    let maxValue = 0;
    for (const month of sasuMonthlyEvolutionSeries) {
      maxValue = Math.max(maxValue, month.value);
      for (const category of month.byCategory) {
        maxValue = Math.max(maxValue, category.value);
      }
    }
    return Math.max(1, maxValue);
  }, [sasuMonthlyEvolutionSeries]);

  const sasuActiveCategoryFilterSet = useMemo(() => {
    if (sasuAnalysisMode !== "expenses" || !sasuMonthlyCategoryFilters.length) return null;
    return new Set(sasuMonthlyCategoryFilters);
  }, [sasuAnalysisMode, sasuMonthlyCategoryFilters]);

  const sasuPanelDonutView = useMemo(() => {
    if (sasuAnalysisMode === "revenues") {
      return { slices: sasuRevenueDonutSlices, total: totalRevenuesHt };
    }
    const slices =
      sasuBreakdownMode === "simplified" ? sasuSimplifiedExpenseSlices : sasuExpenseDonutSlices;
    if (!sasuActiveCategoryFilterSet?.size) {
      return { slices, total: totalExpensesCard };
    }
    const filtered = slices.filter((slice) => sasuActiveCategoryFilterSet.has(slice.name));
    const filteredTotal = filtered.reduce((acc, slice) => acc + slice.total, 0);
    return {
      slices: buildSasuExpenseDonutSlices(
        filtered.map((slice) => ({ name: slice.name, total: slice.total })),
        filteredTotal
      ),
      total: Math.round(filteredTotal * 100) / 100
    };
  }, [
    sasuAnalysisMode,
    sasuBreakdownMode,
    sasuActiveCategoryFilterSet,
    sasuRevenueDonutSlices,
    sasuSimplifiedExpenseSlices,
    sasuExpenseDonutSlices,
    totalRevenuesHt,
    totalExpensesCard
  ]);

  useEffect(() => {
    if (!sasuActiveCategoryFilterSet || !expenseCategoryDetail) return;
    if (!sasuActiveCategoryFilterSet.has(expenseCategoryDetail)) {
      setExpenseCategoryDetail(null);
    }
  }, [sasuActiveCategoryFilterSet, expenseCategoryDetail]);

  const periodLabel = useMemo(() => {
    if (dashboardSection === "sasu") {
      const years = selectedYears ?? [new Date().getFullYear()];
      return formatDashboardPeriodLabelWithMonths(
        years,
        sasuMonthsForYears.length ? sasuMonthsForYears : null
      );
    }
    return formatDashboardPeriodLabelWithMonth(selectedYears, selectedMonth);
  }, [dashboardSection, sasuMonthsForYears, selectedMonth, selectedYears]);

  const totalExpensesCardSubtitle = useMemo(() => {
    let base: string;
    if (kpiMode === "personal") {
      base = "Dépenses perso (import Bankin), hors virements internes";
    } else {
      base = `Hors ${BNC_PAYROLL_EXPENSE_CATEGORY} et ${TVA_DERIVED_EXPENSE_BUCKET} · HT (TVA récupérable déduite quand applicable)`;
    }
    let s: string;
    if (activeExpenseMonthKey) {
      s = `${base} · ${monthLabelFr(activeExpenseMonthKey)} (mois sélectionné) · ${periodLabel}`;
    } else {
      s = `${base} · ${periodLabel}`;
    }
    if (selectedExpenseCategoryFilters.length) {
      const n = selectedExpenseCategoryFilters.length;
      s += ` · Filtre : ${n} catégorie${n > 1 ? "s" : ""}`;
    }
    return s;
  }, [activeExpenseMonthKey, periodLabel, selectedExpenseCategoryFilters, kpiMode]);

  const yearOptions = useMemo(() => {
    if (dashboardSection !== "sasu" && transactionYearBounds) {
      const { minYear, maxYear } = transactionYearBounds;
      if (Number.isFinite(minYear) && Number.isFinite(maxYear) && minYear <= maxYear) {
        const out: number[] = [];
        for (let y = maxYear; y >= minYear; y--) out.push(y);
        return out;
      }
    }
    const ys = new Set<number>();
    for (const t of transactions) {
      if (dashboardSection === "sasu" && (t.scope ?? "pro") !== "pro") continue;
      const y = Number(transactionAnalyticsDayIso(t).slice(0, 4));
      if (Number.isFinite(y)) ys.add(y);
    }
    const list = Array.from(ys).sort((a, b) => b - a);
    return list.length ? list : [new Date().getFullYear()];
  }, [dashboardSection, transactions, transactionYearBounds]);

  const monthOptions = useMemo(
    () =>
      buildDashboardMonthOptions(
        dashboardSection === "sasu" ? null : transactionYearBounds,
        dashboardSection === "sasu" ? transactions.filter((t) => (t.scope ?? "pro") === "pro") : transactions
      ),
    [dashboardSection, transactionYearBounds, transactions]
  );

  const onSasuToggleYear = useCallback(
    (y: number) => {
      setSelectedYears((prev) => {
        const base = prev ?? [yearOptions[0] ?? new Date().getFullYear()];
        const next = new Set(base);
        if (next.has(y)) {
          if (next.size <= 1) return prev;
          next.delete(y);
          setSelectedMonths((months) => months.filter((m) => Number(m.slice(0, 4)) !== y));
        } else {
          next.add(y);
        }
        return Array.from(next).sort((a, b) => b - a);
      });
    },
    [yearOptions]
  );

  const onSasuToggleMonth = useCallback((m: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return Array.from(next).sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const onSasuClearMonths = useCallback(() => setSelectedMonths([]), []);

  const sasuYearsForFilter = selectedYears ?? [yearOptions[0] ?? new Date().getFullYear()];

  function toggleYearInFilter(y: number) {
    setSelectedMonth(null);
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
    <main id="dashboard-main" className="relative mt-0 scroll-mt-28 overflow-x-hidden sm:mt-2">
      <SectionThemeSync />
      <div className={clsx("w-full", dashboardSectionStack)}>
      <div
        className={clsx(dashboardSection !== "full" && "hidden", dashboardSectionStack)}
        aria-hidden={dashboardSection !== "full"}
      >
          <RevolutBalanceHero stats={currentHeroStats} statsReady />
          <RevolutInsightsSection
            transactions={transactions}
            bncYearTotalEur={currentHeroStats.bncYearTotalEur}
          />
          <TaxLiabilityCard
            cashEur={currentHeroStats.soldeQontoEur}
            vatEur={currentHeroStats.detteTvaDepuisDebutEur}
            csgEur={currentHeroStats.detteCsgDepuisDebutEur}
            totalLiabilityEur={currentHeroStats.detteTotaleDepuisDebutEur}
            statsReady
            formatEuro={fmt.euro}
            trend={taxLiabilityTrend}
          />
          <RevenueAllocationChart
            allocation={currentHeroStats.tjmRepartitionMois}
            formatEuro={fmt.euro}
            formatInt={fmt.int}
            trend={revenueAllocationTrend}
          />
          <DashboardPremiumHero
            stats={currentHeroStats}
            transactions={transactions}
            statsReady
            contextMessage={heroContextMessage}
            showContextBanner={showContextBanner}
          />
      </div>
      <div
        className={clsx(dashboardSection !== "activite" && "hidden", dashboardSectionStack)}
        aria-hidden={dashboardSection !== "activite"}
      >
        <ActivityOverviewPremium
          kpis={billableActivity.overviewKpis}
          workdayGauge={billableActivity.overviewWorkdayGauge}
          ctaMode="hidden"
        />
        <BillableDaysCalendarBlock
          treasuryTransactions={transactions}
          treasuryScope="pro"
        />
      </div>
      <div className={clsx(dashboardSection !== "valeur" && "hidden")} aria-hidden={dashboardSection !== "valeur"}>
        <ValeurReelleClient
          initialTransactions={transactions}
          demoMode={demoMode}
          loadError={loadError}
        />
      </div>
      <div
        className={clsx(dashboardSection !== "categorisation" && "hidden")}
        aria-hidden={dashboardSection !== "categorisation"}
      >
        <DashboardCategorisationPanel />
      </div>
      <div
        className={clsx(dashboardSection !== "sasu" && dashboardSection !== "private" && "hidden")}
        aria-hidden={dashboardSection !== "sasu" && dashboardSection !== "private"}
      >
          {dashboardSection === "private" ? (
            <DashboardPeriodFilterSection
              selectedYears={selectedYears}
              setSelectedYears={setSelectedYears}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              monthOptions={monthOptions}
              yearOptions={yearOptions}
              onToggleYear={toggleYearInFilter}
              sticky
              showRollingOption
              showActiveLabel
            />
          ) : null}

          {dashboardSection === "sasu" ? (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
              <div className={clsx(dashboardAnalysisShell, "xl:col-span-2")}>
                <DashboardInsightPeriodFilter
                  eyebrow="SASU"
                  title="Entrées & sorties"
                  yearOptions={yearOptions}
                  monthOptions={monthOptions}
                  selectedYears={sasuYearsForFilter}
                  selectedMonths={sasuMonthsForYears}
                  onToggleYear={onSasuToggleYear}
                  onToggleMonth={onSasuToggleMonth}
                  onClearMonths={onSasuClearMonths}
                />
                  <div className={clsx(dashboardSegmentShell("mt-3 grid-cols-2"))}>
                    {[
                      { label: "Entrées", mode: "revenues" as const },
                      { label: "Sorties", mode: "expenses" as const }
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.label}
                        onClick={() => setSasuAnalysisMode(item.mode)}
                        className={dashboardSegmentBtn(sasuAnalysisMode === item.mode)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
              </div>

              <div className={dashboardPremiumPanel}>
                {(() => {
                  const currentSlices = sasuPanelDonutView.slices;
                  const currentTotal = sasuPanelDonutView.total;
                  return (
                    <>
                <div className={dashboardGaugeTrack}>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/70 via-transparent to-white/20 dark:from-white/12 dark:to-white/5" aria-hidden />
                  <div className="relative flex h-5 overflow-hidden rounded-full">
                    {currentSlices.map((slice) => (
                      <span
                        key={`bar-${slice.name}`}
                        style={{ width: `${slice.pct}%`, backgroundColor: slice.color }}
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
                <div className={clsx("relative mx-auto flex h-64 w-64 max-w-full items-center justify-center", dashboardDonutTrack)}>
                  <svg viewBox="0 0 200 200" className="block h-64 w-64 max-w-full" role="img" aria-label={sasuAnalysisMode === "revenues" ? "Répartition des revenus SASU" : "Répartition des dépenses SASU"}>
                    <defs>
                      <filter id="sasu-donut-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.18" />
                      </filter>
                    </defs>
                    <circle cx="100" cy="100" r="58" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="16" />
                    {currentSlices.map((slice) => (
                      <circle
                        key={slice.name}
                        cx="100"
                        cy="100"
                        r="58"
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="16"
                        strokeDasharray={`${slice.dash} ${100 - slice.dash}`}
                        strokeDashoffset={slice.offset}
                        pathLength={100}
                        strokeLinecap="round"
                        transform="rotate(-90 100 100)"
                        filter="url(#sasu-donut-shadow)"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="font-display text-xl font-bold tabular-nums text-ink-900 dark:text-white sm:text-2xl" data-private>
                        {fmt.euro(currentTotal)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-ink-500 dark:text-white/56 sm:text-sm">
                        {sasuAnalysisMode === "revenues" ? "Revenus HT" : "Dépenses HT"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={clsx(dashboardSegmentShell("mx-auto mt-3 grid max-w-sm grid-cols-2 gap-2"))}>
                  <button
                    type="button"
                    onClick={() => {
                      setSasuBreakdownMode("categories");
                      setSasuMonthlyCategoryFilters([]);
                    }}
                    className={dashboardSegmentBtn(sasuBreakdownMode === "categories")}
                  >
                    {sasuAnalysisMode === "revenues" ? "Revenus" : "Catégories"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSasuBreakdownMode("simplified");
                      setSasuMonthlyCategoryFilters([]);
                    }}
                    className={dashboardSegmentBtn(sasuBreakdownMode === "simplified")}
                  >
                    Simplifié
                  </button>
                </div>

                {sasuMonthlyEvolutionOptions.length ? (
                  <div className="mt-5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {sasuMonthlyCategoryFilters.length ? (
                      <button
                        type="button"
                        onClick={() => setSasuMonthlyCategoryFilters([])}
                        className="shrink-0 rounded-full border border-ink-200 bg-ink-50 px-3 py-2 text-[11px] font-bold text-ink-700 transition hover:bg-ink-100 hover:text-ink-900 dark:border-white/12 dark:bg-white/[0.08] dark:text-white/82 dark:hover:bg-white/[0.12] dark:hover:text-white"
                      >
                        Toutes
                      </button>
                    ) : null}
                    {sasuMonthlyEvolutionOptions.map((item) => {
                      const active = sasuMonthlyCategoryFilters.includes(item.name);
                      const color = sasuMonthlyEvolutionColorByName.get(item.name) ?? "#4f7eea";
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() =>
                            setSasuMonthlyCategoryFilters((prev) =>
                              prev.includes(item.name)
                                ? prev.filter((name) => name !== item.name)
                                : [...prev, item.name]
                            )
                          }
                          className={dashboardFilterPill(active)}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_currentColor]"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          <span className="max-w-[11rem] truncate">{item.name}</span>
                          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-600 dark:bg-white/[0.07] dark:text-white/68">{fmt.euro(item.total)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-4" data-private>
                  <div className={dashboardChartSurface}>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,126,234,0.12),transparent_45%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(79,126,234,0.24),transparent_45%)]" />
                    <div className="pointer-events-none absolute inset-4 rounded-2xl bg-[linear-gradient(rgba(148,163,184,0.22)_1px,transparent_1px)] bg-[size:100%_25%] dark:bg-[linear-gradient(rgba(255,255,255,0.095)_1px,transparent_1px)]" />
                    <svg viewBox="0 0 320 170" className="relative z-[1] h-full w-full overflow-visible" role="img" aria-label="Courbe des dépenses mensuelles SASU">
                      <defs>
                        <linearGradient id="sasu-monthly-total-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f7eea" stopOpacity="0.34" />
                          <stop offset="100%" stopColor="#4f7eea" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0, 1, 2, 3].map((tick) => {
                        const y = 18 + tick * 34;
                        const value = maxSasuMonthlyChartValue * (1 - tick / 3);
                        return (
                          <g key={`grid-${tick}`}>
                            <line
                              x1="30"
                              x2="312"
                              y1={y}
                              y2={y}
                              stroke="var(--chart-grid)"
                              strokeDasharray="4 5"
                            />
                            <text
                              x="0"
                              y={y + 3}
                              fill="var(--chart-label)"
                              style={{ fontSize: 7.5, fontWeight: 800 }}
                            >
                              {compactEuroAxis(value)}
                            </text>
                          </g>
                        );
                      })}
                      <line x1="30" x2="312" y1="136" y2="136" stroke="var(--chart-axis)" strokeWidth="1.2" />
                      <line x1="30" x2="30" y1="14" y2="136" stroke="var(--chart-axis)" strokeWidth="1.2" />
                      {(() => {
                        const totalPoints = sasuMonthlyEvolutionSeries.map((month, index) => {
                          const x =
                            sasuMonthlyEvolutionSeries.length <= 1
                              ? 160
                              : (index / (sasuMonthlyEvolutionSeries.length - 1)) * 276 + 34;
                          const y = 132 - (month.value / maxSasuMonthlyChartValue) * 112;
                          return { x, y, value: month.value, month: month.month };
                        });
                        const totalPath = smoothSvgPath(totalPoints);
                        const areaPath = totalPoints.length
                          ? `${totalPath} L ${totalPoints[totalPoints.length - 1]!.x.toFixed(1)} 136 L ${totalPoints[0]!.x.toFixed(1)} 136 Z`
                          : "";
                        return (
                          <g>
                            <path d={areaPath} fill="url(#sasu-monthly-total-area)" />
                            <path
                              d={totalPath}
                              fill="none"
                              stroke="#4f7eea"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                        );
                      })()}
                      {sasuMonthlyLineNames.map((name) => {
                        const color = sasuMonthlyEvolutionColorByName.get(name) ?? "#4f7eea";
                        const points = sasuMonthlyEvolutionSeries.map((month, index) => {
                          const x =
                            sasuMonthlyEvolutionSeries.length <= 1
                              ? 160
                              : (index / (sasuMonthlyEvolutionSeries.length - 1)) * 276 + 34;
                          const value = month.byCategory.find((category) => category.name === name)?.value ?? 0;
                          const y = 132 - (value / maxSasuMonthlyChartValue) * 112;
                          return { x, y, value, month: month.month };
                        });
                        const path = smoothSvgPath(points);
                        return (
                          <g key={name}>
                            <path
                              d={path}
                              fill="none"
                              stroke={color}
                              strokeWidth="1.85"
                              strokeOpacity="0.88"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {points.map((point) => (
                              <circle
                                key={`${name}-${point.month}`}
                                cx={point.x}
                                cy={point.y}
                                r={point.value > 0 ? 2.4 : 1.5}
                                fill={point.value > 0 ? color : "#94a3b8"}
                                stroke="var(--chart-dot-stroke)"
                                strokeWidth="1.25"
                              />
                            ))}
                          </g>
                        );
                      })}
                      {sasuMonthlyEvolutionSeries.map((month, index) => {
                        const x =
                          sasuMonthlyEvolutionSeries.length <= 1
                            ? 160
                            : (index / (sasuMonthlyEvolutionSeries.length - 1)) * 276 + 34;
                        const show =
                          sasuMonthlyEvolutionSeries.length <= 6
                            ? true
                            : index === 0 ||
                              index === sasuMonthlyEvolutionSeries.length - 1 ||
                              index % Math.ceil(sasuMonthlyEvolutionSeries.length / 5) === 0;
                        const [monthPart = "", yearPart = ""] = month.month.split(" ");
                        return show ? (
                          <g key={`x-${month.monthKey}`}>
                            <line
                              x1={x}
                              x2={x}
                              y1="136"
                              y2="140"
                              stroke="var(--chart-axis)"
                              strokeWidth="1"
                            />
                            <text
                              x={x}
                              y="151"
                              textAnchor="middle"
                              fill="var(--chart-label)"
                              style={{ fontSize: 7.5, fontWeight: 800 }}
                            >
                              {monthPart.replace(".", "")}
                            </text>
                            {index === 0 || monthPart.toLowerCase().startsWith("janv") ? (
                              <text
                                x={x}
                                y="162"
                                textAnchor="middle"
                              fill="var(--chart-label-muted)"
                              style={{ fontSize: 6.5, fontWeight: 700 }}
                              >
                                {yearPart}
                              </text>
                            ) : null}
                          </g>
                        ) : null;
                      })}
                    </svg>
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>

              <div className={dashboardPremiumPanel}>
                <div className="space-y-1" data-private>
                  {sasuPanelDonutView.slices.length ? (
                    (() => {
                      const rows = sasuPanelDonutView.slices;
                      const visibleRows = showAllSasuCategoryRows ? rows : rows.slice(0, 5);
                      const remainingRows = Math.max(0, rows.length - visibleRows.length);
                      return (
                        <>
                    {visibleRows.map(({ name, total, color }) => {
                      const simplified = sasuAnalysisMode === "expenses" && sasuBreakdownMode === "simplified";
                      const baseTotal = sasuPanelDonutView.total;
                      const pct = baseTotal > 0 ? Math.round((total / baseTotal) * 100) : 0;
                      const CatIcon = categoryGlyph(name);
                      const open = sasuAnalysisMode === "revenues" ? revenueCounterpartyDetail === name : expenseCategoryDetail === name;
                      const currentCategoryTransactions = filteredTx.filter((tx) => {
                        if (sasuAnalysisMode === "revenues") {
                          return isRevenueCategory(tx.category) && tx.amount > 0 && revenueCounterpartyDisplayName(tx) === name;
                        }
                        if (simplified) {
                          return sasuSimplifiedExpenseGroup(tx) === name;
                        }
                        return tx.amount < 0 && expenseDashboardGroupingLabel(tx, kpiMode) === name;
                      });
                      const detailTransactions =
                        sasuAnalysisMode === "revenues" ? revenueTransactionsForCounterparty : expenseTransactionsForCategory;
                      const subcategories = simplified ? sasuSimplifiedSubcategories[name] ?? [] : [];
                      const subcategoriesExpanded = expandedSasuSubcategoryGroups.has(name);
                      const billableRevenue = sasuAnalysisMode === "revenues" && isCounterpartyBillableDaysAtTjm(name);
                      const categoryRevenueTransactions = billableRevenue
                        ? filteredTx.filter((tx) =>
                            isRevenueCategory(tx.category) &&
                            tx.amount > 0 &&
                            revenueCounterpartyDisplayName(tx) === name
                          )
                        : [];
                      const billedDaysForRevenue = billableRevenue
                        ? categoryRevenueTransactions.reduce((sum, tx) => {
                            const tjmHt = resolveBillableTjmForClientMonth(
                              billableActivity.billableRatePeriods,
                              name,
                              tx.date.slice(0, 7),
                              BILLABLE_CLIENT_TJM_HT
                            );
                            return sum + (tx.amount / (1 + VAT_RATE)) / tjmHt;
                          }, 0)
                        : 0;
                      return (
                        <div key={name} className={dashboardRowDivider}>
                          <button
                            type="button"
                            onClick={() => {
                              if (simplified) return;
                              if (sasuAnalysisMode === "revenues") {
                                setRevenueCounterpartyDetail((prev) => (prev === name ? null : name));
                              } else {
                                setExpenseCategoryDetail((prev) => (prev === name ? null : name));
                              }
                            }}
                            className="flex w-full items-center gap-3 text-left"
                            aria-expanded={simplified ? undefined : open}
                          >
                            <span
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-[0_10px_28px_-18px_rgba(255,255,255,0.5)]"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            >
                              <CatIcon className="h-5 w-5" strokeWidth={2} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={dashboardRowTitle}>{name}</span>
                              <span className={dashboardRowMeta}>
                                {pct} % · {currentCategoryTransactions.length} transaction{currentCategoryTransactions.length > 1 ? "s" : ""}
                                {sasuAnalysisMode === "revenues" && billableRevenue
                                  ? ` · ${formatDaysCount.format(billedDaysForRevenue)} j facturés`
                                  : null}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className={dashboardRowAmount}>{fmt.euro(total)}</span>
                              {!simplified ? <span className="text-ink-300 dark:text-white/28">›</span> : null}
                            </span>
                          </button>
                          {subcategories.length ? (
                            <div className="ml-[3.25rem] mt-2 space-y-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedSasuSubcategoryGroups((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(name)) next.delete(name);
                                    else next.add(name);
                                    return next;
                                  });
                                }}
                                className="w-full rounded-xl border border-ink-200/80 bg-ink-50/80 px-3 py-2 text-left text-[11px] font-bold text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 dark:border-[#39586a]/60 dark:bg-[#102634]/70 dark:text-white/62 dark:hover:bg-[#203d4f] dark:hover:text-white"
                                aria-expanded={subcategoriesExpanded}
                              >
                                {subcategoriesExpanded
                                  ? "Masquer les sous-catégories"
                                  : `Afficher ${subcategories.length} sous-catégorie${subcategories.length > 1 ? "s" : ""}`}
                              </button>
                              {subcategoriesExpanded
                                ? subcategories.map((subcategory) => {
                                    const subPct = total > 0 ? Math.round((subcategory.total / total) * 100) : 0;
                                    return (
                                      <div
                                        key={`${name}-${subcategory.name}`}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-ink-50/90 px-3 py-2 text-xs dark:bg-[#102634]/80"
                                      >
                                        <span className="min-w-0 truncate text-ink-600 dark:text-white/70">
                                          {subcategory.name} · {subPct} %
                                        </span>
                                        <span className={clsx(dashboardRowAmount, "shrink-0")}>
                                          {fmt.euro(subcategory.total)}
                                        </span>
                                      </div>
                                    );
                                  })
                                : null}
                            </div>
                          ) : null}
                          {open ? (
                            <div className={clsx("ml-[3.25rem] mt-2 p-3", dashboardInsetPanel)}>
                              {detailTransactions.length ? (
                                <div className="space-y-2">
                                  {detailTransactions.slice(0, 8).map((tx) => {
                                    const txTjmHt =
                                      sasuAnalysisMode === "revenues"
                                        ? resolveBillableTjmForClientMonth(
                                            billableActivity.billableRatePeriods,
                                            name,
                                            tx.date.slice(0, 7),
                                            BILLABLE_CLIENT_TJM_HT
                                          )
                                        : 0;
                                    const txBilledDays =
                                      sasuAnalysisMode === "revenues" && billableRevenue
                                        ? (tx.amount / (1 + VAT_RATE)) / txTjmHt
                                        : 0;
                                    return (
                                      <div
                                        key={tx.id}
                                        className="flex items-start justify-between gap-3 border-b border-ink-200/60 pb-2 text-xs last:border-0 last:pb-0 dark:border-cyan-100/[0.06]"
                                      >
                                        <span className="min-w-0">
                                          <span className="block font-mono text-[10px] text-ink-400 dark:text-white/36">{tx.date}</span>
                                          <span className="block truncate text-ink-700 dark:text-white">{tx.label}</span>
                                          {sasuAnalysisMode === "revenues" && billableRevenue ? (
                                            <span className="mt-0.5 block text-[10px] font-medium text-ink-500 dark:text-white/42">
                                              {formatDaysCount.format(txBilledDays)} j facturés · TJM {fmt.euro(txTjmHt)} HT
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="shrink-0 text-right font-semibold tabular-nums text-ink-900 dark:text-white">
                                          {fmt.euro(
                                            sasuAnalysisMode === "expenses"
                                              ? dashboardSasuExpenseAmountHt(tx)
                                              : Math.abs(tx.amount)
                                          )}
                                          {sasuAnalysisMode === "expenses" &&
                                          dashboardSasuExpenseAmountHt(tx) !== Math.abs(tx.amount) ? (
                                            <span className="mt-0.5 block text-[10px] font-medium text-ink-500 dark:text-white/42">
                                              TTC {fmt.euro(Math.abs(tx.amount))}
                                            </span>
                                          ) : null}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-ink-500 dark:text-white/42">Aucune opération disponible.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {remainingRows > 0 || showAllSasuCategoryRows ? (
                      <button
                        type="button"
                        onClick={() => setShowAllSasuCategoryRows((prev) => !prev)}
                        className="mt-2 w-full rounded-2xl border border-ink-200/80 bg-ink-50/80 px-4 py-3 text-sm font-bold text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.05] dark:text-white/68 dark:hover:bg-cyan-50/[0.09] dark:hover:text-white"
                      >
                        {showAllSasuCategoryRows ? "Replier les catégories" : `Afficher ${remainingRows} autres catégories`}
                      </button>
                    ) : null}
                    </>
                      );
                    })()
                  ) : (
                    <p className={dashboardEmptyState}>Aucune donnée sur cette période.</p>
                  )}
                  </div>
              </div>
            </section>
          ) : null}
          {dashboardSection === "private" ? (
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
                <span data-private>
                  {fmt.euro(kpiMode === "personal" ? totalRevenues : totalRevenuesHt)}
                </span>
                <span className="ml-2 align-middle text-xs font-medium text-ink-500">
                  {kpiMode === "personal" ? "TTC (perso)" : "HT"}
                </span>
              </CardValue>
              <div className="mt-3 flex items-start gap-2.5 text-sm text-ink-500 dark:text-ink-400">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  aria-hidden
                >
                  <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="leading-snug">
                  <span className="font-medium text-ink-700 dark:text-ink-200">
                    {kpiMode === "personal" ? "Encaissements cumulés" : "Chiffre d’affaires HT"}
                  </span>
                  <span className="block text-xs font-normal text-ink-500 dark:text-ink-400">
                    {kpiMode === "personal" ? (
                      <>Somme des crédits sur la période, hors virements internes Bankin · {periodLabel}</>
                    ) : (
                      <>
                        Équivalent TTC <span data-private>{fmt.euro(totalRevenues)}</span> · {periodLabel}
                      </>
                    )}
                  </span>
                </span>
              </div>
              <RevenueMiniChart
                data={monthlyRevenueChartSeries}
                ariaLabel={
                  kpiMode === "personal"
                    ? `Évolution des encaissements TTC par mois (perso) — ${periodLabel}`
                    : `Évolution du chiffre d’affaires HT par mois — ${periodLabel}`
                }
              />
              {kpiMode === "personal" ? (
                <div
                  className="mt-3 rounded-xl border border-emerald-200/90 bg-emerald-50/60 px-3 py-3 dark:border-emerald-700/50 dark:bg-emerald-950/50"
                  aria-label={`Projection encaissements perso fin ${revenueYearProjection.calendarYear}`}
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
                      <p
                        className="font-display text-lg font-bold tabular-nums text-emerald-950 dark:text-emerald-100"
                        data-private
                      >
                        {fmt.euro(revenueYearProjection.projectedYearEndTtc)}{" "}
                        <span className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-400">TTC</span>
                      </p>
                      <p className="text-xs leading-snug text-emerald-900/70 dark:text-emerald-300/70" data-private>
                        Réalisé depuis le 1er janv. :{" "}
                        <span className="font-medium text-emerald-950 dark:text-emerald-200">
                          {fmt.euro(revenueYearProjection.ytdTtc)}
                        </span>
                        <span className="text-emerald-800/80 dark:text-emerald-400/80">
                          {" "}
                          · jour civil {revenueYearProjection.dayOfYear}/{revenueYearProjection.daysInYear} (
                          {Math.round(revenueYearProjection.fractionOfYearElapsed * 100)} % de l’année)
                        </span>
                      </p>
                      <p className="text-[11px] leading-snug text-emerald-800/70 dark:text-emerald-400/70">
                        Encaissements cumulés (hors virements internes Bankin), extrapolation linéaire au prorata
                        calendaire. Indépendant de la fenêtre graphique ci-dessus.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
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
                      <p
                        className="font-display text-lg font-bold tabular-nums text-emerald-950 dark:text-emerald-100"
                        data-private
                      >
                        {fmt.euro(revenueYearProjection.projectedYearEndHt)}{" "}
                        <span className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-400">HT</span>
                      </p>
                      <p className="text-xs text-emerald-900/75 dark:text-emerald-300/80" data-private>
                        Équivalent TTC estimé{" "}
                        <span className="font-medium">{fmt.euro(revenueYearProjection.projectedYearEndTtc)}</span>
                      </p>
                      <p className="text-xs leading-snug text-emerald-900/70 dark:text-emerald-300/70" data-private>
                        Réalisé YTD HT :{" "}
                        <span className="font-medium text-emerald-950 dark:text-emerald-200">
                          {fmt.euro(revenueYearProjection.ytdHt)}
                        </span>
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
                            <span className="font-medium text-emerald-900 dark:text-emerald-300">
                              {scope === "pro" ? "SASU" : "Privé"}
                            </span>
                            , hors fenêtre graphique.
                          </>
                        ) : (
                          <>
                            Extrapolation au prorata calendaire (CA réalisé ÷ part d’année écoulée). Périmètre :{" "}
                            <span className="font-medium text-emerald-900">
                              {scope === "pro" ? "SASU" : "Privé"}
                            </span>
                            , indépendamment de la fenêtre graphique ci-dessus.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div
                className="mt-3 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-3 dark:border-ink-800"
                data-private
              >
                {revenueCounterpartyTotals.length ? (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
                      {kpiMode === "personal"
                        ? "Sous-catégories Bankin · TTC"
                        : "Contreparties / clients · HT"}
                    </p>
                    <p className="text-[10px] leading-snug text-ink-500 dark:text-ink-400">
                      {kpiMode === "personal"
                        ? "Cliquez une ligne pour afficher les encaissements de cette sous-catégorie."
                        : "Cliquez une ligne pour afficher les encaissements de cette contrepartie."}
                    </p>
                    <ul
                      className="max-h-36 space-y-1 overflow-y-auto pr-0.5 text-xs"
                      aria-label={
                        kpiMode === "personal"
                          ? "Montants encaissés par sous-catégorie Bankin"
                          : "Montants encaissés par contrepartie"
                      }
                    >
                      {revenueCounterpartyTotals.map(({ name, total }) => {
                        const totalHt = total / (1 + VAT_RATE);
                        const displayAmount = kpiMode === "personal" ? total : totalHt;
                        const denom = kpiMode === "personal" ? totalRevenues : totalRevenuesHt;
                        const pct =
                          denom > 0 ? Math.min(100, Math.round((displayAmount / denom) * 100)) : 0;
                        const showBillableDays =
                          kpiMode !== "personal" && isCounterpartyBillableDaysAtTjm(name);
                        const htForClient = totalHt;
                        const clientTjmHt = resolveBillableTjmForClientMonth(
                          billableActivity.billableRatePeriods,
                          name,
                          dashboardMonthKeyNowLocal(),
                          BILLABLE_CLIENT_TJM_HT
                        );
                        const workedDays = showBillableDays ? htForClient / clientTjmHt : 0;
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
                                      {fmt.euro(clientTjmHt)} HT
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                                <span className="font-medium text-emerald-800 dark:text-emerald-300">
                                  {fmt.euro(displayAmount)}
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
                            {kpiMode === "personal" ? "Sous-catégorie" : "Encaissements"} ·{" "}
                            {revenueCounterpartyDetail}
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
                                    <span className="font-medium text-emerald-800">{fmt.euro(tx.amount)}</span>
                                    {kpiMode === "personal" ? (
                                      <span className="text-[10px] text-ink-400">TTC</span>
                                    ) : (
                                      <span className="text-[10px] text-ink-400">TTC · {fmt.euro(ht)} HT</span>
                                    )}
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
                    {kpiMode === "personal"
                      ? "Aucun encaissement (hors virements internes) sur cette période."
                      : "Aucun encaissement « Chiffre d’affaires » sur cette période."}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card id="dashboard-fiscal" variant="solid" className="flex h-full min-h-0 flex-col">
            <CardHeader className="pb-3">
              <div className="min-w-0">
                <DashboardBlockTitle icon={TrendingDown} iconTone="expense">
                  Total expenses
                </DashboardBlockTitle>
                <div className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                  {totalExpensesCardSubtitle}
                </div>
              </div>
            </CardHeader>
            <CardBody className="flex flex-1 flex-col pt-0">
              <CardValue>
                <span data-private>{fmt.euro(totalExpensesCard)}</span>
                {kpiMode === "sasu" ? (
                  <span className="ml-2 align-middle text-xs font-medium text-ink-500">HT</span>
                ) : null}
              </CardValue>
              <div className="mt-3 flex items-start gap-2.5 text-sm text-ink-500 dark:text-ink-400">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50/90 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                  aria-hidden
                >
                  <Receipt className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="leading-snug">
                  <span className="font-medium text-ink-700 dark:text-ink-200">
                    {kpiMode === "sasu" ? "Synthèse des dépenses HT" : "Synthèse des dépenses"}
                  </span>
                  <span className="block text-xs font-normal text-ink-500 dark:text-ink-400">
                    {kpiMode === "sasu" ? (
                      <>
                        Équivalent TTC <span data-private>{fmt.euro(totalExpensesCardTtc)}</span> · graphique ci-dessous
                      </>
                    ) : (
                      "Total sur la période · graphique ci-dessous"
                    )}
                  </span>
                </span>
              </div>
              <ExpenseTotalMiniChart
                data={monthlyTotalExpensesSeries}
                selectedMonthKey={totalExpensesMonthFilter}
                onMonthClick={(monthKey) =>
                  setTotalExpensesMonthFilter((prev) => (prev === monthKey ? null : monthKey))
                }
                ariaLabel={
                  kpiMode === "personal"
                    ? `Évolution des dépenses perso par mois (catégories Bankin, hors virements internes) — ${periodLabel}${totalExpensesMonthFilter ? ` — filtre ${monthLabelFr(totalExpensesMonthFilter)}` : ""}. Cliquer un mois sur le graphique active ou désactive le filtre sur ce mois.`
                    : `Évolution des dépenses HT par mois (hors BNC et TVA) — ${periodLabel}${totalExpensesMonthFilter ? ` — filtre ${monthLabelFr(totalExpensesMonthFilter)}` : ""}. Cliquer un mois sur le graphique active ou désactive le filtre sur ce mois.`
                }
              />
              <div
                className="mt-4 flex min-h-0 flex-1 flex-col space-y-2 border-t border-ink-200 pt-4 dark:border-ink-800"
                data-private
              >
                <div className="rounded-xl border border-rose-100/90 bg-rose-50/40 px-2.5 py-2.5 dark:border-rose-900/40 dark:bg-rose-950/25">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-900/75 dark:text-rose-200/90">
                    {kpiMode === "personal"
                      ? "Sous-catégories (dépenses) · filtre"
                      : "Catégories (dépenses) · filtre"}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-ink-600 dark:text-ink-400">
                    {kpiMode === "personal" ? (
                      <>
                        Sélectionnez une ou plusieurs sous-catégories Bankin pour restreindre les dépenses ci-dessous
                        (totaux et graphique). Les encaissements du bloc revenus restent inchangés.
                      </>
                    ) : (
                      <>
                        Sélectionnez une ou plusieurs catégories pour restreindre les dépenses ci-dessous (totaux et
                        graphique). Le CA du dashboard reste inchangé.
                      </>
                    )}
                  </p>
                  <div
                    className="mt-2 flex max-h-36 flex-wrap items-center gap-2 overflow-y-auto pr-0.5"
                    role="group"
                    aria-label={
                      kpiMode === "personal"
                        ? "Filtrer les dépenses par sous-catégorie Bankin"
                        : "Filtrer les dépenses par catégorie dérivée"
                    }
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
                        ? "Catégories · ce mois"
                        : "Catégories · total période et moy. / mois (période écoulée)"}
                    </p>
                    <p className="text-[10px] leading-snug text-ink-500 dark:text-ink-400">
                      Toutes les {kpiMode === "personal" ? "catégories Bankin" : "catégories"} de la vue en cours.
                      Cliquez une ligne pour afficher les opérations (même logique que la répartition).
                    </p>
                    <ul
                      className="max-h-[min(28rem,70vh)] space-y-1 overflow-y-auto pr-0.5 text-xs"
                      aria-label="Catégories de dépenses"
                    >
                      {expenseCategoryTotalsForTotalExpensesCard.map(({ name, total }) => {
                        const pct =
                          totalExpensesCard > 0 ? Math.min(100, Math.round((total / totalExpensesCard) * 100)) : 0;
                        const color = expenseCategoryColor(name);
                        const CatIcon = categoryGlyph(name);
                        const expenseBrandLogo = counterpartyLogoHref(name, 64);
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
                                  className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white text-ink-700 shadow-sm dark:bg-ink-900"
                                  style={{ borderColor: color, color: expenseBrandLogo ? undefined : color }}
                                  aria-hidden
                                >
                                  {expenseBrandLogo ? (
                                    <CounterpartyLogo
                                      name={name}
                                      size={20}
                                      className="border-0 bg-transparent shadow-none"
                                    />
                                  ) : (
                                    <CatIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                  )}
                                </span>
                                <span className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                                  {name}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                                <span className="flex items-baseline gap-2">
                                  <span className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                                    {fmt.euro(total)}
                                  </span>
                                  <span className="w-7 text-right text-[10px] font-medium text-ink-400 dark:text-ink-500">
                                    {pct}%
                                  </span>
                                </span>
                                {!totalExpensesMonthFilter && monthsElapsedInDashboardPeriod > 0 ? (
                                  <span className="text-[11px] font-medium text-rose-700/90 dark:text-rose-300/90">
                                    moy. {fmt.euro(avgMonthly)}{" "}
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
                                    {expenseTransactionsForCategory.map((tx) => {
                                      const gross = Math.abs(tx.amount);
                                      const ht = kpiMode === "sasu" ? dashboardSasuExpenseAmountHt(tx) : gross;
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
                                          {tx.company ? (
                                            <span className="mt-0.5 block truncate text-[10px] text-ink-500 dark:text-ink-400">
                                              {tx.company}
                                            </span>
                                          ) : null}
                                          {tx.bankName ? (
                                            <span className="mt-0.5 block truncate text-[10px] font-medium text-ink-500 dark:text-ink-400">
                                              Banque : {tx.bankName}
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="shrink-0 text-right font-medium tabular-nums text-rose-800 dark:text-rose-300">
                                          {fmt.euro(ht)}
                                          {kpiMode === "sasu" && ht !== gross ? (
                                            <span className="block text-[10px] font-normal text-ink-400">
                                              TTC {fmt.euro(gross)}
                                            </span>
                                          ) : null}
                                        </span>
                                      </li>
                                    );
                                    })}
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
          ) : null}

      </div>
      </div>
    </main>
  );
}
