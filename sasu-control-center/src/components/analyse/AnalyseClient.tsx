"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  PieChart as PieChartIcon,
  Plus,
  Repeat,
  Search,
  Settings,
  ShoppingCart,
  UserRound,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import {
  BNC_PAYROLL_EXPENSE_CATEGORY,
  expenseCategoryColor,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { formatEur } from "@/lib/format";
import { categoryGlyph } from "@/lib/analyse-category-meta";
import { ExpenseDonut, type DonutSegment } from "./ExpenseDonut";

function formatMonthLabelFr(ym: string): string {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!ys || !ms || Number.isNaN(y) || Number.isNaN(m)) return ym;
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function uniqueSortedMonths(txs: DashboardTx[]): string[] {
  const set = new Set<string>();
  for (const t of txs) set.add(t.date.slice(0, 7));
  return Array.from(set).sort();
}

function shiftMonth(ym: string, delta: number): string {
  const [ys, ms] = ym.split("-").map(Number);
  const d = new Date(ys, ms - 1 + delta, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

type FlowTab = "entries" | "expenses" | "recurrences";

function breakdownForMonth(
  txs: DashboardTx[],
  monthKey: string,
  scope: "pro" | "personal",
  mode: "in" | "out",
  simplified: boolean
): {
  segments: DonutSegment[];
  categories: Array<{ name: string; amount: number; pct: number; txCount: number }>;
  total: number;
  accountsConnected: number;
} {
  const scoped = txs.filter((t) => (t.scope ?? "pro") === scope);
  const monthTx = scoped.filter((t) => t.date.startsWith(monthKey));

  const companies = new Set<string>();
  for (const t of monthTx) {
    const c = (t.company ?? "").trim();
    if (c.length) companies.add(c);
  }

  const map = new Map<string, { amount: number; txCount: number }>();
  for (const t of monthTx) {
    if (mode === "out" && t.amount >= 0) continue;
    if (mode === "in" && t.amount <= 0) continue;
    if (mode === "out" && deriveExpenseBucket(t) === BNC_PAYROLL_EXPENSE_CATEGORY) continue;
    const raw = (t.category ?? "").trim();
    const cat =
      mode === "out"
        ? deriveExpenseBucket(t)
        : raw.length
          ? raw
          : "Autres entrées";
    const amt = mode === "out" ? Math.abs(t.amount) : t.amount;
    const prev = map.get(cat) ?? { amount: 0, txCount: 0 };
    map.set(cat, { amount: prev.amount + amt, txCount: prev.txCount + 1 });
  }

  let pairs = Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount);

  if (simplified && pairs.length > 5) {
    const head = pairs.slice(0, 4);
    const tail = pairs.slice(4);
    const merged = tail.reduce(
      (acc, p) => ({
        amount: acc.amount + p.amount,
        txCount: acc.txCount + p.txCount
      }),
      { amount: 0, txCount: 0 }
    );
    pairs = [...head, { name: "Autres", ...merged }];
  }

  const total = pairs.reduce((s, p) => s + p.amount, 0);

  const categories = pairs.map((p) => ({
    name: p.name,
    amount: p.amount,
    pct: total > 0 ? Math.round((p.amount / total) * 100) : 0,
    txCount: p.txCount
  }));

  const segments: DonutSegment[] = pairs.map((p) => ({
    name: p.name,
    value: p.amount,
    color: expenseCategoryColor(p.name),
    Icon: categoryGlyph(p.name)
  }));

  return {
    segments,
    categories,
    total,
    accountsConnected: Math.max(companies.size, monthTx.length ? 1 : 0)
  };
}

export function AnalyseClient({ initialTransactions }: { initialTransactions: DashboardTx[] }) {
  const transactions = initialTransactions;
  const [scope, setScope] = useState<"pro" | "personal">("pro");
  const [mainTab, setMainTab] = useState<FlowTab>("expenses");
  const [categoryMode, setCategoryMode] = useState<"categories" | "simplified">("categories");
  const [budgetCap] = useState(4000);

  const months = useMemo(() => uniqueSortedMonths(transactions), [transactions]);

  const defaultMonth = useMemo(() => {
    if (!months.length) {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    }
    const cur = (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    })();
    if (months.includes(cur)) return cur;
    return months[months.length - 1]!;
  }, [months]);

  const [monthKey, setMonthKey] = useState(defaultMonth);

  const simplified = categoryMode === "simplified";

  const expenseBreakdown = useMemo(
    () => breakdownForMonth(transactions, monthKey, scope, "out", simplified),
    [transactions, monthKey, scope, simplified]
  );

  const incomeBreakdown = useMemo(
    () => breakdownForMonth(transactions, monthKey, scope, "in", simplified),
    [transactions, monthKey, scope, simplified]
  );

  const active =
    mainTab === "expenses"
      ? expenseBreakdown
      : mainTab === "entries"
        ? incomeBreakdown
        : null;

  const budgetPct =
    mainTab === "expenses" && expenseBreakdown.total > 0
      ? Math.min(100, Math.round((expenseBreakdown.total / budgetCap) * 100))
      : 0;

  const canPrev = months.length === 0 ? true : months.indexOf(monthKey) > 0;
  const canNext =
    months.length === 0 ? true : months.indexOf(monthKey) < months.length - 1;

  const clampNavigate = (next: string) => {
    if (!months.length) {
      setMonthKey(next);
      return;
    }
    if (months.includes(next)) setMonthKey(next);
    else if (next < months[0]!) setMonthKey(months[0]!);
    else if (next > months[months.length - 1]!) setMonthKey(months[months.length - 1]!);
    else {
      const dir = next > monthKey ? 1 : -1;
      let probe = monthKey;
      for (let i = 0; i < 24; i++) {
        probe = shiftMonth(probe, dir);
        if (months.includes(probe)) {
          setMonthKey(probe);
          return;
        }
      }
      setMonthKey(next < monthKey ? months[0]! : months[months.length - 1]!);
    }
  };

  const flowTabs: { id: FlowTab; label: string }[] = [
    { id: "entries", label: "Entrées" },
    { id: "expenses", label: "Sorties" },
    { id: "recurrences", label: "Récurrences" }
  ];

  return (
    <div className="min-h-dvh bg-[#e8ecf7] pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#e8ecf7]/90 px-4 pb-2 pt-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-analyze ring-1 ring-slate-200/80 transition hover:bg-slate-50"
            aria-label="Retour au tableau de bord"
          >
            <UserRound className="h-[22px] w-[22px] text-slate-700" strokeWidth={1.75} />
          </Link>
          <h1 className="font-display text-lg font-semibold tracking-tight text-slate-900">Analyse</h1>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-analyze ring-1 ring-slate-200/80"
              aria-label="Rechercher"
            >
              <Search className="h-[21px] w-[21px] text-slate-700" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-analyze ring-1 ring-slate-200/80"
              aria-label="Réglages"
            >
              <Settings className="h-[21px] w-[21px] text-slate-700" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4">
        {/* Scope */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-slate-200/60">
            <button
              type="button"
              onClick={() => setScope("pro")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition",
                scope === "pro"
                  ? "bg-analyze-500 text-white shadow-md shadow-analyze-500/25"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              SASU
            </button>
            <button
              type="button"
              onClick={() => setScope("personal")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition",
                scope === "personal"
                  ? "bg-analyze-500 text-white shadow-md shadow-analyze-500/25"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Privé
            </button>
          </div>
        </div>

        {/* Month picker */}
        <div className="rounded-analyze bg-white p-4 shadow-analyze ring-1 ring-white/80">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => clampNavigate(shiftMonth(monthKey, -1))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 disabled:opacity-35"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-slate-50 py-2.5 text-[15px] font-semibold capitalize tracking-tight text-slate-900 ring-1 ring-slate-200/70"
            >
              {formatMonthLabelFr(monthKey)}
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => clampNavigate(shiftMonth(monthKey, 1))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 disabled:opacity-35"
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Entrées / Sorties / Récurrences */}
        <div className="rounded-full bg-slate-200/70 p-1 shadow-inner ring-1 ring-slate-300/40">
          <div className="grid grid-cols-3 gap-1">
            {flowTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMainTab(t.id)}
                className={clsx(
                  "rounded-full py-2.5 text-center text-[13px] font-semibold transition",
                  mainTab === t.id
                    ? "bg-white text-analyze-600 shadow-md shadow-slate-900/10 ring-1 ring-slate-200/90"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {mainTab === "recurrences" ? (
          <div className="rounded-analyze bg-white px-5 py-12 text-center shadow-analyze ring-1 ring-white/80">
            <Repeat className="mx-auto h-10 w-10 text-analyze-400" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg font-semibold text-slate-900">Récurrences</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Détection des abonnements et paiements récurrents. Bientôt dans DigitPro.
            </p>
          </div>
        ) : active ? (
          <>
            <div className="rounded-analyze bg-white px-4 pb-5 pt-6 shadow-analyze ring-1 ring-white/80">
              <ExpenseDonut
                segments={active.segments}
                centerTitle={mainTab === "expenses" ? "Dépenses" : "Entrées"}
                centerAmountLabel={active.total > 0 ? formatEur(active.total) : formatEur(0)}
              />

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] font-bold text-slate-500 ring-2 ring-white"
                      aria-hidden
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                  <span className="text-[13px] font-semibold text-analyze-600">
                    {active.accountsConnected} compte{active.accountsConnected !== 1 ? "s" : ""}{" "}
                    <ChevronRight className="inline h-4 w-4 align-middle opacity-70" />
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-full bg-slate-200/70 p-1 shadow-inner">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setCategoryMode("categories")}
                    className={clsx(
                      "rounded-full py-2 text-[13px] font-semibold transition",
                      categoryMode === "categories"
                        ? "bg-white text-analyze-600 shadow-sm ring-1 ring-slate-200/80"
                        : "text-slate-600"
                    )}
                  >
                    Catégories
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryMode("simplified")}
                    className={clsx(
                      "rounded-full py-2 text-[13px] font-semibold transition",
                      categoryMode === "simplified"
                        ? "bg-white text-analyze-600 shadow-sm ring-1 ring-slate-200/80"
                        : "text-slate-600"
                    )}
                  >
                    Simplifié
                  </button>
                </div>
              </div>
            </div>

            {mainTab === "expenses" ? (
              <div className="rounded-analyze bg-white px-5 py-4 shadow-analyze ring-1 ring-white/80">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-70" />
                    <span className="relative m-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[13px] font-semibold text-slate-800">Budget</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <p className="text-lg font-bold tabular-nums text-slate-900" data-private>
                    {formatEur(expenseBreakdown.total)}{" "}
                    <span className="text-sm font-medium text-slate-400">/ {formatEur(budgetCap)}</span>
                  </p>
                  <span className="text-sm font-bold tabular-nums text-analyze-600">{budgetPct}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-analyze-500 to-analyze-400 transition-[width] duration-500 ease-out"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="rounded-analyze bg-white px-4 pb-2 pt-4 shadow-analyze ring-1 ring-white/80">
              <button
                type="button"
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-analyze border-2 border-dashed border-analyze-200 bg-analyze-50/40 py-3 text-[13px] font-semibold text-analyze-700 transition hover:bg-analyze-50"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Créer une catégorie
              </button>

              <ul className="divide-y divide-slate-100">
                {active.categories.map((row) => {
                  const Icon = categoryGlyph(row.name);
                  const color = expenseCategoryColor(row.name);
                  return (
                    <li key={row.name}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-slate-50/80 active:bg-slate-50"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-2 ring-white shadow-md"
                          style={{ backgroundColor: color }}
                        >
                          <Icon className="h-[22px] w-[22px] text-white" strokeWidth={2} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-semibold text-slate-900">{row.name}</p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            {row.pct}% · {row.txCount} transaction{row.txCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[15px] font-semibold tabular-nums text-slate-900" data-private>
                            {formatEur(row.amount)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {!active.categories.length ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Aucune transaction pour ce mois et ce périmètre.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        <p className="pb-4 pt-2 text-center text-[11px] text-slate-400">DigitPro · vue inspirée banque / budgeting</p>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2">
          <NavItem href="/dashboard" icon={Wallet} label="Comptes" active={false} />
          <NavItem href="/analyse" icon={PieChartIcon} label="Analyse" active />
          <NavItem href="#" icon={Gift} label="Opportunités" badge={3} />
          <NavItem href="#" icon={Activity} label="Activités" active={false} />
          <NavItem href="#" icon={ShoppingCart} label="Achats" active={false} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  badge
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  const inner = (
    <span
      className={clsx(
        "flex flex-col items-center gap-1 py-1 text-[10px] font-semibold",
        active ? "text-analyze-600" : "text-slate-400"
      )}
    >
      <span className="relative flex h-9 w-9 items-center justify-center">
        <Icon className={clsx("h-[22px] w-[22px]", active && "stroke-[2.25px]")} strokeWidth={active ? 2.25 : 1.85} />
        {badge != null ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </span>
  );

  if (href === "#") {
    return (
      <button type="button" className="inline-flex flex-col items-stretch rounded-xl px-1 hover:bg-slate-50">
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} className="inline-flex flex-col items-stretch rounded-xl px-1 hover:bg-slate-50">
      {inner}
    </Link>
  );
}
