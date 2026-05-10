"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { expenseCategoryColor } from "@/lib/dashboard-metrics";
import { formatEur } from "@/lib/format";

export type StackedExpenseChartRow = Record<string, string | number>;

const CHART_H = 304;

function StackedTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const items = payload
    .filter(
      (p) =>
        typeof p.value === "number" &&
        p.value > 0 &&
        p.dataKey != null &&
        p.dataKey !== "month" &&
        p.dataKey !== "_tapTotal"
    )
    .sort((a, b) => Number(b.value) - Number(a.value));
  const total = items.reduce((s, p) => s + Number(p.value), 0);
  return (
    <div className="max-w-[min(100vw-2rem,20rem)] rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5">
      <div className="font-semibold tracking-tight text-slate-900">{label}</div>
      <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-0.5">
        {items.map((p) => {
          const v = Number(p.value);
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return (
            <li
              key={String(p.dataKey)}
              className="flex items-baseline justify-between gap-3 text-xs text-slate-600"
            >
              <span className="min-w-0 break-words font-medium" style={{ color: p.color }}>
                {String(p.dataKey)}
              </span>
              <span className="shrink-0 tabular-nums text-slate-800">
                {formatEur(v)}
                <span className="ml-1.5 text-[10px] font-medium text-slate-400">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-slate-100 pt-2 text-xs font-semibold text-slate-900">
        Total <span className="tabular-nums">{formatEur(total)}</span>
      </div>
    </div>
  );
}

export function MonthlyStackedExpenseChartClient({
  data,
  visibleCategories,
  onMonthClick
}: {
  data: StackedExpenseChartRow[];
  visibleCategories: string[];
  onMonthClick?: (monthKey: string) => void;
}) {
  const chartData = useMemo(() => {
    if (!visibleCategories.length) return [];
    const clickable = Boolean(onMonthClick);
    return data.map((row) => {
      let tap = 0;
      for (const c of visibleCategories) tap += Number(row[c] ?? 0);
      return clickable ? { ...row, _tapTotal: tap } : row;
    });
  }, [data, visibleCategories, onMonthClick]);

  const avgMonthlyTotal = useMemo(() => {
    if (!chartData.length || !visibleCategories.length) return 0;
    const sums = chartData.map((row) =>
      visibleCategories.reduce((s, c) => s + Number(row[c] ?? 0), 0)
    );
    return sums.reduce((a, b) => a + b, 0) / sums.length;
  }, [chartData, visibleCategories]);

  const maxMonthlyTotal = useMemo(() => {
    if (!chartData.length || !visibleCategories.length) return 0;
    return Math.max(
      ...chartData.map((row) =>
        visibleCategories.reduce((s, c) => s + Number(row[c] ?? 0), 0)
      )
    );
  }, [chartData, visibleCategories]);

  if (!visibleCategories.length) {
    return (
      <div className="flex h-[304px] min-h-[288px] items-center justify-center rounded-xl border border-dashed border-ink-200 bg-gradient-to-b from-ink-50/80 to-white px-4 text-center text-sm text-ink-500">
        Aucune catégorie visible : réactivez une catégorie dans la légende ou ajoutez des dépenses sur la période.
      </div>
    );
  }

  const clickable = Boolean(onMonthClick && chartData.some((r) => typeof r.monthKey === "string"));
  const topStackIndex = visibleCategories.length - 1;

  return (
    <div className={clickable ? "cursor-pointer" : ""}>
      <div style={{ height: CHART_H }} className="min-h-[288px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={CHART_H} minWidth={0}>
          <ComposedChart
            data={chartData}
            margin={{ top: 18, right: 8, left: -4, bottom: 6 }}
            barCategoryGap="16%"
          >
            <defs>
              {visibleCategories.map((cat, i) => {
                const c = expenseCategoryColor(cat);
                return (
                  <linearGradient
                    key={`g-${i}-${cat}`}
                    id={`exp-bar-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={c} stopOpacity={1} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.78} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" strokeOpacity={0.85} vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={(v) => (typeof v === "number" ? `${Math.round(v / 1000)}k` : "")}
              domain={[0, () => maxMonthlyTotal * 1.12]}
            />
            {avgMonthlyTotal > 0 && maxMonthlyTotal > 0 ? (
              <ReferenceLine
                y={avgMonthlyTotal}
                stroke="#94a3b8"
                strokeOpacity={0.9}
                strokeDasharray="5 5"
                ifOverflow="extendDomain"
              />
            ) : null}
            <Tooltip
              content={<StackedTooltip />}
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            />
            {visibleCategories.map((cat, i) => {
              const c = expenseCategoryColor(cat);
              const isTop = i === topStackIndex;
              return (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="exp"
                  fill={`url(#exp-bar-${i})`}
                  stroke={c}
                  strokeWidth={0.5}
                  strokeOpacity={0.35}
                  radius={isTop ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={52}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              );
            })}
            {clickable ? (
              <Bar
                dataKey="_tapTotal"
                fill="rgba(0,0,0,0)"
                stroke="transparent"
                maxBarSize={56}
                isAnimationActive={false}
                onClick={(cell: { payload?: StackedExpenseChartRow }) => {
                  const mk = cell?.payload?.monthKey;
                  if (typeof mk === "string") onMonthClick!(mk);
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {avgMonthlyTotal > 0 && chartData.length > 1 ? (
        <p className="mt-1.5 text-center text-[11px] font-medium text-slate-400">
          Colonnes empilées par catégorie · trait gris · moyenne mensuelle
        </p>
      ) : null}
    </div>
  );
}
