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
    <div className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs shadow-md">
      <div className="font-medium capitalize text-ink-900">{p.label}</div>
      <div className="mt-1 tabular-nums text-ink-700">
        <span className="font-semibold text-emerald-800">{p.days} j.</span>
        <span className="text-ink-500"> imputés</span>
      </div>
      <div className="mt-0.5 text-[11px] text-ink-500">
        CA HT ({sourceLabel(p.sourceMonthKey)}) : {formatEur(p.caHt)}
      </div>
    </div>
  );
}

export function BillableInvoiceWorkedDaysChart({ data }: { data: InvoiceWorkedDayMonth[] }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `inv-days-${uid}`;

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/40 px-4 py-6 text-center text-xs text-ink-500">
        Aucun encaissement « Chiffre d’affaires » sur les mois passés pour ce périmètre.
      </div>
    );
  }

  return (
    <div className="w-full" data-private>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">
        Jours imputés (facturation)
      </p>
      <p className="mb-3 text-[10px] leading-snug text-ink-500">
        Chaque barre = mois M (complet passé) · jours = CA HT du mois <span className="font-medium">M − 2</span>{" "}
        (mois d’avant le précédent) ÷ {formatEur(BILLABLE_CLIENT_TJM_HT)} · TVA 20 %
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-40}
              textAnchor="end"
              height={48}
              tick={{ fill: "#86868B", fontSize: 9 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              tick={{ fill: "#86868B", fontSize: 9 }}
              allowDecimals
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(16, 185, 129, 0.08)" }} />
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
