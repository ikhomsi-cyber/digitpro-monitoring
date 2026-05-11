"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatEur } from "@/lib/format";
import type { InvoiceWorkedDayMonth } from "@/lib/invoice-worked-days-series";
import { BILLABLE_CLIENT_TJM_HT } from "@/lib/billable-client-days";
import { useRootIsDark } from "@/lib/use-root-is-dark";

function sourceLabel(mk: string): string {
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(5, 7));
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1)
  );
}

function ChartTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: InvoiceWorkedDayMonth }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs shadow-md dark:border-ink-600 dark:bg-ink-900 dark:shadow-none">
      <div className="font-medium capitalize text-ink-900 dark:text-ink-50">{p.label}</div>
      <div className="mt-1 tabular-nums text-ink-700 dark:text-ink-300">
        <span className="font-semibold text-emerald-800 dark:text-emerald-300">{p.days} j.</span>
        <span className="text-ink-500 dark:text-ink-400"> facturés</span>
      </div>
      <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
        CA HT ({sourceLabel(p.sourceMonthKey)}) : {formatEur(p.caHt)}
      </div>
    </div>
  );
}

export function BillableInvoiceWorkedDaysChart({
  data,
  averageDaysPerMonth,
  monthsInView,
  emptyHint = "default"
}: {
  data: InvoiceWorkedDayMonth[];
  /** Moyenne arithmétique des jours facturés sur les mois affichés (barres du filtre). */
  averageDaysPerMonth: number | null;
  monthsInView: number;
  /** Message vide si le filtre année/trimestre exclut toutes les barres. */
  emptyHint?: "default" | "filter";
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `inv-days-${uid}`;
  const isDark = useRootIsDark();
  const gridStroke = isDark ? "#3f3f46" : "#e5e7eb";
  const tickFill = isDark ? "#a1a1aa" : "#86868B";

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/40 px-4 py-6 text-center text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-900/50 dark:text-ink-400">
        {emptyHint === "filter"
          ? "Aucune donnée pour ce filtre (année ou trimestre)."
          : "Aucun encaissement « Chiffre d’affaires » sur la période pour ce périmètre."}
      </div>
    );
  }

  return (
    <div className="w-full" data-private>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/85">
        Jours facturés
      </p>
      {averageDaysPerMonth != null && monthsInView > 0 ? (
        <p className="mb-1.5 text-[11px] font-medium tabular-nums text-emerald-900/90 dark:text-emerald-200/90">
          Moyenne : {averageDaysPerMonth} j. / mois{" "}
          <span className="font-normal text-ink-500 dark:text-ink-400">
            ({monthsInView} mois affiché{monthsInView > 1 ? "s" : ""})
          </span>
        </p>
      ) : null}
      <p className="mb-3 text-[10px] leading-snug text-ink-500 dark:text-ink-400">
        Chaque barre = mois <span className="font-medium">B</span> sur l’axe · jours = CA HT encaissé en{" "}
        <span className="font-medium">B + 2</span> (ex. encaissement avril → barre février) ÷{" "}
        {formatEur(BILLABLE_CLIENT_TJM_HT)} · TVA 20 % · mois en cours inclus (partiel)
      </p>
      <div className="h-[11.5rem] w-full sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 28 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-40}
              textAnchor="end"
              height={48}
              tick={{ fill: tickFill, fontSize: 9 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              tick={{ fill: tickFill, fontSize: 9 }}
              allowDecimals
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                fill: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.08)"
              }}
            />
            <Bar
              dataKey="days"
              fill={`url(#${gradId})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
              isAnimationActive={data.length < 30}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
