"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchUpcomingQontoDebits } from "@/app/dashboard/gmail-actions";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import {
  countsTowardDashboardExpenseTotal,
  countsTowardPersonalExpenseKpi,
  countsTowardPersonalRevenueKpi,
  transactionAnalyticsDayIso,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { resolveSasuSimplifiedExpenseGroup } from "@/lib/valeur-reelle-analyze";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { computeUpcomingInvoice } from "@/lib/upcoming-invoice";
import type { QontoUpcomingDebit } from "@/lib/gmail/qonto-debit-parser";
import { monthTitleFr } from "@/lib/billable-calendar-metrics";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";

type ExpenseKindFilter = "all" | "perso" | "digitpro";

function monthKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthNavigatorLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return monthTitleFr(y, m - 1);
}

function formatDebitDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short"
  }).format(new Date(y, m - 1, d));
}

function UpcomingQontoDebitsList({
  debits,
  fmt
}: {
  debits: QontoUpcomingDebit[];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
}) {
  if (!debits.length) return null;

  return (
    <div className="mt-2.5 space-y-1.5 rounded-2xl border border-ink-200/50 bg-ink-50/60 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-white/35">
        Prochains prélèvements
      </p>
      <ul className="space-y-1.5">
        {debits.map((debit) => (
          <li key={debit.id} className="flex items-start justify-between gap-2 text-[11px] leading-snug">
            <span className="min-w-0 truncate font-medium text-ink-700 dark:text-white/70">
              {debit.organization}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {debit.amountEur != null ? (
                <span className="font-semibold text-ink-900 dark:text-white/85">
                  {fmt.euro(debit.amountEur)}
                </span>
              ) : (
                <span className="text-ink-400 dark:text-white/35">—</span>
              )}
              <span className="ml-1.5 text-ink-400 dark:text-white/38">
                {formatDebitDateLabel(debit.debitDateIso)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pictogramme par catégorie de dépense (macro bucket ou Bankin). */
function expenseCategoryPicto(label: string): string {
  const n = label.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (n.includes("kilomet") || /\bik\b/.test(n)) return "🚗";
  if (n.includes("repas d'affaire") || n.includes("repas d affaire")) return "🍽️";
  if (n.includes("repas dirigeant") || n.includes("repas du dirigeant")) return "🥗";
  if (n.includes("mutuelle") || n.includes("prevoyance")) return "🏥";
  if (n.includes("compta") || n.includes("admin")) return "📊";
  if (n.includes("mobile") || n.includes("internet") || n.includes("telecom")) return "📱";
  if (n.includes("icloud") || n.includes("logiciel") || n.includes("saas")) return "☁️";
  if (n.includes("qonto") || n.includes("bancaire")) return "💳";
  if (n.includes("assurance")) return "🛡️";
  if (n.includes("materiel") || n.includes("matériel")) return "💻";
  if (n.includes("bnc")) return "💼";
  if (n.includes("tva") || n.includes("impot") || n.includes("impôt")) return "🧾";
  if (n.includes("urssaf") || n.includes("retraite")) return "🏛️";
  if (n.includes("ndf") || n.includes("note de frais")) return "🧾";
  if (n.includes("cesu")) return "👶";
  if (n.includes("loyer") || n.includes("logement") || n.includes("habitat")) return "🏠";
  if (n.includes("restaurant") || n.includes("aliment") || n.includes("courses")) return "🛒";
  if (n.includes("transport") || n.includes("essence") || n.includes("uber")) return "🚕";
  if (n.includes("shopping") || n.includes("vetement")) return "🛍️";
  if (n.includes("loisir") || n.includes("divertissement")) return "🎮";
  if (n.includes("voyage") || n.includes("vacance")) return "✈️";
  return "📦";
}

function formatBarAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
}

function ExpenseCategoryBars({
  rows,
  fmt
}: {
  rows: ExpenseMacroRow[];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
}) {
  const top = rows.slice(0, 8);
  const max = Math.max(1, ...top.map((row) => row.amount));

  if (!top.length) {
    return <span className="text-ink-500 dark:text-white/45">Aucune dépense ce mois</span>;
  }

  return (
    <div
      className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="list"
      aria-label="Répartition des dépenses par catégorie"
    >
      <div className="flex min-w-min items-end gap-1.5 pt-6 sm:gap-2.5">
        {top.map((row) => {
          const heightPct = Math.max(22, Math.round((row.amount / max) * 100));

          return (
            <div
              key={row.label}
              role="listitem"
              className="group relative flex min-w-[3rem] flex-1 flex-col items-center gap-1.5"
              title={`${row.label} · ${fmt.euro(row.amount)}`}
            >
              <div
                className="pointer-events-none absolute -top-7 left-1/2 z-10 w-max max-w-[9.5rem] -translate-x-1/2 opacity-0 transition duration-200 group-hover:opacity-100"
                aria-hidden
              >
                <div className="rounded-xl border border-ink-200/60 bg-white px-2.5 py-1.5 text-center shadow-md dark:border-cyan-100/20 dark:bg-[#0a2f38] dark:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.6)]">
                  <p className="text-[10px] font-semibold leading-tight text-ink-800 dark:text-cyan-50">
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold tabular-nums text-ink-800 dark:text-white/90">
                    {fmt.euro(row.amount)}
                  </p>
                </div>
              </div>

              <div className="flex h-40 w-12 shrink-0 items-end justify-center sm:h-44 sm:w-[3.25rem]">
                <div
                  className="flex w-full min-h-[2.75rem] items-center justify-center rounded-full bg-rose-100/85 transition-all duration-200 group-hover:bg-rose-200/80 dark:bg-white/[0.14] dark:group-hover:bg-white/[0.2]"
                  style={{ height: `${heightPct}%` }}
                >
                  <span
                    className="max-h-full overflow-hidden px-0.5 text-[10px] font-bold leading-none tracking-tight tabular-nums text-ink-800 sm:text-[11px] dark:text-white/90"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {formatBarAmount(row.amount)}
                  </span>
                </div>
              </div>
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-200/45 bg-ink-50/80 text-lg transition duration-200 group-hover:scale-105 group-hover:border-rose-200/60 dark:border-white/[0.1] dark:bg-white/[0.06] dark:group-hover:border-rose-200/25"
                aria-hidden
              >
                {expenseCategoryPicto(row.label)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function bankinMacroCategoryLabel(storedCategory: string): string {
  const raw = String(storedCategory ?? "").trim();
  if (!raw) return "Autres";
  const m = /\s[›>]\s/u.exec(raw);
  if (m?.index != null) {
    return raw.slice(0, m.index).trim().replace(/\.\s*$/, "") || raw;
  }
  return raw;
}

function expenseMacroLabel(tx: DashboardTx): string | null {
  const txScope = tx.scope ?? "pro";
  if (txScope === "pro") {
    if (!countsTowardDashboardExpenseTotal(tx)) return null;
    return deriveExpenseBucket(tx);
  }
  if (!countsTowardPersonalExpenseKpi(tx)) return null;
  return bankinMacroCategoryLabel(tx.category);
}

function txCountsAsExpense(tx: DashboardTx): boolean {
  return tx.amount < 0 && expenseMacroLabel(tx) != null;
}

/** Mois analytique d'une entrée (CA fin de mois → mois suivant via `transactionAnalyticsDayIso`). */
function incomeAnalyticsMonthKey(tx: DashboardTx): string | null {
  if (tx.amount <= 0) return null;
  const txScope = tx.scope ?? "pro";
  if (txScope === "pro") return transactionAnalyticsDayIso(tx).slice(0, 7);
  if (!countsTowardPersonalRevenueKpi(tx)) return null;
  return tx.date.slice(0, 7);
}

function txCountsAsIncome(tx: DashboardTx): boolean {
  return incomeAnalyticsMonthKey(tx) != null;
}

type ExpenseMacroRow = { label: string; amount: number };

function expenseMatchesKindFilter(tx: DashboardTx, filter: ExpenseKindFilter): boolean {
  if (filter === "all") return true;
  const bucket = deriveExpenseBucket(tx);
  const group = resolveSasuSimplifiedExpenseGroup(tx, bucket);
  if (filter === "perso") return group === "Frais perso";
  return group === "Frais DigitPro";
}

function computeExpenseMacroBreakdown(
  txs: readonly DashboardTx[],
  monthKey: string,
  kindFilter: ExpenseKindFilter = "all"
): ExpenseMacroRow[] {
  const byLabel = new Map<string, number>();
  for (const tx of txs) {
    if (tx.date.slice(0, 7) !== monthKey || tx.amount >= 0) continue;
    const label = expenseMacroLabel(tx);
    if (!label) continue;
    if (!expenseMatchesKindFilter(tx, kindFilter)) continue;
    byLabel.set(label, (byLabel.get(label) ?? 0) + Math.abs(tx.amount));
  }
  return Array.from(byLabel.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
}

type MonthMetrics = {
  depenses: number;
  entrees: number;
  net: number;
};

function computeMonthMetrics(txs: readonly DashboardTx[], monthKey: string): MonthMetrics {
  const macroRows = computeExpenseMacroBreakdown(txs, monthKey);
  const depenses = macroRows.reduce((sum, row) => sum + row.amount, 0);
  let entrees = 0;
  for (const tx of txs) {
    const analyticsMonth = incomeAnalyticsMonthKey(tx);
    if (analyticsMonth !== monthKey) continue;
    entrees += tx.amount;
  }
  return { depenses, entrees, net: entrees - depenses };
}

const TRAILING_MONTHS = 12;

/** Série des `TRAILING_MONTHS` derniers mois (inclus `endMonthKey`), total des entrées ou des dépenses. */
function trailingMonthlySeries(
  txs: readonly DashboardTx[],
  endMonthKey: string,
  kind: "income" | "spend",
  expenseKindFilter: ExpenseKindFilter = "all"
): { monthKey: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (const tx of txs) {
    if (kind === "income" ? !txCountsAsIncome(tx) : !txCountsAsExpense(tx)) continue;
    if (kind === "spend" && !expenseMatchesKindFilter(tx, expenseKindFilter)) continue;
    const mk = kind === "income" ? incomeAnalyticsMonthKey(tx)! : tx.date.slice(0, 7);
    const amount = kind === "income" ? tx.amount : Math.abs(tx.amount);
    buckets.set(mk, (buckets.get(mk) ?? 0) + amount);
  }
  const series: { monthKey: string; value: number }[] = [];
  for (let i = TRAILING_MONTHS - 1; i >= 0; i -= 1) {
    const mk = shiftMonthKey(endMonthKey, -i);
    series.push({ monthKey: mk, value: buckets.get(mk) ?? 0 });
  }
  return series;
}

function sparklineCoords(values: number[], w: number, h: number): Array<{ x: number; y: number }> {
  const max = Math.max(1, ...values);
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) {
    const y = h - (values[0]! / max) * (h - 6) - 3;
    return [
      { x: 0, y },
      { x: w, y }
    ];
  }
  return values.map((v, i) => ({
    x: (i / (n - 1)) * w,
    y: h - (v / max) * (h - 6) - 3
  }));
}

/** Courbe lisse (splines de Bézier) — pas de segments anguleux. */
function smoothSparklinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) {
    const p = coords[0]!;
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }

  let d = `M ${coords[0]!.x.toFixed(1)} ${coords[0]!.y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[Math.min(i + 2, coords.length - 1)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function sparklineMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const raw = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(y, (m || 1) - 1, 1));
  return raw.replace(/\.$/, "");
}

function Sparkline({
  points,
  stroke
}: {
  points: readonly { monthKey: string; value: number }[];
  stroke: string;
}) {
  const w = 280;
  const chartH = 48;
  const values = points.map((p) => p.value);
  const coords = sparklineCoords(values, w, chartH);
  const path = smoothSparklinePath(coords);

  return (
    <div className="w-full" aria-hidden>
      <svg viewBox={`0 0 ${w} ${chartH}`} preserveAspectRatio="none" className="h-12 w-full">
        <line
          x1="0"
          y1={chartH - 3}
          x2={w}
          y2={chartH - 3}
          className="stroke-ink-300/60 dark:stroke-white/15"
          strokeWidth="1"
        />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex w-full justify-between gap-0.5 px-px">
        {points.map((point) => (
          <span
            key={point.monthKey}
            className="min-w-0 flex-1 truncate text-center text-[8px] font-medium capitalize leading-none text-ink-400 dark:text-white/38 sm:text-[9px]"
          >
            {sparklineMonthLabel(point.monthKey)}
          </span>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ children }: { children: React.ReactNode }) {
  return <div className={dashboardInsightCard}>{children}</div>;
}

export function RevolutInsightsSection({
  transactions,
  bncYearTotalEur = 0
}: {
  transactions: DashboardTx[];
  /** BNC versés (virements sortants libellé « BNC ») depuis le 1er janvier, année civile en cours. */
  bncYearTotalEur?: number;
}) {
  const fmt = useDashboardDisplayFormat();
  const billable = useBillableActivity();
  const [monthKey, setMonthKey] = useState<string>(monthKeyNow());
  const [expenseKindFilter, setExpenseKindFilter] = useState<ExpenseKindFilter>("all");
  const [qontoDebits, setQontoDebits] = useState<QontoUpcomingDebit[]>([]);

  useEffect(() => {
    let cancelled = false;
    console.time("dashboard:gmail");
    void fetchUpcomingQontoDebits()
      .then(({ debits }) => {
        if (!cancelled) setQontoDebits(debits);
      })
      .catch(() => {
        // Gmail non connecté ou indisponible : on garde les données SSR le cas échéant.
      })
      .finally(() => {
        console.timeEnd("dashboard:gmail");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scopedTx = useMemo(
    () => transactions.filter((t) => (t.scope ?? "pro") === "pro"),
    [transactions]
  );

  const current = useMemo(() => computeMonthMetrics(scopedTx, monthKey), [scopedTx, monthKey]);
  const previous = useMemo(
    () => computeMonthMetrics(scopedTx, shiftMonthKey(monthKey, -1)),
    [scopedTx, monthKey]
  );
  const expenseMacroRows = useMemo(
    () => computeExpenseMacroBreakdown(scopedTx, monthKey, expenseKindFilter),
    [expenseKindFilter, scopedTx, monthKey]
  );
  const previousExpenseMacroRows = useMemo(
    () => computeExpenseMacroBreakdown(scopedTx, shiftMonthKey(monthKey, -1), expenseKindFilter),
    [expenseKindFilter, scopedTx, monthKey]
  );
  const filteredDepenses = useMemo(
    () => expenseMacroRows.reduce((sum, row) => sum + row.amount, 0),
    [expenseMacroRows]
  );
  const previousFilteredDepenses = useMemo(
    () => previousExpenseMacroRows.reduce((sum, row) => sum + row.amount, 0),
    [previousExpenseMacroRows]
  );
  const spendSeries = useMemo(
    () => trailingMonthlySeries(scopedTx, monthKey, "spend", expenseKindFilter),
    [expenseKindFilter, scopedTx, monthKey]
  );
  const incomeSeries = useMemo(
    () => trailingMonthlySeries(scopedTx, monthKey, "income"),
    [scopedTx, monthKey]
  );
  const upcomingInvoice = useMemo(
    () =>
      computeUpcomingInvoice({
        selectedWorkDayIsos: billable.selected,
        billableRatePeriods: billable.billableRatePeriods,
        fallbackTjmHt: billable.tjmHt
      }),
    [billable.billableRatePeriods, billable.selected, billable.tjmHt]
  );

  /** Prélèvements Gmail — uniquement mois civil en cours, et seulement si la carte affiche ce mois. */
  const qontoDebitsThisMonth = useMemo(() => {
    const nowKey = monthKeyNow();
    if (monthKey !== nowKey) return [];
    return qontoDebits
      .filter((d) => d.debitDateIso.startsWith(nowKey))
      .sort((a, b) => a.debitDateIso.localeCompare(b.debitDateIso));
  }, [qontoDebits, monthKey]);

  const depensesDelta = filteredDepenses - previousFilteredDepenses;
  const entreesDelta = current.entrees - previous.entrees;

  return (
    <section className="space-y-3">
      <div className="flex justify-center">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-400 transition hover:bg-ink-100/80 hover:text-ink-900 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[6.5rem] text-center text-sm font-medium text-ink-700 dark:text-white/75">
            {monthNavigatorLabel(monthKey)}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-400 transition hover:bg-ink-100/80 hover:text-ink-900 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InsightCard>
          <div className="flex items-center justify-between gap-2">
            <p className="shrink-0 text-sm text-ink-500 dark:text-white/50">Dépenses</p>
            <div
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-ink-200/55 bg-ink-100/70 p-0.5 dark:border-white/[0.1] dark:bg-white/[0.05]"
              role="group"
              aria-label="Filtrer les dépenses"
            >
              {(
                [
                  { id: "all" as const, label: "Tous" },
                  { id: "perso" as const, label: "Perso" },
                  { id: "digitpro" as const, label: "DigitPro" }
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={expenseKindFilter === item.id}
                  onClick={() => setExpenseKindFilter(item.id)}
                  className={clsx(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-tight transition-all duration-200",
                    expenseKindFilter === item.id
                      ? "bg-white text-ink-900 shadow-sm dark:bg-white/[0.18] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                      : "text-ink-500 hover:text-ink-800 dark:text-white/40 dark:hover:text-white/72"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(filteredDepenses)}
            </p>
            <span className="text-sm font-medium tabular-nums text-rose-500 dark:text-rose-400">
              {depensesDelta >= 0 ? "▲" : "▼"} {fmt.euro(Math.abs(depensesDelta))}
            </span>
          </div>
          <UpcomingQontoDebitsList debits={qontoDebitsThisMonth} fmt={fmt} />
          <div className="mt-1.5">
            <ExpenseCategoryBars rows={expenseMacroRows} fmt={fmt} />
          </div>
          <div className="mt-3">
            <Sparkline points={spendSeries} stroke="#fb7185" />
          </div>
        </InsightCard>

        <InsightCard>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-ink-500 dark:text-white/50">Entrées d&apos;argent</p>
              <p className="mt-0.5 text-[11px] text-ink-400 dark:text-white/38">
                BNC versé depuis le début de l&apos;année ·{" "}
                <span className="font-semibold tabular-nums text-ink-700 dark:text-white/65">
                  {fmt.euro(bncYearTotalEur)}
                </span>
              </p>
            </div>
            <span
              className={clsx(
                "shrink-0 text-right text-[11px] font-bold leading-tight tabular-nums",
                upcomingInvoice.amountHtEur <= 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : upcomingInvoice.dueInDays < 0
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-amber-700 dark:text-amber-300"
              )}
            >
              {upcomingInvoice.statusLabel} · {fmt.euro(upcomingInvoice.amountTtcEur)} TTC
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(current.entrees)}
            </p>
            <span className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
              {entreesDelta >= 0 ? "▲" : "▼"} {fmt.euro(Math.abs(entreesDelta))}
            </span>
          </div>
          <div className="mt-5">
            <Sparkline points={incomeSeries} stroke="#34d399" />
          </div>
        </InsightCard>
      </div>
    </section>
  );
}
