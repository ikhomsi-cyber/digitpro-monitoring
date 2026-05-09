"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  CalendarRange,
  FileSpreadsheet,
  LineChart,
  List,
  Scale,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet
} from "lucide-react";
import { MonthlyAreaChart } from "@/components/charts/MonthlyAreaChart";
import { MonthlyStackedExpenseChart } from "@/components/charts/MonthlyStackedExpenseChart";
import type { StackedExpenseChartRow } from "@/components/charts/MonthlyStackedExpenseChartClient";
import { Card, CardBody, CardHeader, CardTitle, CardValue } from "@/components/ui/Card";
import { Chatbot } from "@/components/Chatbot";
import { formatEur, formatSignedEur } from "@/lib/format";
import { isRevenueCategory } from "@/lib/revenue-category";
import { isPrimaryBankCompany, PRIMARY_BANK_LABEL } from "@/lib/bank";
import type { MonthlyPoint } from "@/lib/mock-data";
import {
  computeDashboardMonthlyMetrics,
  computeExpenseCategoryMonthlyBreakdown,
  expenseCategoryColor,
  filterDashboardTransactions,
  importedRowsToTransactions,
  mergeImportedWithTransactions,
  type DashboardTx,
  type MonthlyFinanceMetric
} from "@/lib/dashboard-metrics";
import {
  parseBankCsv,
  type CsvImportFormat,
  type NormalizedImportRow
} from "@/lib/csv-import";
import {
  importTransactions as importTransactionsAction,
  deleteTransaction as deleteTransactionAction,
  createTransaction as createTransactionAction,
  deduplicateExistingTransactions as deduplicateExistingTransactionsAction,
  tagExistingTransactionsAsQonto as tagExistingTransactionsAsQontoAction
} from "./actions";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

export type { DashboardTx };

function DashboardBlockTitle({
  icon: Icon,
  children,
  titleClassName
}: {
  icon: LucideIcon;
  children: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm"
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

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1));
}

function formatDateFr(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parseIsoDate(iso));
}

function monthLabelFr(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(d);
}

function asMonthlyPoints(metrics: MonthlyFinanceMetric[], key: "revenue" | "expenses"): MonthlyPoint[] {
  return metrics.map((m) => ({
    month: monthLabelFr(m.month),
    value: Math.round(m[key]),
    monthKey: m.month
  }));
}

const SUCCESS_MESSAGE = "Transactions imported successfully";
const PREVIEW_ROW_LIMIT = 15;
const RECENT_TX_LIMIT = 10;

type ImportPreviewState = {
  rows: NormalizedImportRow[];
  format: CsvImportFormat;
  fileName: string;
  fileHash: string | null;
  warnings: string[];
};

export function DashboardClient({
  runtimeMode,
  preferencesDemoActive,
  canWrite,
  syncKey,
  initialTransactions
}: {
  runtimeMode: SupabaseRuntimeMode;
  /** True when Supabase env exists but user opted into demo via dashboard toggle */
  preferencesDemoActive?: boolean;
  canWrite: boolean;
  syncKey: string;
  initialTransactions: DashboardTx[];
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<DashboardTx[]>(initialTransactions);
  /** null = fenêtre glissante 12 mois */
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  /** Catégories masquées dans le graphique empilé des dépenses (la légende permet de les réactiver). */
  const [hiddenExpenseCategories, setHiddenExpenseCategories] = useState<Set<string>>(() => new Set());
  /** Drill-down mois (YYYY-MM) pour la liste des transactions sous les graphiques. */
  const [drillMonthKey, setDrillMonthKey] = useState<string | null>(null);

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [syncKey, initialTransactions]);

  useEffect(() => {
    setDrillMonthKey(null);
  }, [yearFilter]);

  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [isPending, startTransition] = useTransition();

  const analyticsFilter = useMemo(() => ({ year: yearFilter }), [yearFilter]);

  const filteredTx = useMemo(
    () => filterDashboardTransactions(transactions, analyticsFilter),
    [transactions, analyticsFilter]
  );

  const metrics = useMemo(
    () => computeDashboardMonthlyMetrics(filteredTx, { yearMode: yearFilter }),
    [filteredTx, yearFilter]
  );

  const monthlyRevenue = useMemo(() => asMonthlyPoints(metrics, "revenue"), [metrics]);
  const monthlyExpenses = useMemo(() => asMonthlyPoints(metrics, "expenses"), [metrics]);

  const expenseCategoryBreakdown = useMemo(
    () => computeExpenseCategoryMonthlyBreakdown(filteredTx, { yearMode: yearFilter }),
    [filteredTx, yearFilter]
  );

  const visibleExpenseCategories = useMemo(
    () => expenseCategoryBreakdown.categories.filter((c) => !hiddenExpenseCategories.has(c)),
    [expenseCategoryBreakdown.categories, hiddenExpenseCategories]
  );

  const stackedExpenseChartData = useMemo(() => {
    const rows: StackedExpenseChartRow[] = expenseCategoryBreakdown.rows.map((r) => {
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
  }, [expenseCategoryBreakdown.rows, visibleExpenseCategories]);

  const totalRevenue = useMemo(() => sum(metrics.map((m) => m.revenue)), [metrics]);
  const totalExpenses = useMemo(() => sum(metrics.map((m) => m.expenses)), [metrics]);

  /**
   * Solde Qonto le plus récent — on cherche la transaction la plus récente
   * dont le compte = Qonto ET qui a un solde renseigné, et on reprend la
   * valeur de la colonne "Solde". Si aucune tx Qonto n'est trouvée (ex.
   * import historique sans tag Qonto), on retombe sur n'importe quelle
   * tx avec solde — l'UI précisera l'origine.
   */
  const { latestBalanceTx, latestBalanceFromQonto } = useMemo(() => {
    const withBalance = [...transactions]
      .filter((t) => t.balance != null && Number.isFinite(t.balance as number))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (!withBalance.length) {
      return { latestBalanceTx: null, latestBalanceFromQonto: false };
    }
    const fromQonto = withBalance.find((t) => isPrimaryBankCompany(t.company));
    if (fromQonto) {
      return { latestBalanceTx: fromQonto, latestBalanceFromQonto: true };
    }
    return { latestBalanceTx: withBalance[0], latestBalanceFromQonto: false };
  }, [transactions]);
  const cashAvailable = latestBalanceTx?.balance ?? null;

  const recentTx = useMemo(() => {
    const source =
      drillMonthKey != null
        ? filteredTx.filter((t) => t.date.slice(0, 7) === drillMonthKey)
        : filteredTx;
    const limit = drillMonthKey != null ? 500 : RECENT_TX_LIMIT;
    return [...source]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, limit);
  }, [filteredTx, drillMonthKey]);

  const revenueTx = useMemo(
    () =>
      filteredTx
        .filter((tx) => isRevenueCategory(tx.category))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [filteredTx]
  );
  const revenueTxRecent = useMemo(() => revenueTx.slice(0, RECENT_TX_LIMIT), [revenueTx]);
  const revenueTotal = useMemo(() => sum(revenueTx.map((t) => t.amount)), [revenueTx]);
  const VAT_RATE = 0.2;
  const TJM_HT = 820;
  const revenueTotalHt = useMemo(() => revenueTotal / (1 + VAT_RATE), [revenueTotal]);
  const revenueTotalDays = useMemo(() => revenueTotalHt / TJM_HT, [revenueTotalHt]);
  const netProfit = revenueTotalHt - totalExpenses;

  function formatDays(d: number) {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    }).format(d);
  }

  const periodLabel =
    yearFilter != null ? `Année ${yearFilter}` : "12 derniers mois (fenêtre glissante)";

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    for (const t of transactions) {
      const y = Number(t.date.slice(0, 4));
      if (Number.isFinite(y)) ys.add(y);
    }
    return Array.from(ys).sort((a, b) => b - a);
  }, [transactions]);

  function applyImportedRows(
    txToImport: NormalizedImportRow[],
    importMeta?: { sourceFilename: string; format: CsvImportFormat; fileHash: string | null }
  ) {
    const toastId = toast.loading("Import en cours…", {
      description: importMeta?.sourceFilename ?? `${txToImport.length} ligne(s)`
    });
    startTransition(async () => {
      try {
        if (runtimeMode === "DEMO") {
          setTransactions((prev) => {
            const imported = importedRowsToTransactions(txToImport);
            return mergeImportedWithTransactions(prev, imported);
          });
          toast.success(SUCCESS_MESSAGE, {
            id: toastId,
            description: `${txToImport.length} ligne(s) traitée(s) · mode démo`
          });
          return;
        }

        const result = await importTransactionsAction(txToImport, {
          sourceFilename: importMeta?.sourceFilename ?? null,
          format: importMeta?.format ?? "generic",
          fileHash: importMeta?.fileHash ?? null
        });

        router.refresh();

        if (result.fileAlreadyImported) {
          toast.warning("Fichier déjà importé", {
            id: toastId,
            description: "Import ignoré pour éviter les doublons."
          });
          return;
        }

        const parts: string[] = [];
        if (result.inserted.length) parts.push(`${result.inserted.length} nouvelle(s)`);
        if (result.merged) parts.push(`${result.merged} mise(s) à jour`);
        if (result.skippedInFile) parts.push(`${result.skippedInFile} doublon(s) ignoré(s)`);
        toast.success(SUCCESS_MESSAGE, {
          id: toastId,
          description: parts.length ? parts.join(" · ") : undefined
        });
      } catch (e) {
        toast.error("Échec de l’import", {
          id: toastId,
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  async function sha256Hex(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function onImportFile(file: File) {
    setImportPreview(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Format invalide", {
        description: "Veuillez fournir un fichier .csv."
      });
      return;
    }

    const rawText = await file.text();
    const fileHash = typeof crypto?.subtle !== "undefined" ? await sha256Hex(rawText) : null;
    const parsed = parseBankCsv(rawText);

    if (!parsed.ok) {
      toast.error("Lecture du CSV impossible", { description: parsed.error });
      return;
    }

    setImportPreview({
      rows: parsed.rows,
      format: parsed.format,
      fileName: file.name,
      fileHash,
      warnings: parsed.warnings
    });
  }

  function confirmImportPreview() {
    if (!importPreview?.rows.length) return;
    const rows = importPreview.rows;
    const meta = {
      sourceFilename: importPreview.fileName,
      format: importPreview.format,
      fileHash: importPreview.fileHash
    };
    setImportPreview(null);
    applyImportedRows(rows, meta);
  }

  function cancelImportPreview() {
    setImportPreview(null);
  }

  function onClickDeduplicate() {
    if (runtimeMode === "DEMO") {
      toast.warning("Indisponible en mode démo", {
        description: "Aucune base n’est connectée."
      });
      return;
    }

    const ok = window.confirm(
      "Cette opération recalcule l’empreinte (date + libellé + montant) sur toutes vos transactions, supprime les doublons existants et conserve la version la plus ancienne. Continuer ?"
    );
    if (!ok) return;

    const toastId = toast.loading("Déduplication en cours…");
    startTransition(async () => {
      try {
        const result = await deduplicateExistingTransactionsAction();
        router.refresh();
        const parts: string[] = [];
        parts.push(`${result.scanned} ligne(s) scannées`);
        parts.push(`${result.duplicatesRemoved} doublon(s) supprimé(s)`);
        if (result.hashesUpdated)
          parts.push(`${result.hashesUpdated} empreinte(s) mises à jour`);
        toast.success("Déduplication terminée", {
          id: toastId,
          description: parts.join(" · ")
        });
      } catch (e) {
        toast.error("Déduplication échouée", {
          id: toastId,
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  function onClickTagQonto() {
    if (!canWrite) {
      toast.warning("Action désactivée", {
        description: "Aucune base n’est connectée."
      });
      return;
    }

    const toastId = toast.loading("Tag Qonto des transactions historiques…");
    startTransition(async () => {
      try {
        const result = await tagExistingTransactionsAsQontoAction();
        router.refresh();
        if (result.scanned === 0) {
          toast.warning("Colonne « balance » absente", {
            id: toastId,
            description:
              "Appliquez d’abord la migration Supabase (alter table transactions add column balance numeric) puis ré-importez votre CSV Qonto."
          });
          return;
        }
        if (result.updated === 0) {
          toast.success("Aucun tag à ajouter", {
            id: toastId,
            description: `${result.scanned} ligne(s) déjà à jour.`
          });
          return;
        }
        toast.success("Transactions taggées Qonto", {
          id: toastId,
          description: `${result.updated} ligne(s) mises à jour sur ${result.scanned} scannées.`
        });
      } catch (e) {
        toast.error("Tag Qonto échoué", {
          id: toastId,
          description: e instanceof Error ? e.message : undefined
        });
      }
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
                aria-pressed={yearFilter === null}
                onClick={() => setYearFilter(null)}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                  yearFilter === null
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-600 hover:text-ink-900"
                )}
              >
                12 mois glissants
              </button>
              <button
                type="button"
                aria-pressed={yearFilter !== null}
                onClick={() =>
                  setYearFilter((prev) => prev ?? yearOptions[0] ?? new Date().getFullYear())
                }
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                  yearFilter !== null
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-600 hover:text-ink-900"
                )}
              >
                Année civile
              </button>
            </div>
            {yearFilter !== null ? (
              <select
                value={String(yearFilter)}
                onChange={(e) => setYearFilter(Number(e.target.value))}
                className="rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                aria-label="Choisir l’année civile"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-ink-500 lg:text-right">
            Vue active : <span className="font-medium text-ink-700">{periodLabel}</span>.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="solid">
          <CardHeader className="pb-3">
            <DashboardBlockTitle icon={TrendingUp}>Total revenue</DashboardBlockTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <CardValue>
              <span data-private>{formatEur(revenueTotalHt)}</span>
              <span className="ml-2 align-middle text-xs font-medium text-ink-500">HT</span>
            </CardValue>
            <div className="mt-2 text-sm text-ink-500">
              Catégorie « Chiffre d’affaires » · TVA 20% déduite
            </div>
            <div className="text-xs text-ink-500">
              <span data-private>{formatEur(revenueTotal)}</span> TTC · {periodLabel}
            </div>
          </CardBody>
        </Card>
        <Card variant="solid">
          <CardHeader className="pb-3">
            <DashboardBlockTitle icon={TrendingDown}>Total expenses</DashboardBlockTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <CardValue>
              <span data-private>{formatEur(totalExpenses)}</span>
            </CardValue>
            <div className="mt-2 text-sm text-ink-500">Sorties de la période</div>
            <div className="text-xs text-ink-500">{periodLabel}</div>
          </CardBody>
        </Card>
        <Card variant="solid">
          <CardHeader className="pb-3">
            <DashboardBlockTitle icon={Scale}>Net profit</DashboardBlockTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <CardValue className={netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}>
              <span data-private>{formatEur(netProfit)}</span>
              <span className="ml-2 align-middle text-xs font-medium text-ink-500">HT</span>
            </CardValue>
            <div className="mt-2 text-sm text-ink-500">CA HT − dépenses</div>
            <div className="text-xs text-ink-500">{periodLabel}</div>
          </CardBody>
        </Card>
        <Card variant="solid">
          <CardHeader className="pb-3">
            <DashboardBlockTitle icon={Wallet}>Cash available</DashboardBlockTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <CardValue>
              <span data-private>
                {cashAvailable == null ? "—" : formatEur(cashAvailable)}
              </span>
            </CardValue>
            <div className="mt-2 text-sm text-ink-500">
              {latestBalanceTx
                ? latestBalanceFromQonto
                  ? `${PRIMARY_BANK_LABEL} · solde après « ${latestBalanceTx.label} »`
                  : `Solde après « ${latestBalanceTx.label} »`
                : "Aucun solde importé"}
            </div>
            <div className="text-xs text-ink-500">
              {latestBalanceTx
                ? latestBalanceFromQonto
                  ? `au ${formatDateFr(latestBalanceTx.date)}`
                  : `au ${formatDateFr(latestBalanceTx.date)} (compte « ${latestBalanceTx.company || "—"} »)`
                : "Importez un CSV Qonto avec colonne « Solde »"}
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="items-start">
            <div>
              <DashboardBlockTitle icon={LineChart}>Monthly revenue</DashboardBlockTitle>
              <CardValue>
                <span data-private>
                  {formatEur(metrics.length ? totalRevenue / metrics.length : 0)}
                </span>
              </CardValue>
              <div className="mt-1 text-xs text-slate-500">Moyenne mensuelle · {periodLabel}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
              {metrics.length || 0} mois
            </div>
          </CardHeader>
          <CardBody>
            <div data-private>
              <MonthlyAreaChart
                data={monthlyRevenue}
                color={{ stroke: "#0f172a", fill: "#0f172a" }}
                onMonthClick={(mk) => setDrillMonthKey(mk)}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="items-start">
            <div>
              <DashboardBlockTitle icon={BarChart3}>Monthly expenses</DashboardBlockTitle>
              <CardValue>
                <span data-private>
                  {formatEur(metrics.length ? totalExpenses / metrics.length : 0)}
                </span>
              </CardValue>
              <div className="mt-1 text-xs text-slate-500">Moyenne mensuelle · {periodLabel}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
              {metrics.length || 0} mois
            </div>
          </CardHeader>
          <CardBody>
            <div data-private className="space-y-4">
              {expenseCategoryBreakdown.categories.length === 0 ? (
                <MonthlyAreaChart
                  data={monthlyExpenses}
                  color={{ stroke: "#ef4444", fill: "#ef4444" }}
                  onMonthClick={(mk) => setDrillMonthKey(mk)}
                />
              ) : (
                <>
                  <MonthlyStackedExpenseChart
                    data={stackedExpenseChartData}
                    visibleCategories={visibleExpenseCategories}
                    onMonthClick={(mk) => setDrillMonthKey(mk)}
                  />
                  <div className="border-t border-ink-200 pt-4">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                      Catégories — cliquer pour afficher ou masquer
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {expenseCategoryBreakdown.categories.map((cat) => {
                        const visible = !hiddenExpenseCategories.has(cat);
                        const color = expenseCategoryColor(cat);
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
                              visible ? "border-ink-300 opacity-100" : "border-ink-200 opacity-45 saturate-50"
                            }`}
                            aria-pressed={visible}
                            aria-label={
                              visible
                                ? `Masquer la catégorie ${cat} du graphique`
                                : `Afficher la catégorie ${cat} dans le graphique`
                            }
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full ring-1 ring-ink-200/80"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />
                            <span className="truncate">{cat}</span>
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
      </section>

      <section>
        <Card>
          <CardHeader className="items-start">
            <div>
              <DashboardBlockTitle icon={Briefcase}>Chiffre d’affaires</DashboardBlockTitle>
              <CardValue className="text-emerald-700">
                <span data-private>{formatEur(revenueTotal)}</span>
              </CardValue>
              <div className="mt-1 text-xs text-slate-500">
                TTC · HT (TVA 20%){" "}
                <span className="font-medium text-slate-700" data-private>
                  {formatEur(revenueTotalHt)}
                </span>{" "}
                · Jours facturés{" "}
                <span className="font-medium text-slate-700" data-private>
                  {formatDays(revenueTotalDays)} j (TJM 820 HT)
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Catégorie de trésorerie « Chiffre d’affaires » · {periodLabel}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
              {revenueTxRecent.length} affichée{revenueTxRecent.length !== 1 ? "s" : ""} · {revenueTx.length} sur la période
            </div>
          </CardHeader>
          <CardBody>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
                <div className="col-span-2">Date</div>
                <div className="col-span-4">Contrepartie</div>
                <div className="col-span-2 text-right">TTC</div>
                <div className="col-span-2 text-right">HT (TVA 20%)</div>
                <div className="col-span-2 text-right">Jours (TJM 820 HT)</div>
              </div>
              <div className="divide-y divide-slate-200 bg-white">
                {revenueTxRecent.map((tx) => {
                  const ht = tx.amount / (1 + VAT_RATE);
                  const days = ht / TJM_HT;
                  return (
                    <div
                      key={`rev-${tx.id}`}
                      className="grid grid-cols-12 items-center gap-2 px-4 py-3 hover:bg-slate-50/70"
                    >
                      <div className="col-span-2 text-sm text-slate-600">{formatDateFr(tx.date)}</div>
                      <div
                        className="col-span-4 text-sm font-medium text-slate-900"
                        data-private
                      >
                        {tx.label}
                        {(tx.company ?? "").trim() ? (
                          <div className="mt-0.5 text-xs font-normal text-slate-500">
                            {(tx.company ?? "").trim()}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="col-span-2 text-right text-sm font-semibold text-emerald-700"
                        data-private
                      >
                        {formatSignedEur(tx.amount)}
                      </div>
                      <div
                        className="col-span-2 text-right text-sm font-medium text-slate-700"
                        data-private
                      >
                        {formatSignedEur(ht)}
                      </div>
                      <div
                        className="col-span-2 text-right text-sm font-medium text-slate-700"
                        data-private
                      >
                        {formatDays(days)} j
                      </div>
                    </div>
                  );
                })}
                {!revenueTxRecent.length ? (
                  <div className="px-4 py-6 text-sm text-slate-600">
                    Aucune transaction « Chiffre d’affaires » pour cette période.
                  </div>
                ) : null}
              </div>
              {revenueTx.length ? (
                <div className="grid grid-cols-12 items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700">
                  <div className="col-span-6">Total (période)</div>
                  <div
                    className="col-span-2 text-right text-sm font-semibold text-emerald-700"
                    data-private
                  >
                    {formatEur(revenueTotal)}
                  </div>
                  <div
                    className="col-span-2 text-right text-sm font-semibold text-slate-900"
                    data-private
                  >
                    {formatEur(revenueTotalHt)}
                  </div>
                  <div
                    className="col-span-2 text-right text-sm font-semibold text-slate-900"
                    data-private
                  >
                    {formatDays(revenueTotalDays)} j
                  </div>
                </div>
              ) : null}
            </div>
            {revenueTx.length > revenueTxRecent.length ? (
              <div className="mt-2 text-xs text-slate-500">
                {revenueTxRecent.length} transactions les plus récentes affichées · {revenueTx.length - revenueTxRecent.length} de plus sur la période (les totaux restent calculés sur l’ensemble).
              </div>
            ) : null}
          </CardBody>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <DashboardBlockTitle icon={List}>
                {drillMonthKey
                  ? `Transactions — ${monthLabelFr(`${drillMonthKey}-01`)}`
                  : "Transactions récentes"}
              </DashboardBlockTitle>
              <CardValue className="text-slate-900">
                {recentTx.length} affichée{recentTx.length !== 1 ? "s" : ""}
                <span className="text-xs font-normal text-slate-500">
                  {" "}
                  {drillMonthKey ? (
                    <>
                      · mois {drillMonthKey} (
                      {filteredTx.filter((t) => t.date.slice(0, 7) === drillMonthKey).length} sur ce mois,
                      vue période {filteredTx.length})
                    </>
                  ) : (
                    <>
                      · {filteredTx.length} sur la période · {transactions.length} au total
                    </>
                  )}
                </span>
              </CardValue>
            </div>
            {drillMonthKey ? (
              <button
                type="button"
                onClick={() => setDrillMonthKey(null)}
                className="btn-secondary shrink-0 text-sm"
              >
                Effacer le filtre mois
              </button>
            ) : null}
          </CardHeader>
          <CardBody>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
                <div className="col-span-3 sm:col-span-2">Date</div>
                <div className="col-span-5 sm:col-span-4">Label</div>
                <div className="hidden sm:col-span-3 sm:block">Société</div>
                <div className="hidden sm:col-span-1 sm:block">Cat.</div>
                <div className="col-span-4 sm:col-span-2 text-right">Montant</div>
              </div>
              <div className="divide-y divide-slate-200 bg-white">
                {recentTx.map((tx) => {
                  const tone = tx.amount >= 0 ? "text-emerald-700" : "text-slate-900";
                  const co = (tx.company ?? "").trim();
                  return (
                    <div key={tx.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 hover:bg-slate-50/70">
                      <div className="col-span-3 sm:col-span-2 text-sm text-slate-600">
                        {formatDateFr(tx.date)}
                      </div>
                      <div className="col-span-5 sm:col-span-4 text-sm font-medium text-slate-900">
                        <span data-private>{tx.label}</span>
                        <div className="mt-0.5 text-xs font-normal text-slate-500 sm:hidden">
                          <span data-private>{co || "—"}</span> · {tx.category}
                        </div>
                      </div>
                      <div
                        className="hidden text-sm text-slate-600 sm:col-span-3 sm:block"
                        data-private
                      >
                        {co || "—"}
                      </div>
                      <div className="hidden truncate text-sm text-slate-600 sm:col-span-1 sm:block">
                        {tx.category}
                      </div>
                      <div className="col-span-4 sm:col-span-2 flex items-center justify-end gap-2">
                        <div
                          className={`text-right text-sm font-semibold ${tone}`}
                          data-private
                        >
                          {formatSignedEur(tx.amount)}
                        </div>
                        {canWrite ? (
                          <form action={deleteTransactionAction.bind(null, tx.id)}>
                            <button
                              type="submit"
                              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {!recentTx.length ? (
                  <div className="px-4 py-6 text-sm text-slate-600">
                    Aucune transaction pour ces filtres.
                  </div>
                ) : null}
              </div>
            </div>
            {drillMonthKey ? (
              <div className="mt-2 text-xs text-slate-500">
                Liste du mois sélectionné (jusqu’à 500 lignes). Cliquez sur un mois dans un graphique pour
                ouvrir ce filtre.
              </div>
            ) : filteredTx.length > recentTx.length ? (
              <div className="mt-2 text-xs text-slate-500">
                {recentTx.length} transactions les plus récentes affichées ·{" "}
                {filteredTx.length - recentTx.length} de plus sur la période.
              </div>
            ) : null}
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card variant="solid" className="lg:col-span-2">
          <CardHeader className="items-start">
            <div>
              <DashboardBlockTitle icon={FileSpreadsheet}>Transactions</DashboardBlockTitle>
              <CardValue>Importer / Ajouter</CardValue>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-primary cursor-pointer">
                <Upload className="h-4 w-4 text-white/90" />
                Importer un CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImportFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {canWrite ? (
                <>
                  <button
                    type="button"
                    onClick={onClickDeduplicate}
                    disabled={isPending}
                    className="btn-secondary disabled:opacity-60"
                    title="Recalcule les empreintes (date+label+amount), supprime les doublons existants et garantit que les imports futurs n’en créent plus."
                  >
                    <Sparkles className="h-4 w-4 text-ink-500" />
                    Dédupliquer
                  </button>
                  <button
                    type="button"
                    onClick={onClickTagQonto}
                    disabled={isPending}
                    className="btn-secondary disabled:opacity-60"
                    title="Tag « Qonto » les transactions historiques avec un solde renseigné pour activer le calcul du Cash available."
                  >
                    <Sparkles className="h-4 w-4 text-ink-500" />
                    Tag Qonto
                  </button>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {importPreview ? (
              <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Import preview</div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {importPreview.fileName} · {importPreview.format === "qonto" ? "Qonto" : "Generic"} ·{" "}
                      {importPreview.rows.length} row{importPreview.rows.length !== 1 ? "s" : ""}
                    </div>
                    {importPreview.warnings.length ? (
                      <div className="mt-2 text-xs text-slate-500">{importPreview.warnings.join(" ")}</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={cancelImportPreview}
                      disabled={isPending}
                      className="btn-secondary disabled:opacity-60"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={confirmImportPreview}
                      disabled={isPending}
                      className="btn-primary disabled:opacity-60"
                    >
                      Confirmer l’import
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-auto px-2 py-2">
                  <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                        <th className="sticky top-0 bg-slate-50/95 px-3 py-2 backdrop-blur-sm">Date</th>
                        <th className="sticky top-0 bg-slate-50/95 px-3 py-2 backdrop-blur-sm">Label</th>
                        <th className="sticky top-0 bg-slate-50/95 px-3 py-2 backdrop-blur-sm">Société</th>
                        <th className="sticky top-0 bg-slate-50/95 px-3 py-2 backdrop-blur-sm">Category</th>
                        <th className="sticky top-0 bg-slate-50/95 px-3 py-2 text-right backdrop-blur-sm">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {importPreview.rows.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                        <tr key={`preview-row-${i}`} className="text-slate-800">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                            {formatDateFr(row.date)}
                          </td>
                          <td
                            className="max-w-[200px] truncate px-3 py-2 text-xs font-medium"
                            title={row.label}
                            data-private
                          >
                            {row.label}
                          </td>
                          <td
                            className="max-w-[140px] truncate px-3 py-2 text-xs text-slate-600"
                            title={row.company}
                            data-private
                          >
                            {row.company.trim() ? row.company : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{row.category}</td>
                          <td
                            className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold"
                            data-private
                          >
                            {formatSignedEur(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.rows.length > PREVIEW_ROW_LIMIT ? (
                  <div className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-500">
                    Showing first {PREVIEW_ROW_LIMIT} of {importPreview.rows.length} rows
                  </div>
                ) : null}
              </div>
            ) : null}

            {!canWrite ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {preferencesDemoActive
                  ? "Création/suppression désactivées : mode démo volontaire (aucune écriture en base)."
                  : "Création/suppression désactivée : mode démo (variables Supabase absentes)."}
              </div>
            ) : (
              <form action={createTransactionAction} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <label className="text-xs font-medium text-slate-600">Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="text-xs font-medium text-slate-600">Label</label>
                  <input
                    name="label"
                    required
                    placeholder="Ex: Facture client, URSSAF, abonnement…"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-xs font-medium text-slate-600">Société</label>
                  <input
                    name="company"
                    placeholder="Ex: Ma SASU"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-xs font-medium text-slate-600">Catégorie</label>
                  <input
                    name="category"
                    required
                    placeholder="Clients"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-xs font-medium text-slate-600">Montant</label>
                  <input
                    name="amount"
                    required
                    inputMode="decimal"
                    placeholder="1200"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  />
                </div>
                <div className="sm:col-span-4 flex items-end justify-end pb-0.5">
                  <button disabled={isPending} className="btn-primary disabled:opacity-60">
                    Enregistrer
                    <ArrowUpRight className="h-4 w-4 text-white/90" />
                  </button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      </section>

      <Chatbot />
    </main>
  );
}
