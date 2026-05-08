"use client";

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
import type { MonthlyPoint } from "@/lib/mock-data";
import { formatEur } from "@/lib/format";

function ChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = typeof payload[0]?.value === "number" ? payload[0].value : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
      <div className="font-medium text-slate-900">{label}</div>
      <div className="text-slate-600">{formatEur(value)}</div>
    </div>
  );
}

export function MonthlyAreaChartClient({
  data,
  color,
  onMonthClick
}: {
  data: MonthlyPoint[];
  color: { stroke: string; fill: string };
  /** Clic sur un mois (surface invisible au-dessus des colonnes). */
  onMonthClick?: (monthKey: string) => void;
}) {
  const clickable = Boolean(onMonthClick && data.some((d) => d.monthKey));

  return (
    <div className={clickable ? "cursor-pointer" : undefined}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" minHeight={256} minWidth={0}>
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${color.stroke}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color.fill} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color.fill} stopOpacity={0.02} />
              </linearGradient>
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
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color.stroke}
              strokeWidth={2}
              fill={`url(#fill-${color.stroke})`}
            />
            {clickable ? (
              <Bar
                dataKey="value"
                fill="transparent"
                stroke="transparent"
                maxBarSize={48}
                isAnimationActive={false}
                onClick={(cell: { payload?: MonthlyPoint }) => {
                  const mk = cell?.payload?.monthKey;
                  if (mk) onMonthClick!(mk);
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
