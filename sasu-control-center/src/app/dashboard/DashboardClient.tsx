"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ChevronDown,
  CirclePlus,
  Receipt,
  Search,
  Settings,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { ExpenseTotalMiniChart } from "@/components/charts/ExpenseTotalMiniChart";
import { RevenueMiniChart } from "@/components/charts/RevenueMiniChart";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { BillableDaysCalendarBlock } from "@/components/dashboard/BillableDaysCalendarBlock";
import { DashboardPeriodFilterSection } from "@/components/dashboard/DashboardPeriodFilterSection";
import { DashboardPremiumHero } from "@/components/dashboard/DashboardPremiumHero";
import { ValeurReelleClient } from "@/components/dashboard/ValeurReelleClient";
import { DashboardCategorisationPanel } from "@/app/dashboard/DashboardCategorisationPanel";
import { CounterpartyLogo } from "@/components/dashboard/CounterpartyLogo";
import { Card, CardBody, CardHeader, CardTitle, CardValue } from "@/components/ui/Card";
import { bankinSubcategoryLabel } from "@/lib/bankin/categorize";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { categoryGlyph } from "@/lib/category-glyph";
import { counterpartyLogoHref } from "@/lib/counterparty-logo";
import { buildDashboardMonthOptions, formatDashboardPeriodLabelWithMonth } from "@/lib/dashboard-period";
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
  countsTowardPersonalRevenueKpi,
  expenseCategoryColor,
  expenseDashboardGroupingLabel,
  filterDashboardTransactions,
  omitExpenseCategoriesFromBreakdown,
  transactionAnalyticsDayIso,
  TVA_DERIVED_EXPENSE_BUCKET,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import {
  isValeurReelleMandatoryFeeLine,
  isValeurReellePersonalChargeLine
} from "@/lib/valeur-reelle-analyze";

export type { DashboardTx };

const DASHBOARD_SECTION_SLIDE_VARIANTS = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 56 }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -56,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }
  })
};

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

/** 12 mois glissants vs années civiles — même logique que la section analytics (`selectedYears` → revenus & dépenses). */
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
  const searchParams = useSearchParams();

  const dashboardSection = useMemo(() => {
    if (searchParams.get("panel") === "valeur-reelle") return "valeur" as const;
    const s = searchParams.get("section");
    if (s === "activite") return "activite" as const;
    if (s === "sasu") return "sasu" as const;
    if (s === "private") return "private" as const;
    if (s === "categorisation") return "categorisation" as const;
    return "full" as const;
  }, [searchParams]);

  /** Ordre des pilules périmètre : gauche → droite (pour le sens du slide). */
  const sectionOrder: Record<typeof dashboardSection, number> = {
    full: 0,
    activite: 1,
    valeur: 2,
    sasu: 3,
    private: 4,
    categorisation: 5
  };
  const prevSectionRef = useRef(dashboardSection);
  const slideDirRef = useRef(1);
  if (prevSectionRef.current !== dashboardSection) {
    const from = sectionOrder[prevSectionRef.current];
    const to = sectionOrder[dashboardSection];
    slideDirRef.current = to >= from ? 1 : -1;
  }
  useLayoutEffect(() => {
    prevSectionRef.current = dashboardSection;
  }, [dashboardSection]);
  const [transactions, setTransactions] = useState<DashboardTx[]>(initialTransactions);
  const [currentHeroStats, setCurrentHeroStats] = useState<DashboardHeroStats>(heroStats);
  const [heroStatsReady, setHeroStatsReady] = useState(demoMode);
  const [scope, setScope] = useState<"pro" | "personal">(() =>
    initialDashboardScope === "personal" ? "personal" : "pro"
  );
  /** null = fenêtre glissante 12 mois ; sinon une ou plusieurs années civiles */
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null);
  /** null = fenêtre/années ; sinon un seul mois civil YYYY-MM. */
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  /** null = total sur toute la fenêtre d’analyse ; sinon un seul mois (YYYY-MM) pour la carte Total expenses. */
  const [totalExpensesMonthFilter, setTotalExpensesMonthFilter] = useState<string | null>(null);
  /** Contrepartie CA sélectionnée dans la carte Total revenues (liste des encaissements). */
  const [revenueCounterpartyDetail, setRevenueCounterpartyDetail] = useState<string | null>(null);
  /** Catégorie dérivée sélectionnée dans Total expenses (liste des opérations). */
  const [expenseCategoryDetail, setExpenseCategoryDetail] = useState<string | null>(null);
  const [sasuAnalysisMode, setSasuAnalysisMode] = useState<"revenues" | "expenses">("expenses");
  const [sasuBreakdownMode, setSasuBreakdownMode] = useState<"categories" | "simplified">("categories");
  /** Filtre global des dépenses (buckets dérivés) : vide = toutes les catégories. */
  const [selectedExpenseCategoryFilters, setSelectedExpenseCategoryFilters] = useState<string[]>([]);

  useEffect(() => {
    setTransactions(initialTransactions);
    setCurrentHeroStats(heroStats);
    setHeroStatsReady(demoMode);
  }, [syncKey, initialTransactions, heroStats, demoMode]);

  useEffect(() => {
    let cancelled = false;
    const initialCount = initialTransactions.length;
    if (initialCount === 0 || initialCount >= 10_000) return;

    const timer = window.setTimeout(() => {
      void fetch("/api/dashboard/transactions", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as {
            ok?: boolean;
            transactions?: DashboardTx[];
            heroStats?: DashboardHeroStats;
          };
        })
        .then((payload) => {
          if (cancelled || !payload?.ok || !Array.isArray(payload.transactions)) return;
          if (payload.transactions.length > initialCount) {
            setTransactions(payload.transactions);
          }
          if (payload.heroStats) {
            setCurrentHeroStats(payload.heroStats);
            setHeroStatsReady(true);
          }
        })
        .catch(() => {
          // Le lot initial suffit pour afficher l'app ; l'historique complet est opportuniste.
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [heroStats, initialTransactions]);

  useEffect(() => {
    setRevenueCounterpartyDetail(null);
    setExpenseCategoryDetail(null);
    setSelectedExpenseCategoryFilters([]);
  }, [scope, selectedMonth, selectedYears, syncKey]);

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

  useEffect(() => {
    if (dashboardSection !== "sasu") return;
    setSelectedMonth(null);
    setSelectedYears((prev) => prev ?? [new Date().getFullYear()]);
  }, [dashboardSection]);

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

  const billableActivity = useBillableActivity();
  const { sortedIsos: billableWorkDayIsos } = billableActivity;

  const analyticsFilter = useMemo(
    () => ({ years: selectedYears, month: selectedMonth }),
    [selectedMonth, selectedYears]
  );

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

  const metrics = useMemo(
    () =>
      computeDashboardMonthlyMetrics(filteredTx, {
        years: selectedMonth ? [Number(selectedMonth.slice(0, 4))] : selectedYears,
        kpiMode
      }),
    [filteredTx, kpiMode, selectedMonth, selectedYears]
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
            years: selectedYears,
            expenseInclude: (tx) => countsTowardDashboardExpenseKpi(tx, "personal"),
            expenseGroup: "personal"
          })
        : computeDerivedExpenseCategoryMonthlyBreakdown(filteredTx, { years: selectedYears }),
    [filteredTx, selectedYears, kpiMode]
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
    const total = Math.max(0, totalExpensesCard);
    let cursor = 0;
    return expenseCategoryTotalsForTotalExpensesCard.map((category) => {
      const pct = total > 0 ? (category.total / total) * 100 : 0;
      const dash = Math.max(0, pct - 0.8);
      const slice = {
        ...category,
        pct,
        dash,
        offset: -cursor,
        color: expenseCategoryColor(category.name)
      };
      cursor += pct;
      return slice;
    });
  }, [expenseCategoryTotalsForTotalExpensesCard, totalExpensesCard]);

  const sasuRevenueDonutSlices = useMemo(() => {
    const total = Math.max(0, totalRevenuesHt);
    let cursor = 0;
    return revenueCounterpartyTotals.map(({ name, total: totalTtc }) => {
      const totalHt = totalTtc / (1 + VAT_RATE);
      const pct = total > 0 ? (totalHt / total) * 100 : 0;
      const dash = Math.max(0, pct - 0.8);
      const slice = {
        name,
        total: totalHt,
        pct,
        dash,
        offset: -cursor,
        color: expenseCategoryColor(name)
      };
      cursor += pct;
      return slice;
    });
  }, [revenueCounterpartyTotals, totalRevenuesHt, VAT_RATE]);

  const sasuSimplifiedExpenseSlices = useMemo(() => {
    let digitPro = 0;
    let perso = 0;
    for (const tx of filteredTx) {
      if (tx.amount >= 0) continue;
      const bucket = deriveExpenseBucket(tx);
      const amount = Math.abs(tx.amount);
      if (isValeurReelleMandatoryFeeLine(tx, bucket)) digitPro += amount;
      if (isValeurReellePersonalChargeLine(bucket)) perso += amount;
    }
    const total = Math.max(0, digitPro + perso);
    let cursor = 0;
    return [
      { name: "Frais DigitPro", total: digitPro, color: "#f59e0b" },
      { name: "Frais perso", total: perso, color: "#14b8a6" }
    ]
      .filter((slice) => slice.total > 0)
      .map((slice) => {
        const pct = total > 0 ? (slice.total / total) * 100 : 0;
        const out = { ...slice, pct, dash: Math.max(0, pct - 0.8), offset: -cursor };
        cursor += pct;
        return out;
      });
  }, [filteredTx]);

  const sasuSimplifiedSubcategories = useMemo(() => {
    const groups = new Map<string, Map<string, number>>();
    groups.set("Frais DigitPro", new Map());
    groups.set("Frais perso", new Map());

    for (const tx of filteredTx) {
      if (tx.amount >= 0) continue;
      const bucket = deriveExpenseBucket(tx);
      const amount = Math.abs(tx.amount);
      const label = bucket ?? expenseDashboardGroupingLabel(tx, kpiMode);

      if (isValeurReelleMandatoryFeeLine(tx, bucket)) {
        const digitPro = groups.get("Frais DigitPro");
        digitPro?.set(label, (digitPro.get(label) ?? 0) + amount);
      }

      if (isValeurReellePersonalChargeLine(bucket)) {
        const perso = groups.get("Frais perso");
        perso?.set(label, (perso.get(label) ?? 0) + amount);
      }
    }

    return Object.fromEntries(
      Array.from(groups.entries()).map(([groupName, subcategories]) => [
        groupName,
        Array.from(subcategories.entries())
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
      ])
    ) as Record<string, Array<{ name: string; total: number }>>;
  }, [filteredTx, kpiMode]);

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
        if (totalExpensesMonthFilter && tx.date.slice(0, 7) !== totalExpensesMonthFilter) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [filteredTx, expenseCategoryDetail, totalExpensesMonthFilter, kpiMode]);

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
    return formatDashboardPeriodLabelWithMonth(selectedYears, selectedMonth);
  }, [selectedMonth, selectedYears]);

  const totalExpensesCardSubtitle = useMemo(() => {
    let base: string;
    if (kpiMode === "personal") {
      base = "Dépenses perso (import Bankin), hors virements internes";
    } else {
      base = `Hors ${BNC_PAYROLL_EXPENSE_CATEGORY} et ${TVA_DERIVED_EXPENSE_BUCKET}`;
    }
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
  }, [totalExpensesMonthFilter, periodLabel, selectedExpenseCategoryFilters, kpiMode]);

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

  const currentSasuYear = selectedYears?.[0] ?? yearOptions[0] ?? new Date().getFullYear();
  const moveSasuYear = useCallback((delta: -1 | 1) => {
    setSelectedMonth(null);
    setSelectedYears([currentSasuYear + delta]);
  }, [currentSasuYear]);

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

  if (dashboardSection === "full") {
    return (
      <DashboardPremiumHero
        stats={currentHeroStats}
        statsReady={heroStatsReady}
        contextMessage={heroContextMessage}
        showContextBanner={showContextBanner}
      />
    );
  }

  return (
    <main id="dashboard-main" className="mt-6 scroll-mt-28 overflow-x-hidden sm:mt-8">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={dashboardSection}
          custom={slideDirRef.current}
          variants={DASHBOARD_SECTION_SLIDE_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className="space-y-6 sm:space-y-8"
        >
      {dashboardSection === "activite" ? (
        <BillableDaysCalendarBlock
          treasuryTransactions={transactions}
          treasuryScope="pro"
        />
      ) : null}
      {dashboardSection === "valeur" ? (
        <ValeurReelleClient
          initialTransactions={transactions}
          demoMode={demoMode}
          loadError={loadError}
        />
      ) : null}
      {dashboardSection === "categorisation" ? <DashboardCategorisationPanel /> : null}
      {(dashboardSection === "sasu" || dashboardSection === "private") && (
        <>
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
            <section className="space-y-4">
              <div className="rounded-[2rem] border border-cyan-100/[0.10] bg-[#0b3038]/78 p-4 text-white shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72)] backdrop-blur-2xl sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full border border-cyan-100/[0.10] bg-cyan-50/[0.06] text-white/82"
                    aria-label="Compte SASU"
                  >
                    <Receipt className="h-5 w-5" strokeWidth={1.9} aria-hidden />
                  </button>
                  <div className="min-w-0 text-center">
                    <p className="text-lg font-semibold tracking-tight">Analyse SASU</p>
                    <p className="mt-0.5 text-[11px] font-medium text-white/48">{periodLabel}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-100/[0.10] bg-cyan-50/[0.06] text-white/82">
                      <Search className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-100/[0.10] bg-cyan-50/[0.06] text-white/82">
                      <Settings className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl border border-cyan-100/[0.08] bg-cyan-50/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => moveSasuYear(-1)}
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-white/20 hover:text-white"
                      aria-label="Afficher l’année précédente"
                    >
                      ‹
                    </button>
                    <p className="text-sm font-bold">
                      {selectedMonth ? monthLabelFr(selectedMonth) : currentSasuYear}
                    </p>
                    <button
                      type="button"
                      onClick={() => moveSasuYear(1)}
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-white/20 hover:text-white"
                      aria-label="Afficher l’année suivante"
                    >
                      ›
                    </button>
                  </div>
                  <DashboardPeriodFilterSection
                    selectedYears={selectedYears}
                    setSelectedYears={setSelectedYears}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                    monthOptions={monthOptions}
                    yearOptions={yearOptions}
                    onToggleYear={toggleYearInFilter}
                    showRollingOption={false}
                    showActiveLabel={false}
                  />
                  <div className="mt-3 grid grid-cols-2 rounded-2xl border border-cyan-100/[0.08] bg-[#06242b]/40 p-1">
                    {[
                      { label: "Entrées", mode: "revenues" as const },
                      { label: "Sorties", mode: "expenses" as const }
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.label}
                        onClick={() => setSasuAnalysisMode(item.mode)}
                        className={clsx(
                          "rounded-xl px-2 py-2 text-center text-xs font-bold transition",
                          sasuAnalysisMode === item.mode
                            ? "bg-violet-500 text-white shadow-[0_8px_24px_-14px_rgba(139,92,246,0.9)]"
                            : "text-white/40"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-cyan-100/[0.10] bg-[#0b3038]/78 p-5 text-white shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72)] backdrop-blur-2xl">
                {(() => {
                  const currentSlices = sasuAnalysisMode === "revenues"
                    ? sasuRevenueDonutSlices
                    : sasuBreakdownMode === "simplified"
                      ? sasuSimplifiedExpenseSlices
                      : sasuExpenseDonutSlices;
                  const currentTotal = sasuAnalysisMode === "revenues"
                    ? totalRevenuesHt
                    : sasuBreakdownMode === "simplified"
                      ? sasuSimplifiedExpenseSlices.reduce((sum, slice) => sum + slice.total, 0)
                      : totalExpensesCard;
                  return (
                    <>
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-full border border-cyan-100/[0.16] text-white/60"
                    aria-label="Ajouter une catégorie"
                  >
                    <CirclePlus className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </button>
                </div>
                <div className="mb-4 overflow-hidden rounded-full border border-cyan-100/[0.10] bg-[#06242b]/70 p-1 shadow-inner">
                  <div className="flex h-5 overflow-hidden rounded-full">
                    {currentSlices.map((slice) => (
                      <span
                        key={`bar-${slice.name}`}
                        style={{ width: `${slice.pct}%`, backgroundColor: slice.color }}
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
                <div className="relative mx-auto h-56 w-56">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={sasuAnalysisMode === "revenues" ? "Répartition des revenus SASU" : "Répartition des dépenses SASU"}>
                    <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="13" />
                    {currentSlices.map((slice) => (
                      <circle
                        key={slice.name}
                        cx="60"
                        cy="60"
                        r="42"
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="13"
                        strokeDasharray={`${slice.dash} ${100 - slice.dash}`}
                        strokeDashoffset={slice.offset}
                        pathLength={100}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="font-display text-2xl font-bold tabular-nums" data-private>
                        {fmt.euro(currentTotal)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-white/56">
                        {sasuAnalysisMode === "revenues" ? "Revenus HT" : "Dépenses"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mb-3 mt-2 flex max-w-full flex-wrap justify-center gap-1.5">
                  {currentSlices.slice(0, 6).map((slice) => (
                    <span
                      key={`sasu-legend-${slice.name}`}
                      title={`${slice.name} · ${fmt.euro(slice.total)} · ${fmt.int(slice.pct)} %`}
                      className="inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border border-cyan-100/[0.10] bg-cyan-50/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/72 shadow-sm"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
                      <span className="truncate">{slice.name}</span>
                      <span className="shrink-0 text-white/45">· {fmt.euro(slice.total)} · {fmt.int(slice.pct)} %</span>
                    </span>
                  ))}
                </div>
                <div className="mx-auto mt-3 grid max-w-sm grid-cols-2 gap-2 rounded-2xl border border-cyan-100/[0.08] bg-[#06242b]/35 p-1">
                  <button
                    type="button"
                    onClick={() => setSasuBreakdownMode("categories")}
                    className={clsx(
                      "rounded-xl px-3 py-2 text-center text-xs font-bold transition",
                      sasuBreakdownMode === "categories" ? "bg-violet-500 text-white" : "text-white/35"
                    )}
                  >
                    {sasuAnalysisMode === "revenues" ? "Revenus" : "Catégories"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSasuBreakdownMode("simplified")}
                    className={clsx(
                      "rounded-xl px-3 py-2 text-center text-xs font-bold transition",
                      sasuBreakdownMode === "simplified" ? "bg-violet-500 text-white" : "text-white/35"
                    )}
                  >
                    Simplifié
                  </button>
                </div>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-[2rem] border border-cyan-100/[0.10] bg-[#0b3038]/78 p-4 text-white shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72)] backdrop-blur-2xl sm:p-5">
                <div className="space-y-1" data-private>
                  {(sasuAnalysisMode === "revenues"
                    ? sasuRevenueDonutSlices
                    : sasuBreakdownMode === "simplified"
                      ? sasuSimplifiedExpenseSlices
                      : sasuExpenseDonutSlices
                  ).length ? (
                    (sasuAnalysisMode === "revenues"
                      ? sasuRevenueDonutSlices
                      : sasuBreakdownMode === "simplified"
                        ? sasuSimplifiedExpenseSlices
                        : sasuExpenseDonutSlices
                    ).map(({ name, total }) => {
                      const baseTotal = sasuAnalysisMode === "revenues" ? totalRevenuesHt : totalExpensesCard;
                      const pct = baseTotal > 0 ? Math.round((total / baseTotal) * 100) : 0;
                      const color = expenseCategoryColor(name);
                      const CatIcon = categoryGlyph(name);
                      const simplified = sasuAnalysisMode === "expenses" && sasuBreakdownMode === "simplified";
                      const open = sasuAnalysisMode === "revenues" ? revenueCounterpartyDetail === name : expenseCategoryDetail === name;
                      const detailTransactions =
                        sasuAnalysisMode === "revenues" ? revenueTransactionsForCounterparty : expenseTransactionsForCategory;
                      const subcategories = simplified ? sasuSimplifiedSubcategories[name] ?? [] : [];
                      return (
                        <div key={name} className="border-b border-cyan-100/[0.08] py-3 last:border-0">
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
                              <span className="block truncate text-sm font-semibold text-white/88">{name}</span>
                              <span className="mt-0.5 block text-xs font-medium text-white/48">
                                {pct} % · {sasuAnalysisMode === "revenues" ? "revenu SASU" : simplified ? "synthèse" : "catégorie"}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-sm font-semibold tabular-nums text-white">{fmt.euro(total)}</span>
                              {!simplified ? <span className="text-white/28">›</span> : null}
                            </span>
                          </button>
                          {subcategories.length ? (
                            <div className="ml-[3.25rem] mt-2 space-y-1.5">
                              {subcategories.slice(0, 5).map((subcategory) => {
                                const subPct = total > 0 ? Math.round((subcategory.total / total) * 100) : 0;
                                return (
                                  <div
                                    key={`${name}-${subcategory.name}`}
                                    className="flex items-center justify-between gap-3 rounded-xl bg-cyan-50/[0.04] px-3 py-2 text-xs"
                                  >
                                    <span className="min-w-0 truncate text-white/62">
                                      {subcategory.name} · {subPct} %
                                    </span>
                                    <span className="shrink-0 font-semibold tabular-nums text-white/78">
                                      {fmt.euro(subcategory.total)}
                                    </span>
                                  </div>
                                );
                              })}
                              {subcategories.length > 5 ? (
                                <p className="px-3 text-[11px] font-medium text-white/38">
                                  + {subcategories.length - 5} autres sous-catégories
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {open ? (
                            <div className="mt-3 rounded-2xl border border-cyan-100/[0.08] bg-[#06242b]/40 p-3">
                              {detailTransactions.length ? (
                                <ul className="max-h-52 space-y-2 overflow-y-auto pr-1 text-xs">
                                  {detailTransactions.map((tx) => (
                                    <li key={tx.id} className="flex justify-between gap-3 border-b border-cyan-100/[0.06] pb-2 last:border-0 last:pb-0">
                                      <span className="min-w-0">
                                        <span className="block truncate text-white/78">{tx.label}</span>
                                        <span className="text-white/35">{tx.date}</span>
                                      </span>
                                      <span className="shrink-0 font-semibold tabular-nums text-white">
                                        {fmt.euro(sasuAnalysisMode === "revenues" ? tx.amount / (1 + VAT_RATE) : Math.abs(tx.amount))}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-white/45">
                                  {sasuAnalysisMode === "revenues" ? "Aucun revenu pour cette catégorie." : "Aucune opération pour cette catégorie."}
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-6 text-center text-sm text-white/45">
                      {sasuAnalysisMode === "revenues" ? "Aucun revenu sur cette période." : "Aucune dépense sur cette période."}
                    </p>
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
              </CardValue>
              <div className="mt-3 flex items-start gap-2.5 text-sm text-ink-500 dark:text-ink-400">
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
                ariaLabel={
                  kpiMode === "personal"
                    ? `Évolution des dépenses perso par mois (catégories Bankin, hors virements internes) — ${periodLabel}${totalExpensesMonthFilter ? ` — filtre ${monthLabelFr(totalExpensesMonthFilter)}` : ""}. Cliquer un mois sur le graphique active ou désactive le filtre sur ce mois.`
                    : `Évolution des dépenses par mois (hors BNC et TVA) — ${periodLabel}${totalExpensesMonthFilter ? ` — filtre ${monthLabelFr(totalExpensesMonthFilter)}` : ""}. Cliquer un mois sur le graphique active ou désactive le filtre sur ce mois.`
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
                        ? `Top ${TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES} catégories · ce mois`
                        : `Top ${TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES} catégories · total période et moy. / mois (période écoulée)`}
                    </p>
                    <p className="text-[10px] leading-snug text-ink-500 dark:text-ink-400">
                      Les {TOTAL_EXPENSES_CARD_TOP_DERIVED_CATEGORIES}{" "}
                      {kpiMode === "personal" ? "catégories Bankin les plus élevées" : "buckets les plus élevés"}{" "}
                      pour la vue en cours.
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
                                          {tx.bankName ? (
                                            <span className="mt-0.5 block truncate text-[10px] font-medium text-ink-500 dark:text-ink-400">
                                              Banque : {tx.bankName}
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="shrink-0 font-medium tabular-nums text-rose-800 dark:text-rose-300">
                                          {fmt.euro(Math.abs(tx.amount))}
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
          ) : null}

        </>
      )}

        </motion.div>
      </AnimatePresence>
    </main>
  );
}
