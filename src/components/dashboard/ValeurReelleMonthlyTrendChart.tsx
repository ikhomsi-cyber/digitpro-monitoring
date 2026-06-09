"use client";

import { useId } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import type {
  ValeurReelleMonthlyTrendPoint,
  ValeurReelleMonthlyTrendSeries
} from "@/lib/valeur-reelle-monthly-trend";
import { useRootIsDark } from "@/lib/use-root-is-dark";

function formatCompactEur(value: number): string {
  const v = Math.abs(value);
  if (v >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (v >= 10_000) return `${Math.round(value / 1000)}k`;
  if (v >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}

function xAxisTickStep(count: number): number {
  if (count <= 6) return 1;
  if (count <= 12) return 2;
  if (count <= 24) return 3;
  return 4;
}

function caBarFill(
  point: ValeurReelleMonthlyTrendPoint,
  gradId: string,
  isDark: boolean
): string {
  if (point.highlight === "best") return isDark ? "#059669" : "#10b981";
  if (point.highlight === "worst") return isDark ? "#e11d48" : "#fb7185";
  if (point.highlight === "selected") return `url(#${gradId}-selected)`;
  return `url(#${gradId})`;
}

function TrendTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: ValeurReelleMonthlyTrendPoint }>;
}) {
  const fmt = useDashboardDisplayFormat();
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const highlightLabel =
    point.highlight === "best"
      ? "Meilleur mois (net disponible)"
      : point.highlight === "worst"
        ? "Mois le plus faible (net disponible)"
        : point.highlight === "selected"
          ? "Mois filtré"
          : null;

  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs shadow-[0_18px_60px_-24px_rgba(0,0,0,0.35)] dark:border-cyan-100/[0.12] dark:bg-[#0b3038]/95 dark:shadow-none">
      <div className="font-semibold capitalize text-ink-900 dark:text-white">{point.fullLabel}</div>
      {highlightLabel ? (
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          {highlightLabel}
        </p>
      ) : null}
      <div className="mt-2 space-y-1 tabular-nums">
        <p className="text-ink-700 dark:text-white/75">
          <span className="font-medium text-ink-500 dark:text-white/45">CA HT :</span>{" "}
          <span className="font-bold text-ink-900 dark:text-white">{fmt.euro(point.caFactureEur)}</span>
        </p>
        <p className="text-ink-700 dark:text-white/75">
          <span className="font-medium text-ink-500 dark:text-white/45">Net disponible réel :</span>{" "}
          <span className="font-bold text-emerald-800 dark:text-emerald-200">
            {fmt.euro(point.netRetainedEur)}
          </span>
        </p>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-ink-500 dark:text-white/40">
        Net = BNC payé + frais perso réintégrés
      </p>
    </div>
  );
}

function netLineDot(props: {
  cx?: number;
  cy?: number;
  payload?: ValeurReelleMonthlyTrendPoint;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;

  const r = payload.highlight === "best" || payload.highlight === "worst" ? 5 : 3;
  const fill =
    payload.highlight === "best"
      ? "#10b981"
      : payload.highlight === "worst"
        ? "#f43f5e"
        : payload.highlight === "selected"
          ? "#38bdf8"
          : "#0ea5e9";
  const stroke = payload.highlight ? "#fff" : "transparent";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={payload.highlight ? 2 : 0}
    />
  );
}

export function ValeurReelleMonthlyTrendChart({ series }: { series: ValeurReelleMonthlyTrendSeries }) {
  const uid = useId().replace(/:/g, "");
  const caGradId = `valeur-ca-${uid}`;
  const isDark = useRootIsDark();
  const gridStroke = isDark ? "#3f3f46" : "#e5e7eb";
  const tickFill = isDark ? "#a1a1aa" : "#86868B";
  const { points, periodLabel, bestMonthKey, worstMonthKey } = series;

  if (!points.length) {
    return (
      <section className="rounded-[2rem] border border-dashed border-ink-200 bg-ink-50/40 px-4 py-6 text-center text-xs text-ink-500 dark:border-cyan-100/[0.12] dark:bg-cyan-50/[0.05] dark:text-white/45 sm:p-5">
        Aucune donnée mensuelle sur cette période.
      </section>
    );
  }

  const xTickStep = xAxisTickStep(points.length);
  const chartBottom = xTickStep === 1 ? 28 : 24;
  const xAxisAngle = xTickStep === 1 ? -40 : -32;
  const xAxisHeight = xTickStep === 1 ? 48 : 40;

  const bestLabel = bestMonthKey
    ? points.find((p) => p.monthKey === bestMonthKey)?.fullLabel
    : null;
  const worstLabel = worstMonthKey
    ? points.find((p) => p.monthKey === worstMonthKey)?.fullLabel
    : null;

  return (
    <section
      className="rounded-[2rem] border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-emerald-50/25 p-4 shadow-sm dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5"
      data-private
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-white/45">
            Tendance mensuelle
          </p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-ink-950 dark:text-white sm:text-xl">
            CA HT & net disponible réel
          </h2>
          <p className="mt-0.5 text-[11px] font-medium capitalize text-ink-500 dark:text-white/40">
            {periodLabel}
          </p>
        </div>
        {(bestLabel || worstLabel) && bestMonthKey !== worstMonthKey ? (
          <div className="flex flex-col items-end gap-1 text-[10px] font-semibold">
            {bestLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50/80 px-2.5 py-1 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                Meilleur : {bestLabel}
              </span>
            ) : null}
            {worstLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-50/80 px-2.5 py-1 text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200">
                <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
                Plus faible : {worstLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 8, left: 0, bottom: chartBottom }}
            barCategoryGap="18%"
          >
            <defs>
              <linearGradient id={caGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#64748b" : "#94a3b8"} stopOpacity={0.95} />
                <stop offset="100%" stopColor={isDark ? "#475569" : "#64748b"} stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id={`${caGradId}-selected`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={xTickStep - 1}
              angle={xAxisAngle}
              textAnchor="end"
              height={xAxisHeight}
              tick={{ fill: tickFill, fontSize: 9 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={42}
              tick={{ fill: tickFill, fontSize: 9 }}
              tickFormatter={(v) => (typeof v === "number" ? formatCompactEur(v) : "")}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => (
                <span className="text-ink-600 dark:text-white/55">{value}</span>
              )}
            />
            <Bar
              name="CA HT"
              dataKey="caFactureEur"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
              isAnimationActive={points.length < 24}
            >
              {points.map((point) => (
                <Cell key={point.monthKey} fill={caBarFill(point, caGradId, isDark)} />
              ))}
            </Bar>
            <Line
              name="Net disponible réel"
              type="monotone"
              dataKey="netRetainedEur"
              stroke="#0ea5e9"
              strokeWidth={2.5}
              dot={netLineDot}
              activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? "#0b3038" : "#fff", fill: "#0ea5e9" }}
              isAnimationActive={points.length < 24}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p
        className={clsx(
          "mt-3 text-[10px] leading-relaxed text-ink-500 dark:text-white/38",
          bestMonthKey === worstMonthKey && "hidden"
        )}
      >
        Meilleur et plus faible mois déterminés sur le{" "}
        <span className="font-semibold text-ink-600 dark:text-white/55">net disponible réel</span>{" "}
        (BNC + frais perso), hors mois sans activité.
      </p>
    </section>
  );
}
