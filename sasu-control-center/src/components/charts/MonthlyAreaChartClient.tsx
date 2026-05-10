"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { MonthlyPoint } from "@/lib/mock-data";
import { formatEur, formatEurChartAxis } from "@/lib/format";

const CHART_H = 304;

const AXIS_TICK = { fill: "#6E6E73", fontSize: 11, fontWeight: 500 as const };
const GRID_STROKE = "#E8E8ED";

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
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm shadow-card ring-1 ring-black/[0.04]">
      <div className="font-semibold tracking-tight text-ink-900">{label}</div>
      <div className="mt-0.5 tabular-nums text-base font-medium text-ink-700">{formatEur(value)}</div>
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
  const gradientId = `area-fill-${color.stroke.replace(/[^a-z0-9]/gi, "")}`;
  const maxVal = Math.max(0, ...data.map((d) => d.value));
  const avgVal = data.length ? data.reduce((s, d) => s + d.value, 0) / data.length : 0;

  return (
    <div
      className={`rounded-2xl border border-ink-200/70 bg-gradient-to-b from-ink-50/80 via-white to-white p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] sm:p-3${clickable ? " cursor-pointer" : ""}`}
    >
      <div style={{ height: CHART_H }} className="min-h-[288px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={CHART_H} minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 18, right: 10, left: 4, bottom: 10 }}
            barCategoryGap="18%"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color.fill} stopOpacity={0.38} />
                <stop offset="45%" stopColor={color.fill} stopOpacity={0.14} />
                <stop offset="100%" stopColor={color.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke={GRID_STROKE} strokeOpacity={1} vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval="preserveStartEnd"
              tick={AXIS_TICK}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={58}
              tick={AXIS_TICK}
              tickFormatter={(v) => (typeof v === "number" ? formatEurChartAxis(v) : "")}
              domain={[0, () => (maxVal > 0 ? maxVal * 1.1 : 1)]}
            />
            {avgVal > 0 && maxVal > 0 ? (
              <ReferenceLine
                y={avgVal}
                stroke="#A1A1A6"
                strokeOpacity={0.95}
                strokeDasharray="4 6"
                ifOverflow="extendDomain"
              />
            ) : null}
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "#A1A1A6", strokeWidth: 1, strokeDasharray: "3 4" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color.stroke}
              strokeWidth={2.25}
              fill={`url(#${gradientId})`}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "#fff",
                fill: color.stroke
              }}
              animationDuration={650}
              animationEasing="ease-out"
            />
            {clickable ? (
              <Bar
                dataKey="value"
                fill="transparent"
                stroke="transparent"
                maxBarSize={44}
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
      {avgVal > 0 && data.length > 1 ? (
        <p className="mt-2 text-center text-[11px] font-medium text-ink-500">
          Trait gris · moyenne sur la période
        </p>
      ) : null}
    </div>
  );
}
