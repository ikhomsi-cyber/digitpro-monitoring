"use client";

import { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { expenseCategoryColor } from "@/lib/dashboard-metrics";
import { formatEur } from "@/lib/format";

export type StackedExpenseChartRow = Record<string, string | number>;

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
    <div className="rounded-xl border border-ink-200 bg-white/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
      <div className="font-medium text-ink-900">{label}</div>
      <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-4 text-xs text-ink-600">
            <span className="truncate font-medium" style={{ color: p.color }}>
              {String(p.dataKey)}
            </span>
            <span className="shrink-0 tabular-nums">{formatEur(Number(p.value))}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-ink-100 pt-1 text-xs font-medium text-ink-800">
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

  if (!visibleCategories.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-4 text-center text-sm text-ink-500">
        Aucune catégorie visible : réactivez une catégorie dans la légende ou ajoutez des dépenses sur la période.
      </div>
    );
  }

  const clickable = Boolean(onMonthClick && chartData.some((r) => typeof r.monthKey === "string"));

  return (
    <div className={`h-64 ${clickable ? "cursor-pointer" : ""}`}>
      <ResponsiveContainer width="100%" height="100%" minHeight={256} minWidth={0}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
          <defs>
            {visibleCategories.map((cat, i) => {
              const c = expenseCategoryColor(cat);
              return (
                <linearGradient key={`g-${i}-${cat}`} id={`exp-stack-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.38} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.04} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="6 6" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={50}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickFormatter={(v) => (typeof v === "number" ? `${Math.round(v / 1000)}k` : "")}
          />
          <Tooltip content={<StackedTooltip />} />
          {visibleCategories.map((cat, i) => {
            const c = expenseCategoryColor(cat);
            return (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stackId="exp"
                stroke={c}
                strokeWidth={1.5}
                fill={`url(#exp-stack-fill-${i})`}
                isAnimationActive={false}
              />
            );
          })}
          {clickable ? (
            <Bar
              dataKey="_tapTotal"
              fill="transparent"
              stroke="transparent"
              maxBarSize={48}
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
  );
}
