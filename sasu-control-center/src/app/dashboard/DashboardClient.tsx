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
  Receipt,
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
import {
  buildSasuExpenseDonutSlices,
  buildSasuRevenueDonutSlices,
  buildSasuSimplifiedExpenseSlices,
  buildSasuSimplifiedSubcategories,
  sasuSimplifiedExpenseGroup
} from "@/lib/sasu-analytics";

export type { DashboardTx };

type DashboardSection = "full" | "activite" | "valeur" | "sasu" | "private" | "categorisation";

const DASHBOARD_SECTION_SLIDE_VARIANTS = {
  initial: { opacity: 0, scale: 0.995, filter: "blur(2px)" },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const }
  },
  exit: {
    opacity: 0,
    scale: 0.998,
    filter: "blur(1px)",
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const }
  }
};

function DashboardSectionLoadingSkeleton({ section, dark }: { section: DashboardSection; dark: boolean }) {
  const rows = section === "full" ? 3 : section === "categorisation" ? 5 : 4;
  const pulseSoftClass = dark ? "bg-cyan-100/[0.18]" : "bg-ink-200/80";
  const pulseStrongClass = dark ? "bg-cyan-50/[0.24]" : "bg-ink-200/90";
  const pulseMutedClass = dark ? "bg-cyan-50/[0.13]" : "bg-ink-100";
  const panelClass = dark
    ? "border-cyan-100/[0.12] bg-cyan-50/[0.065] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
    : "border-ink-100/80 bg-white/60";
  return (
    <section
      className={clsx(
        "relative space-y-5 overflow-hidden rounded-[2rem] border p-4 backdrop-blur-xl sm:p-6",
        dark
          ? "border-cyan-100/[0.16] bg-[#08272f]/94 shadow-[0_28px_90px_-34px_rgba(0,22,28,0.95),inset_0_1px_0_rgba(255,255,255,0.10)]"
          : "border-ink-200/70 bg-white/70 shadow-[0_24px_80px_-34px_rgba(15,23,42,0.28)]"
      )}
      aria-label="Chargement de la section"
      aria-busy="true"
    >
      <div className={clsx("pointer-events-none absolute inset-x-8 -top-12 h-32 rounded-full blur-3xl", dark ? "bg-cyan-300/18" : "bg-cyan-300/8")} aria-hidden />
      <div className={clsx("pointer-events-none absolute -bottom-16 right-8 h-36 w-64 rounded-full blur-3xl", dark ? "bg-emerald-300/12" : "bg-emerald-300/8")} aria-hidden />

      <div className="relative flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={clsx("h-3 w-28 animate-pulse rounded-full", pulseSoftClass)} />
          <div className={clsx("h-7 w-52 animate-pulse rounded-full", pulseStrongClass)} />
        </div>
        <div className={clsx("hidden h-10 w-28 animate-pulse rounded-full sm:block", dark ? "bg-cyan-50/[0.16]" : "bg-ink-100")} />
      </div>

      <div className="relative grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={clsx("rounded-2xl border p-4", dark ? "border-cyan-100/[0.12] bg-cyan-50/[0.075] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]" : "border-ink-100/80 bg-white/65")}
          >
            <div className={clsx("mb-5 h-3 w-24 animate-pulse rounded-full", pulseSoftClass)} />
            <div className={clsx("h-8 w-32 animate-pulse rounded-full", pulseStrongClass)} />
          </div>
        ))}
      </div>

      <div className="relative grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={clsx("rounded-3xl border p-4", panelClass)}>
          <div className={clsx("mb-5 h-4 w-40 animate-pulse rounded-full", pulseSoftClass)} />
          <div className="space-y-3">
            {Array.from({ length: rows }).map((_, item) => (
              <div key={item} className="flex items-center gap-3">
                <div className={clsx("h-9 w-9 animate-pulse rounded-full", dark ? "bg-cyan-50/[0.20]" : "bg-ink-200/80")} />
                <div className={clsx("h-3 flex-1 animate-pulse rounded-full", pulseMutedClass)} />
                <div className={clsx("h-3 w-16 animate-pulse rounded-full", pulseSoftClass)} />
              </div>
            ))}
          </div>
        </div>
        <div className={clsx("rounded-3xl border p-4", panelClass)}>
          <div className={clsx("mx-auto mb-5 h-36 w-36 animate-pulse rounded-full", dark ? "bg-cyan-50/[0.14] ring-1 ring-cyan-100/[0.08]" : "bg-ink-100")} />
          <div className={clsx("mx-auto h-3 w-40 animate-pulse rounded-full", pulseSoftClass)} />
        </div>
      </div>
    </section>
  );
}

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
  const [isSectionLoading, setIsSectionLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  /** Ordre des pilules périmètre : gauche → droite (pour le sens du slide). */
  const sectionOrder: Record<DashboardSection, number> = {
    full: 0,
    activite: 1,
    valeur: 2,
    sasu: 3,
    private: 4,
    categorisation: 5
  };
  const prevSectionRef = useRef(dashboardSection);
  if (prevSectionRef.current !== dashboardSection) {
    void sectionOrder;
  }
  useLayoutEffect(() => {
    prevSectionRef.current = dashboardSection;
  }, [dashboardSection]);
  useEffect(() => {
    setIsSectionLoading(true);
    const loadingTimer = window.setTimeout(() => {
      setIsSectionLoading(false);
    }, 140);

    return () => window.clearTimeout(loadingTimer);
  }, [dashboardSection]);
  useEffect(() => {
    const root = document.documentElement;
    const syncDarkMode = () => setIsDarkMode(root.classList.contains("dark"));
    syncDarkMode();
    const observer = new MutationObserver(syncDarkMode);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
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
  const [showAllSasuCategoryRows, setShowAllSasuCategoryRows] = useState(false);
  const [expandedSasuSubcategoryGroups, setExpandedSasuSubcategoryGroups] = useState<Set<string>>(() => new Set());
  const [sasuMonthlyBreakdownMode, setSasuMonthlyBreakdownMode] = useState<"categories" | "simplified">("categories");
  const [sasuMonthlyCategoryFilters, setSasuMonthlyCategoryFilters] = useState<string[]>([]);
  /** Filtre global des dépenses (buckets dérivés) : vide = toutes les catégories. */
  const [selectedExpenseCategoryFilters, setSelectedExpenseCategoryFilters] = useState<string[]>([]);
  const shouldComputeSasuPanel = dashboardSection === "sasu" || dashboardSection === "private";

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
      .sort((a, b) => {
        if (a.name === "CESU" && b.name !== "CESU") return -1;
        if (b.name === "CESU" && a.name !== "CESU") return 1;
        return b.total - a.total;
      });
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
    if (!shouldComputeSasuPanel) return [];
    return buildSasuExpenseDonutSlices(expenseCategoryTotalsForTotalExpensesCard, totalExpensesCard);
  }, [expenseCategoryTotalsForTotalExpensesCard, shouldComputeSasuPanel, totalExpensesCard]);

  const sasuRevenueDonutSlices = useMemo(() => {
    if (!shouldComputeSasuPanel) return [];
    return buildSasuRevenueDonutSlices(revenueCounterpartyTotals, totalRevenuesHt, VAT_RATE);
  }, [revenueCounterpartyTotals, shouldComputeSasuPanel, totalRevenuesHt, VAT_RATE]);

  const sasuSimplifiedExpenseSlices = useMemo(() => {
    if (!shouldComputeSasuPanel) return [];
    return buildSasuSimplifiedExpenseSlices(filteredTx);
  }, [filteredTx, shouldComputeSasuPanel]);

  const sasuSimplifiedSubcategories = useMemo(() => {
    if (!shouldComputeSasuPanel) return {};
    return buildSasuSimplifiedSubcategories(filteredTx, kpiMode);
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
        sasuMonthlyBreakdownMode === "simplified"
          ? sasuSimplifiedExpenseGroup(tx)
          : expenseDashboardGroupingLabel(tx, kpiMode);
      if (!name) continue;
      const amount = Math.abs(tx.amount);
      totals.set(name, (totals.get(name) ?? 0) + amount);
      monthBucket.set(name, (monthBucket.get(name) ?? 0) + amount);
    }

    return { totals, monthly };
  }, [metrics, periodFilteredTx, kpiMode, sasuMonthlyBreakdownMode, shouldComputeSasuPanel]);

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
      sasuMonthlyBreakdownMode === "simplified"
        ? sasuMonthlyEvolutionOptions.map((item) => ({
            ...item,
            color: item.name === "Frais DigitPro" ? "#ff8733" : "#11c7cb"
          }))
        : buildSasuExpenseDonutSlices(sasuMonthlyEvolutionOptions, total);
    return new Map(slices.map((slice) => [slice.name, slice.color]));
  }, [sasuMonthlyBreakdownMode, sasuMonthlyEvolutionOptions]);

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

  const sasuMonthlyAverage = useMemo(() => {
    if (!sasuMonthlyEvolutionSeries.length) return 0;
    return sum(sasuMonthlyEvolutionSeries.map((month) => month.value)) / sasuMonthlyEvolutionSeries.length;
  }, [sasuMonthlyEvolutionSeries]);

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
  const moveSasuPeriod = useCallback((delta: -1 | 1) => {
    if (!selectedMonth) {
      moveSasuYear(delta);
      return;
    }
    const index = monthOptions.indexOf(selectedMonth);
    const nextMonth = index >= 0 ? monthOptions[index - delta] : null;
    if (!nextMonth) return;
    setSelectedMonth(nextMonth);
    setSelectedYears([Number(nextMonth.slice(0, 4))]);
  }, [monthOptions, moveSasuYear, selectedMonth]);

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
    <main id="dashboard-main" className="mt-6 scroll-mt-28 overflow-x-hidden sm:mt-8">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={dashboardSection}
          variants={DASHBOARD_SECTION_SLIDE_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className="space-y-6 will-change-transform sm:space-y-8"
          style={{ contain: "layout paint" }}
        >
      {isSectionLoading ? (
        <DashboardSectionLoadingSkeleton section={dashboardSection} dark={isDarkMode} />
      ) : (
        <>
      {dashboardSection === "full" ? (
        <DashboardPremiumHero
          stats={currentHeroStats}
          statsReady={heroStatsReady}
          contextMessage={heroContextMessage}
          showContextBanner={showContextBanner}
        />
      ) : null}
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
            <section className="flex flex-col gap-4">
              <div className="rounded-3xl border border-cyan-100/[0.12] bg-[#0b3038] p-3 text-white shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => moveSasuPeriod(-1)}
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-white/20 hover:text-white"
                      aria-label={selectedMonth ? "Afficher le mois précédent" : "Afficher l’année précédente"}
                    >
                      ‹
                    </button>
                    <p className="text-sm font-bold">
                      {selectedMonth ? monthLabelFr(selectedMonth) : currentSasuYear}
                    </p>
                    <button
                      type="button"
                      onClick={() => moveSasuPeriod(1)}
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-white/20 hover:text-white"
                      aria-label={selectedMonth ? "Afficher le mois suivant" : "Afficher l’année suivante"}
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
                  <div className="mt-3 grid grid-cols-2 rounded-2xl border border-cyan-100/[0.10] bg-white/[0.04] p-1">
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
                            ? "bg-[#4f7eea] text-white shadow-[0_8px_24px_-14px_rgba(79,126,234,0.9)]"
                            : "text-white/40"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
              </div>

              <div className="rounded-[2rem] border border-cyan-100/[0.12] bg-[#0b3038] p-5 text-white shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
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
                <div className="relative mb-4 overflow-hidden rounded-full border border-cyan-100/[0.10] bg-white/[0.04] p-1 shadow-inner">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/12 via-transparent to-white/5" aria-hidden />
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
                <div className="relative mx-auto flex h-64 w-64 max-w-full items-center justify-center">
                  <svg viewBox="0 0 200 200" className="block h-64 w-64 max-w-full" role="img" aria-label={sasuAnalysisMode === "revenues" ? "Répartition des revenus SASU" : "Répartition des dépenses SASU"}>
                    <defs>
                      <filter id="sasu-donut-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.18" />
                      </filter>
                    </defs>
                    <circle cx="100" cy="100" r="58" fill="none" stroke="#284556" strokeWidth="16" />
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
                      <p className="font-display text-xl font-bold tabular-nums" data-private>
                        {fmt.euro(currentTotal)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-white/56">
                        {sasuAnalysisMode === "revenues" ? "Revenus HT" : "Dépenses"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mx-auto mt-3 grid max-w-sm grid-cols-2 gap-2 rounded-2xl border border-cyan-100/[0.10] bg-white/[0.04] p-1">
                  <button
                    type="button"
                    onClick={() => setSasuBreakdownMode("categories")}
                    className={clsx(
                      "rounded-xl px-3 py-2 text-center text-xs font-bold transition",
                      sasuBreakdownMode === "categories" ? "bg-[#8332c2] text-white" : "text-white/45"
                    )}
                  >
                    {sasuAnalysisMode === "revenues" ? "Revenus" : "Catégories"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSasuBreakdownMode("simplified")}
                    className={clsx(
                      "rounded-xl px-3 py-2 text-center text-xs font-bold transition",
                      sasuBreakdownMode === "simplified" ? "bg-[#8332c2] text-white" : "text-white/45"
                    )}
                  >
                    Simplifié
                  </button>
                </div>
                    </>
                  );
                })()}
              </div>

              <div className="order-last rounded-[2rem] border border-cyan-100/[0.12] bg-[#0b3038] p-4 text-white shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/42">
                      Évolution mensuelle
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold tracking-tight text-white">
                      Dépenses par mois
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-white/42">
                      {periodLabel} · {sasuMonthlyCategoryFilters.length || "toutes"} catégorie
                      {sasuMonthlyCategoryFilters.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-100/[0.10] bg-white/[0.04] px-3 py-2 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">Moy. / mois</p>
                    <p className="mt-0.5 font-display text-base font-bold tabular-nums text-white" data-private>
                      {fmt.euro(sasuMonthlyAverage)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 rounded-2xl border border-cyan-100/[0.10] bg-white/[0.04] p-1">
                    {[
                      { label: "Catégories", mode: "categories" as const },
                      { label: "Simplifié", mode: "simplified" as const }
                    ].map((item) => (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => {
                          setSasuMonthlyBreakdownMode(item.mode);
                          setSasuMonthlyCategoryFilters([]);
                        }}
                        className={clsx(
                          "rounded-xl px-3 py-2 text-xs font-bold transition",
                          sasuMonthlyBreakdownMode === item.mode ? "bg-[#8332c2] text-white" : "text-white/45"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sasuMonthlyEvolutionOptions.length ? (
                  <div className="relative mt-3 overflow-hidden rounded-2xl border border-cyan-100/[0.10] bg-white/[0.04] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-[1] w-10 bg-gradient-to-l from-[#0b3038] to-transparent" aria-hidden />
                    <div className="flex gap-2 overflow-x-auto pb-0.5 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {sasuMonthlyCategoryFilters.length ? (
                      <button
                        type="button"
                        onClick={() => setSasuMonthlyCategoryFilters([])}
                        className="shrink-0 rounded-full border border-white/12 bg-white/[0.08] px-3 py-2 text-[11px] font-bold text-white/82 transition hover:bg-white/[0.12] hover:text-white"
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
                          className={clsx(
                            "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold leading-none shadow-sm transition",
                            active
                              ? "border-white/24 bg-white/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                              : "border-white/[0.08] bg-white/[0.055] text-white/70 hover:border-white/16 hover:bg-white/[0.09] hover:text-white"
                          )}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_currentColor]"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          <span className="max-w-[11rem] truncate">{item.name}</span>
                          <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-white/68">{fmt.euro(item.total)}</span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4" data-private>
                  <div className="relative h-60 overflow-hidden rounded-3xl border border-cyan-100/[0.18] bg-[#0d2b38] px-4 pb-5 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_54px_-34px_rgba(103,232,249,0.75)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,126,234,0.24),transparent_45%)]" />
                    <div className="pointer-events-none absolute inset-4 rounded-2xl bg-[linear-gradient(rgba(255,255,255,0.095)_1px,transparent_1px)] bg-[size:100%_25%]" />
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
                              stroke="rgba(207,250,254,0.18)"
                              strokeDasharray="4 5"
                            />
                            <text
                              x="0"
                              y={y + 3}
                              fill="rgba(236,254,255,0.86)"
                              style={{ fontSize: 7.5, fontWeight: 800 }}
                            >
                              {compactEuroAxis(value)}
                            </text>
                          </g>
                        );
                      })}
                      <line x1="30" x2="312" y1="136" y2="136" stroke="rgba(207,250,254,0.38)" strokeWidth="1.2" />
                      <line x1="30" x2="30" y1="14" y2="136" stroke="rgba(207,250,254,0.38)" strokeWidth="1.2" />
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
                                fill={point.value > 0 ? color : "#39586a"}
                                stroke="#172d3a"
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
                              stroke="rgba(207,250,254,0.34)"
                              strokeWidth="1"
                            />
                            <text
                              x={x}
                              y="151"
                              textAnchor="middle"
                              fill="rgba(236,254,255,0.88)"
                              style={{ fontSize: 7.5, fontWeight: 800 }}
                            >
                              {monthPart.replace(".", "")}
                            </text>
                            {index === 0 || monthPart.toLowerCase().startsWith("janv") ? (
                              <text
                                x={x}
                                y="162"
                                textAnchor="middle"
                              fill="rgba(236,254,255,0.58)"
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
              </div>

              <div className="rounded-[2rem] border border-cyan-100/[0.12] bg-[#0b3038] p-4 text-white shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-5">
                <div className="space-y-1" data-private>
                  {(sasuAnalysisMode === "revenues"
                    ? sasuRevenueDonutSlices
                    : sasuBreakdownMode === "simplified"
                      ? sasuSimplifiedExpenseSlices
                      : sasuExpenseDonutSlices
                  ).length ? (
                    (() => {
                      const rows =
                        sasuAnalysisMode === "revenues"
                          ? sasuRevenueDonutSlices
                          : sasuBreakdownMode === "simplified"
                            ? sasuSimplifiedExpenseSlices
                            : sasuExpenseDonutSlices;
                      const visibleRows = showAllSasuCategoryRows ? rows : rows.slice(0, 5);
                      const remainingRows = Math.max(0, rows.length - visibleRows.length);
                      return (
                        <>
                    {visibleRows.map(({ name, total, color }) => {
                      const baseTotal = sasuAnalysisMode === "revenues" ? totalRevenuesHt : totalExpensesCard;
                      const pct = baseTotal > 0 ? Math.round((total / baseTotal) * 100) : 0;
                      const CatIcon = categoryGlyph(name);
                      const simplified = sasuAnalysisMode === "expenses" && sasuBreakdownMode === "simplified";
                      const open = sasuAnalysisMode === "revenues" ? revenueCounterpartyDetail === name : expenseCategoryDetail === name;
                      const currentCategoryTransactions = filteredTx.filter((tx) => {
                        if (sasuAnalysisMode === "revenues") {
                          return isRevenueCategory(tx.category) && tx.amount > 0 && revenueCounterpartyDisplayName(tx) === name;
                        }
                        if (simplified) {
                          return tx.amount < 0;
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
                                {pct} % · {currentCategoryTransactions.length} transaction{currentCategoryTransactions.length > 1 ? "s" : ""}
                                {sasuAnalysisMode === "revenues" && billableRevenue
                                  ? ` · ${formatDaysCount.format(billedDaysForRevenue)} j facturés`
                                  : null}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-sm font-semibold tabular-nums text-white">{fmt.euro(total)}</span>
                              {!simplified ? <span className="text-white/28">›</span> : null}
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
                                className="w-full rounded-xl border border-[#39586a]/60 bg-[#102634]/70 px-3 py-2 text-left text-[11px] font-bold text-white/62 transition hover:bg-[#203d4f] hover:text-white"
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
                                        className="flex items-center justify-between gap-3 rounded-xl bg-[#102634]/80 px-3 py-2 text-xs"
                                      >
                                        <span className="min-w-0 truncate text-white/70">
                                          {subcategory.name} · {subPct} %
                                        </span>
                                        <span className="shrink-0 font-semibold tabular-nums text-white/86">
                                          {fmt.euro(subcategory.total)}
                                        </span>
                                      </div>
                                    );
                                  })
                                : null}
                            </div>
                          ) : null}
                          {open ? (
                            <div className="ml-[3.25rem] mt-2 rounded-2xl border border-cyan-100/[0.10] bg-cyan-50/[0.04] p-3">
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
                                        className="flex items-start justify-between gap-3 border-b border-cyan-100/[0.06] pb-2 text-xs last:border-0 last:pb-0"
                                      >
                                        <span className="min-w-0">
                                          <span className="block font-mono text-[10px] text-white/36">{tx.date}</span>
                                          <span className="block truncate text-white/76">{tx.label}</span>
                                          {sasuAnalysisMode === "revenues" && billableRevenue ? (
                                            <span className="mt-0.5 block text-[10px] font-medium text-white/42">
                                              {formatDaysCount.format(txBilledDays)} j facturés · TJM {fmt.euro(txTjmHt)} HT
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="shrink-0 font-semibold tabular-nums text-white">
                                          {fmt.euro(Math.abs(tx.amount))}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-white/42">Aucune opération disponible.</p>
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
                        className="mt-2 w-full rounded-2xl border border-cyan-100/[0.10] bg-cyan-50/[0.05] px-4 py-3 text-sm font-bold text-white/68 transition hover:bg-cyan-50/[0.09] hover:text-white"
                      >
                        {showAllSasuCategoryRows ? "Replier les catégories" : `Afficher ${remainingRows} autres catégories`}
                      </button>
                    ) : null}
                    </>
                      );
                    })()
                  ) : (
                    <p className="py-10 text-center text-sm font-medium text-white/42">Aucune donnée sur cette période.</p>
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
        </>
      )}

        </motion.div>
      </AnimatePresence>
    </main>
  );
}
