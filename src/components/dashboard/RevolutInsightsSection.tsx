"use client";

import { useMemo, useState } from "react";
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
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { computeUpcomingInvoice } from "@/lib/upcoming-invoice";
import { dashboardEyebrow, dashboardPanelTitle } from "@/lib/dashboard-surfaces";

type Scope = "all" | "pro" | "personal";

const SCOPE_LABELS: Record<Scope, string> = {
  all: "Tous vos comptes",
  pro: "Compte pro",
  personal: "Compte perso"
};

function monthKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthShortLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(y, m - 1, 1));
}

const MACRO_DOT_COLORS = [
  "bg-rose-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-violet-400",
  "bg-fuchsia-400",
  "bg-ink-400 dark:bg-white/40"
] as const;

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

function computeExpenseMacroBreakdown(txs: readonly DashboardTx[], monthKey: string): ExpenseMacroRow[] {
  const byLabel = new Map<string, number>();
  for (const tx of txs) {
    if (tx.date.slice(0, 7) !== monthKey || tx.amount >= 0) continue;
    const label = expenseMacroLabel(tx);
    if (!label) continue;
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
  kind: "income" | "spend"
): { monthKey: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (const tx of txs) {
    if (kind === "income" ? !txCountsAsIncome(tx) : !txCountsAsExpense(tx)) continue;
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

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const w = 280;
  const h = 64;
  const coords = sparklineCoords(values, w, h);
  const path = smoothSparklinePath(coords);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      <line x1="0" y1={h - 3} x2={w} y2={h - 3} className="stroke-ink-300/60 dark:stroke-white/15" strokeWidth="1" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-3xl border border-ink-200/50 bg-ink-50/60 p-5 dark:border-white/[0.06] dark:bg-white/[0.04]">
      {children}
    </div>
  );
}

export function RevolutInsightsSection({ transactions }: { transactions: DashboardTx[] }) {
  const fmt = useDashboardDisplayFormat();
  const billable = useBillableActivity();
  const [scope, setScope] = useState<Scope>("pro");
  const [monthKey, setMonthKey] = useState<string>(monthKeyNow());

  const scopedTx = useMemo(() => {
    if (scope === "all") return transactions;
    return transactions.filter((t) => (t.scope ?? "pro") === scope);
  }, [transactions, scope]);

  const current = useMemo(() => computeMonthMetrics(scopedTx, monthKey), [scopedTx, monthKey]);
  const previous = useMemo(
    () => computeMonthMetrics(scopedTx, shiftMonthKey(monthKey, -1)),
    [scopedTx, monthKey]
  );
  const spendSeries = useMemo(
    () => trailingMonthlySeries(scopedTx, monthKey, "spend"),
    [scopedTx, monthKey]
  );
  const incomeSeries = useMemo(
    () => trailingMonthlySeries(scopedTx, monthKey, "income"),
    [scopedTx, monthKey]
  );
  const expenseMacroRows = useMemo(
    () => computeExpenseMacroBreakdown(scopedTx, monthKey),
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

  const depensesDelta = current.depenses - previous.depenses;
  const entreesDelta = current.entrees - previous.entrees;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={dashboardEyebrow}>Analyse</p>
          <h2 className={clsx(dashboardPanelTitle, "mt-1")}>Outils d&apos;analyse</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="appearance-none rounded-full border border-ink-200/60 bg-transparent py-1.5 pl-3 pr-8 text-sm font-medium text-ink-700 outline-none dark:border-white/10 dark:text-white/75"
              aria-label="Périmètre des comptes"
            >
              {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-ink-400 dark:text-white/40" aria-hidden />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
              className="grid h-8 w-8 place-items-center rounded-full text-ink-400 transition hover:bg-ink-100/80 hover:text-ink-900 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-16 text-center text-sm font-medium capitalize text-ink-700 dark:text-white/75">
              {monthShortLabel(monthKey)}
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InsightCard>
          <p className="text-sm text-ink-500 dark:text-white/50">Dépenses</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(current.depenses)}
            </p>
            <span className="text-sm font-medium tabular-nums text-rose-500 dark:text-rose-400">
              {depensesDelta >= 0 ? "▲" : "▼"} {fmt.euro(Math.abs(depensesDelta))}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {expenseMacroRows.length ? (
              expenseMacroRows.map((row, index) => (
                <span
                  key={row.label}
                  className="inline-flex max-w-full items-center gap-1.5 text-ink-600 dark:text-white/60"
                >
                  <span
                    className={clsx("h-2 w-2 shrink-0 rounded-full", MACRO_DOT_COLORS[index % MACRO_DOT_COLORS.length])}
                    aria-hidden
                  />
                  <span className="truncate">{row.label}</span>
                  <span className="font-medium tabular-nums text-ink-800 dark:text-white/85">
                    {fmt.euro(row.amount)}
                  </span>
                </span>
              ))
            ) : (
              <span className="text-ink-500 dark:text-white/45">Aucune dépense ce mois</span>
            )}
          </div>
          <div className="mt-3">
            <Sparkline values={spendSeries.map((p) => p.value)} stroke="#fb7185" />
          </div>
          <p className="mt-2 text-xs text-ink-400 dark:text-white/35">12 derniers mois</p>
        </InsightCard>

        <InsightCard>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-ink-500 dark:text-white/50">Entrées d&apos;argent</p>
            {scope === "pro" ? (
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
            ) : null}
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
            <Sparkline values={incomeSeries.map((p) => p.value)} stroke="#34d399" />
          </div>
          <p className="mt-2 text-xs text-ink-400 dark:text-white/35">12 derniers mois</p>
        </InsightCard>
      </div>
    </section>
  );
}
