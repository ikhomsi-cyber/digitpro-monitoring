"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartPie, Trash2 } from "lucide-react";
import { ExpenseDonut, type DonutSegment } from "@/components/analyse/ExpenseDonut";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyValue } from "@/components/ui/EmptyValue";
import { categoryGlyph } from "@/lib/analyse-category-meta";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import {
  BNC_PAYROLL_EXPENSE_CATEGORY,
  expenseCategoryColor,
  type DashboardTx,
  type ExpenseCategoryMonthlyBreakdown,
  type MonthlyFinanceMetric
} from "@/lib/dashboard-metrics";
import { formatEur, formatSignedEur } from "@/lib/format";
import { deleteTransaction as deleteTransactionAction } from "@/app/dashboard/actions";

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

function expenseBucketForTx(tx: DashboardTx): string {
  return deriveExpenseBucket(tx);
}

export function DashboardExpenseDonutSection({
  metrics,
  filteredTx,
  expenseCategoryBreakdown,
  canWrite
}: {
  metrics: MonthlyFinanceMetric[];
  filteredTx: DashboardTx[];
  expenseCategoryBreakdown: ExpenseCategoryMonthlyBreakdown;
  canWrite: boolean;
}) {
  const monthKeys = useMemo(() => metrics.map((m) => m.month), [metrics]);
  const monthKeysStr = monthKeys.join(",");

  const [donutMonthKey, setDonutMonthKey] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const keys = monthKeysStr ? monthKeysStr.split(",") : [];
    const last = keys[keys.length - 1] ?? "";
    setDonutMonthKey((prev) => (prev && keys.includes(prev) ? prev : last));
  }, [monthKeysStr]);

  useEffect(() => {
    setSelectedCategory(null);
  }, [donutMonthKey]);

  const monthTotalExpenses = useMemo(() => {
    const row = metrics.find((m) => m.month === donutMonthKey);
    return row?.expenses ?? 0;
  }, [metrics, donutMonthKey]);

  const segments: DonutSegment[] = useMemo(() => {
    const r = expenseCategoryBreakdown.rows.find((x) => x.monthKey === donutMonthKey);
    if (!r) return [];
    const pairs = Object.entries(r.values)
      .filter(([name, v]) => v > 0 && name !== BNC_PAYROLL_EXPENSE_CATEGORY)
      .sort((a, b) => b[1] - a[1]);
    return pairs.map(([name, value]) => ({
      name,
      value,
      color: expenseCategoryColor(name),
      Icon: categoryGlyph(name)
    }));
  }, [expenseCategoryBreakdown.rows, donutMonthKey]);

  const categoryRows = segments;

  const txForList = useMemo(() => {
    if (!selectedCategory) return [];
    return filteredTx
      .filter(
        (t) =>
          t.amount < 0 &&
          t.date.slice(0, 7) === donutMonthKey &&
          expenseBucketForTx(t) === selectedCategory
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [filteredTx, donutMonthKey, selectedCategory]);

  const toggleCategory = (name: string) => {
    setSelectedCategory((prev) => (prev === name ? null : name));
  };

  return (
    <section className="mt-0">
      <Card className="border-ink-200/90 bg-gradient-to-b from-ink-50/40 to-white">
        <CardHeader className="flex flex-col gap-4 border-b border-ink-100/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-analyze-200/60 bg-analyze-50/80 text-analyze-700"
              aria-hidden
            >
              <ChartPie className="h-[19px] w-[19px]" strokeWidth={1.85} />
            </span>
            <div className="min-w-0">
              <CardTitle className="!mt-0 text-base font-semibold tracking-tight text-ink-900">
                Dépenses par catégorie
              </CardTitle>
              <div className="mt-1 text-xs leading-relaxed text-ink-500">
                Mois sélectionnable · picto par catégorie · clic pour le détail des transactions
              </div>
            </div>
          </div>
          <label className="flex shrink-0 flex-col gap-1 text-xs font-medium text-ink-600">
            <span className="sr-only">Mois</span>
            <select
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-analyze-500"
              value={donutMonthKey}
              onChange={(e) => setDonutMonthKey(e.target.value)}
            >
              {monthKeys.map((mk) => (
                <option key={mk} value={mk}>
                  {monthLabelFr(mk)}
                </option>
              ))}
            </select>
          </label>
        </CardHeader>
        <CardBody className="pt-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-start lg:gap-10">
            <div className="flex justify-center lg:justify-start">
              <ExpenseDonut
                segments={segments}
                centerTitle="Dépenses"
                centerAmountLabel={formatEur(monthTotalExpenses)}
                size={260}
                onSegmentClick={toggleCategory}
              />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Répartition
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`text-xs font-medium transition ${
                    selectedCategory
                      ? "text-analyze-600 hover:text-analyze-800"
                      : "cursor-default text-ink-400"
                  }`}
                  disabled={!selectedCategory}
                >
                  Toutes les catégories
                </button>
              </div>
              {categoryRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-4 py-6 text-sm text-ink-600">
                  Aucune dépense pour ce mois.
                </p>
              ) : (
                <ul className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                  {categoryRows.map((row) => {
                    const Icon = row.Icon;
                    const active = selectedCategory === row.name;
                    const pct =
                      monthTotalExpenses > 0
                        ? Math.round((row.value / monthTotalExpenses) * 100)
                        : 0;
                    return (
                      <li key={row.name}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(row.name)}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-analyze-500 ${
                            active
                              ? "border-analyze-300/80 bg-analyze-50/70 shadow-sm shadow-analyze-900/5"
                              : "border-ink-200/80 bg-white hover:border-ink-300"
                          }`}
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 bg-white shadow-sm"
                            style={{ borderColor: row.color, color: row.color }}
                          >
                            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink-900">
                            {row.name}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums text-ink-900">
                              {formatEur(row.value)}
                            </span>
                            <span className="text-[11px] font-medium text-ink-500">{pct}%</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {selectedCategory ? (
            <div className="mt-8 border-t border-slate-200/80 pt-6">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  Transactions · {selectedCategory}
                </h3>
                <span className="text-xs text-slate-500">
                  {monthLabelFr(donutMonthKey)} · {txForList.length} opération
                  {txForList.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
                  <div className="col-span-3 sm:col-span-2">Date</div>
                  <div className="col-span-5 sm:col-span-6">Libellé</div>
                  <div className="col-span-4 sm:col-span-4 text-right">Montant</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {txForList.map((tx) => {
                    const co = (tx.company ?? "").trim();
                    return (
                      <div
                        key={tx.id}
                        className="grid grid-cols-12 items-center gap-2 px-4 py-3 hover:bg-slate-50/80"
                      >
                        <div className="col-span-3 sm:col-span-2 text-sm text-slate-600">
                          {formatDateFr(tx.date)}
                        </div>
                        <div className="col-span-5 min-w-0 sm:col-span-6">
                          <div className="break-words text-sm font-medium text-slate-900" data-private>
                            {tx.label}
                          </div>
                          <div className="break-words text-xs text-slate-500" data-private>
                            {co ? co : <EmptyValue label="Société non renseignée" />}
                          </div>
                        </div>
                        <div className="col-span-4 flex items-center justify-end gap-2 sm:col-span-4">
                          <span
                            className="text-right text-sm font-semibold text-slate-900"
                            data-private
                          >
                            {formatSignedEur(tx.amount)}
                          </span>
                          {canWrite ? (
                            <form action={deleteTransactionAction.bind(null, tx.id)}>
                              <button
                                type="submit"
                                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
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
                  {!txForList.length ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-600">
                      Aucune transaction pour cette catégorie.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-center text-xs text-slate-500">
              Sélectionnez une catégorie dans la liste ou sur le graphique pour afficher les
              transactions du mois.
            </p>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
