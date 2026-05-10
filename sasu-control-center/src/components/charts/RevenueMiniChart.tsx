"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { MonthlyPoint } from "@/lib/mock-data";
import { formatEur } from "@/lib/format";

function MiniTooltip({
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
    <div className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs shadow-card ring-1 ring-black/[0.04]">
      <div className="font-medium text-ink-900">{label}</div>
      <div className="tabular-nums text-ink-700">{formatEur(value)}</div>
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

  if (!data.length) return null;

  return (
    <div
      className="mt-3 w-full"
      data-private
      role="img"
      aria-label={ariaLabel}
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-400">
        Évolution mensuelle (HT)
      </p>
      <div className="h-[7.25rem] w-full sm:h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 36 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STROKE} stopOpacity={0.28} />
                <stop offset="100%" stopColor={STROKE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={2}
              interval={0}
              angle={-35}
              textAnchor="end"
              tick={{ fill: "#86868B", fontSize: 8 }}
            />
            <Tooltip content={<MiniTooltip />} cursor={{ stroke: "#D2D2D7", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={STROKE}
              strokeWidth={1.75}
              fill={`url(#${gradientId})`}
              isAnimationActive={data.length < 24}
              animationDuration={400}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 1.5, stroke: "#fff", fill: STROKE }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
