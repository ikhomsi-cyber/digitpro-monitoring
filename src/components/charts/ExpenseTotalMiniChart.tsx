"use client";

import { useId } from "react";
import { clsx } from "clsx";
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
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { maskMoneyAmount } from "@/lib/dummy-display-numbers";
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
  const fmt = useDashboardDisplayFormat();
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
      <div className={clsx("tabular-nums", isDark ? "text-ink-200" : "text-ink-700")}>{fmt.euro(value)}</div>
    </div>
  );
}

const STROKE = "#e11d48";

/**
 * Courbe compacte carte KPI — total des sorties par mois (toutes catégories).
 * Clic sur un mois : `onMonthClick(monthKey)` si `monthKey` est présent sur les points.
 */
export function ExpenseTotalMiniChart({
  data,
  ariaLabel,
  selectedMonthKey,
  onMonthClick
}: {
  data: MonthlyPoint[];
  ariaLabel: string;
  /** YYYY-MM — affiche un repère vertical sur le mois choisi (clic sur le graphique). */
  selectedMonthKey?: string | null;
  /** Filtre carte Total expenses sur le mois (YYYY-MM). Re-clic sur le même mois : à gérer côté parent si besoin. */
  onMonthClick?: (monthKey: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const fmt = useDashboardDisplayFormat();
  const gradientId = `expense-mini-${uid}`;
  const isDark = useRootIsDark();
  const gridStroke = isDark ? "#3f3f46" : "#e5e7eb";
  const tickFill = isDark ? "#a1a1aa" : "#86868B";
  const cursorStroke = isDark ? "#52525b" : "#D2D2D7";
  const clickable = Boolean(onMonthClick && data.some((d) => d.monthKey));
  const selectedTickLabel =
    selectedMonthKey && data.length
      ? data.find((d) => d.monthKey === selectedMonthKey)?.month
      : undefined;

  if (!data.length) return null;

  const step = data.length > 36 ? 6 : data.length > 18 ? 3 : data.length > 12 ? 2 : 1;

  return (
    <div
      className={`mt-3 w-full${clickable ? " cursor-pointer" : ""}`}
      data-private
      role="img"
      aria-label={ariaLabel}
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
          Évolution mensuelle
        </p>
        {clickable ? (
          <p className="text-[9px] font-medium normal-case tracking-normal text-ink-500 dark:text-ink-400">
            Clic sur un mois pour filtrer ou désactiver
          </p>
        ) : null}
      </div>
      <div className="h-[9rem] w-full sm:h-36">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 34 }}
            barCategoryGap="12%"
            // Évite tabIndex=0 sur le SVG (focus clavier / contour coloré au clic souris).
            accessibilityLayer={false}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STROKE} stopOpacity={0.26} />
                <stop offset="100%" stopColor={STROKE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              tickMargin={2}
              interval={step - 1}
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
              tickFormatter={(v) =>
                typeof v === "number"
                  ? formatCompactEur(fmt.dummy ? maskMoneyAmount(v) : v)
                  : ""
              }
            />
            <Tooltip content={<MiniTooltip />} cursor={{ stroke: cursorStroke, strokeWidth: 1 }} />
            {selectedTickLabel ? (
              <ReferenceLine
                x={selectedTickLabel}
                stroke={STROKE}
                strokeOpacity={0.45}
                strokeDasharray="4 3"
                ifOverflow="extendDomain"
              />
            ) : null}
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
            {clickable ? (
              <Bar
                dataKey="value"
                fill="transparent"
                stroke="transparent"
                maxBarSize={28}
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
