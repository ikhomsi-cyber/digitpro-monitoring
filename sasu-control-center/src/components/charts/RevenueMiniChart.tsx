"use client";

import { useId } from "react";
import { clsx } from "clsx";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { MonthlyPoint } from "@/lib/mock-data";
import { formatEur } from "@/lib/format";
import { useRootIsDark } from "@/lib/use-root-is-dark";

function formatCompactEur(value: number): string {
  const v = Math.abs(value);
  if (v >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (v >= 10_000) return `${Math.round(value / 1000)}k`;
  if (v >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}

function MiniTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  const isDark = useRootIsDark();
  if (!active || !payload?.length) return null;
  const value = typeof payload[0]?.value === "number" ? payload[0].value : 0;
  return (
    <div
      className={clsx(
        "rounded-lg border px-2 py-1.5 text-xs shadow-card ring-1",
        isDark
          ? "border-ink-600 bg-ink-900 text-ink-100 ring-white/10"
          : "border-ink-200 bg-white ring-black/[0.04]"
      )}
    >
      <div className="font-medium">{label}</div>
      <div className={clsx("tabular-nums", isDark ? "text-ink-200" : "text-ink-700")}>{formatEur(value)}</div>
    </div>
  );
}

const STROKE = "#0071E3";

/**
 * Courbe compacte pour une carte KPI (évolution du revenu par mois).
 */
export function RevenueMiniChart({
  data,
  ariaLabel
}: {
  data: MonthlyPoint[];
  /** Libellé pour lecteurs d’écran */
  ariaLabel: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `revenue-mini-${uid}`;
  const isDark = useRootIsDark();
  const gridStroke = isDark ? "#3f3f46" : "#e5e7eb";
  const tickFill = isDark ? "#a1a1aa" : "#86868B";
  const cursorStroke = isDark ? "#52525b" : "#D2D2D7";

  if (!data.length) return null;

  return (
    <div
      className="mt-3 w-full"
      data-private
      role="img"
      aria-label={ariaLabel}
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
        Évolution mensuelle (HT)
      </p>
      <div className="h-[9rem] w-full sm:h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 34 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STROKE} stopOpacity={0.28} />
                <stop offset="100%" stopColor={STROKE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              tickMargin={2}
              interval={0}
              angle={-35}
              textAnchor="end"
              tick={{ fill: tickFill, fontSize: 8 }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              width={34}
              tickMargin={6}
              tick={{ fill: tickFill, fontSize: 8 }}
              tickFormatter={formatCompactEur}
            />
            <Tooltip content={<MiniTooltip />} cursor={{ stroke: cursorStroke, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={STROKE}
              strokeWidth={1.75}
              fill={`url(#${gradientId})`}
              isAnimationActive={data.length < 24}
              animationDuration={400}
              dot={false}
              activeDot={{
                r: 3,
                strokeWidth: 1.5,
                stroke: isDark ? "#27272a" : "#fff",
                fill: STROKE
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
