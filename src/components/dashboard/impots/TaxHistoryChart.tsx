"use client";

import { clsx } from "clsx";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { useRootIsDark } from "@/lib/use-root-is-dark";

export type TaxHistoryPoint = {
  year: number;
  label: string;
  impotTotal: number;
  tauxMoyen: number;
};

function formatCompactEur(value: number): string {
  const v = Math.abs(value);
  if (v >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}

const BAR_COLOR = "#f59e0b";
const LINE_COLOR = "#2dd4bf";

function HistoryTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: TaxHistoryPoint }>;
}) {
  const isDark = useRootIsDark();
  const fmt = useDashboardDisplayFormat();
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div
      className={clsx(
        "rounded-xl border px-3 py-2 text-xs shadow-card ring-1",
        isDark ? "border-cyan-100/[0.12] bg-[#0b3038] text-white ring-white/10" : "border-ink-200 bg-white ring-black/[0.04]"
      )}
    >
      <div className="font-bold">Revenus {point.year}</div>
      <div className="mt-1 flex items-center gap-2 tabular-nums">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLOR }} />
        Impôt : {fmt.euro(point.impotTotal)}
      </div>
      <div className="mt-0.5 flex items-center gap-2 tabular-nums">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
        Taux moyen : {point.tauxMoyen.toFixed(2)} %
      </div>
    </div>
  );
}

export function TaxHistoryChart({ data }: { data: TaxHistoryPoint[] }) {
  const fmt = useDashboardDisplayFormat();
  const isDark = useRootIsDark();
  const gridStroke = isDark ? "rgba(207,250,254,0.14)" : "#e5e7eb";
  const tickFill = isDark ? "rgba(236,254,255,0.6)" : "#86868B";
  const maxTaux = Math.max(20, ...data.map((d) => d.tauxMoyen)) * 1.25;

  if (!data.length) return null;

  return (
    <div className="h-64 w-full" data-private role="img" aria-label="Historique de l'impôt sur le revenu par année">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 6, left: 0, bottom: 6 }} barCategoryGap="28%" accessibilityLayer={false}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: gridStroke }}
            tickMargin={8}
            tick={{ fill: tickFill, fontSize: 11, fontWeight: 600 }}
          />
          <YAxis
            yAxisId="euro"
            tickLine={false}
            axisLine={false}
            width={38}
            tick={{ fill: tickFill, fontSize: 10 }}
            tickFormatter={(v) => (typeof v === "number" ? formatCompactEur(v) : "")}
          />
          <YAxis
            yAxisId="taux"
            orientation="right"
            domain={[0, maxTaux]}
            tickLine={false}
            axisLine={false}
            width={34}
            tick={{ fill: tickFill, fontSize: 10 }}
            tickFormatter={(v) => (typeof v === "number" ? `${Math.round(v)}%` : "")}
          />
          <Tooltip content={<HistoryTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }} />
          <Bar yAxisId="euro" dataKey="impotTotal" fill={BAR_COLOR} radius={[6, 6, 0, 0]} maxBarSize={54} isAnimationActive animationDuration={500} />
          <Line
            yAxisId="taux"
            type="monotone"
            dataKey="tauxMoyen"
            stroke={LINE_COLOR}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: LINE_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: LINE_COLOR, stroke: isDark ? "#0b3038" : "#fff", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={500}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[10px] font-medium text-ink-400 dark:text-white/40">
        Barres : impôt du foyer · Ligne : taux moyen d'imposition · {fmt.euro(data.at(-1)?.impotTotal ?? 0)} en {data.at(-1)?.year}
      </p>
    </div>
  );
}
