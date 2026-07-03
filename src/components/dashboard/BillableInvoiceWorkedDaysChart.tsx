"use client";

import { useId, useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import type {
  InvoiceWorkedDayKind,
  InvoiceWorkedDayMonth
} from "@/lib/invoice-worked-days-series";
import { useRootIsDark } from "@/lib/use-root-is-dark";

const KIND_META: Record<
  InvoiceWorkedDayKind,
  { label: string; fill: string; fillDark: string; tooltipHint: string }
> = {
  encaisse: {
    label: "Encaissé",
    fill: "",
    fillDark: "",
    tooltipHint: "CA HT encaissé (mois B+2) ÷ TJM"
  },
  deja_facture: {
    label: "Déjà facturé",
    fill: "#38bdf8",
    fillDark: "#0ea5e9",
    tooltipHint: "Jours cochés dans l’agenda (mois dernier)"
  },
  a_facturer: {
    label: "À facturer",
    fill: "#a78bfa",
    fillDark: "#8b5cf6",
    tooltipHint: "CA prévu sur jours facturés cochés dans l’agenda"
  }
};

function sourceLabel(mk: string): string {
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(5, 7));
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1)
  );
}

function barFill(kind: InvoiceWorkedDayKind, gradId: string, isDark: boolean): string {
  if (kind === "encaisse") return `url(#${gradId})`;
  return isDark ? KIND_META[kind].fillDark : KIND_META[kind].fill;
}

/** Espacement des ticks X selon le nombre de mois (Recharts `interval` = step − 1). */
function xAxisTickStep(count: number): number {
  if (count <= 6) return 1;
  if (count <= 12) return 2;
  if (count <= 24) return 3;
  if (count <= 36) return 4;
  return 6;
}

function ChartTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: InvoiceWorkedDayMonth }>;
}) {
  const fmt = useDashboardDisplayFormat();
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const meta = KIND_META[p.kind];
  const toneClass =
    p.kind === "encaisse"
      ? "text-emerald-800 dark:text-emerald-300"
      : p.kind === "deja_facture"
        ? "text-sky-800 dark:text-sky-300"
        : "text-violet-800 dark:text-violet-300";

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs shadow-md dark:border-cyan-100/[0.12] dark:bg-[#0b3038]/95 dark:shadow-none">
      <div className="font-medium capitalize text-ink-900 dark:text-ink-50">{p.label}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {meta.label}
      </div>
      {p.kind !== "a_facturer" ? (
        <div className="mt-1 tabular-nums text-ink-700 dark:text-ink-300">
          <span className={`font-semibold ${toneClass}`}>{fmt.int(p.days)} j.</span>
        </div>
      ) : null}
      <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">{meta.tooltipHint}</div>
      {p.kind === "encaisse" ? (
        <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
          CA HT ({sourceLabel(p.sourceMonthKey)}) : {fmt.euro(p.caHt)}
        </div>
      ) : p.kind === "a_facturer" && p.plannedCaHt != null && p.plannedDays != null ? (
        <div className="mt-0.5 text-[11px] font-semibold text-violet-800 dark:text-violet-300">
          CA prévu : {fmt.euro(p.plannedCaHt)} HT · {fmt.int(p.plannedDays)} j. facturés
        </div>
      ) : (
        <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
          CA HT estimé : {fmt.euro(p.caHt)}
        </div>
      )}
      <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
        TJM en vigueur : {fmt.euro(p.tjmHt)} HT
      </div>
    </div>
  );
}

function ChartLegend({ isDark }: { isDark: boolean }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-ink-600 dark:text-ink-400">
      {(Object.keys(KIND_META) as InvoiceWorkedDayKind[]).map((kind) => {
        const meta = KIND_META[kind];
        const swatch =
          kind === "encaisse"
            ? "bg-gradient-to-b from-emerald-400 to-emerald-600"
            : kind === "deja_facture"
              ? isDark
                ? "bg-sky-500"
                : "bg-sky-400"
              : isDark
                ? "bg-violet-500"
                : "bg-violet-400";
        return (
          <li key={kind} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${swatch}`} aria-hidden />
            <span>{meta.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function BillableInvoiceWorkedDaysChart({
  data,
  averageDaysPerMonth,
  monthsInView,
  totalWorkedDaysInPeriod,
  periodLabel,
  emptyHint = "default"
}: {
  data: InvoiceWorkedDayMonth[];
  /** Moyenne arithmétique des jours encaissés (barres « Encaissé » uniquement). */
  averageDaysPerMonth: number | null;
  monthsInView: number;
  /** Somme des jours des barres affichées par le filtre axe B. */
  totalWorkedDaysInPeriod: number;
  /** Libellé de période (ex. « 2026 », « T1 2026 »). */
  periodLabel: string;
  /** Message vide si le filtre année/trimestre exclut toutes les barres. */
  emptyHint?: "default" | "filter";
}) {
  const fmt = useDashboardDisplayFormat();
  const uid = useId().replace(/:/g, "");
  const gradId = `inv-grad-encaisse-${uid}`;
  const isDark = useRootIsDark();
  const tickFill = isDark ? "#a1a1aa" : "#86868B";

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/40 px-4 py-6 text-center text-xs text-ink-500 dark:border-cyan-100/[0.12] dark:bg-cyan-50/[0.05] dark:text-ink-400">
        {emptyHint === "filter"
          ? "Aucune donnée pour ce filtre (année ou trimestre)."
          : "Aucun encaissement « Chiffre d’affaires » sur la période pour ce périmètre."}
      </div>
    );
  }

  const xTickStep = xAxisTickStep(data.length);
  const xTickInterval = xTickStep - 1;
  const chartBottom = xTickStep === 1 ? 28 : xTickStep <= 3 ? 24 : 20;
  const xAxisAngle = xTickStep === 1 ? -40 : xTickStep <= 2 ? -35 : -30;
  const xAxisHeight = xTickStep === 1 ? 48 : xTickStep <= 3 ? 42 : 36;

  const generatedCaHt = useMemo(
    () =>
      Math.round(
        data
          .filter((row) => row.kind === "encaisse" || row.kind === "deja_facture")
          .reduce((sum, row) => sum + row.caHt, 0) * 100
      ) / 100,
    [data]
  );

  return (
    <div className="w-full" data-private>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/85">
        Jours facturés
      </p>
      <p className="mb-1.5 text-[11px] font-semibold tabular-nums text-ink-900 dark:text-ink-100">
        Jours travaillés affichés : {fmt.int(totalWorkedDaysInPeriod)} j.{" "}
        <span className="font-normal text-ink-500 dark:text-ink-400">({periodLabel})</span>
      </p>
      {averageDaysPerMonth != null && monthsInView > 0 ? (
        <p className="mb-1.5 text-[11px] font-medium tabular-nums text-emerald-900/90 dark:text-emerald-200/90">
          Moyenne encaissé : {fmt.int(averageDaysPerMonth)} j. / mois{" "}
          <span className="font-normal text-ink-500 dark:text-ink-400">
            ({fmt.int(monthsInView)} mois encaissé{monthsInView > 1 ? "s" : ""})
          </span>
        </p>
      ) : null}
      {generatedCaHt > 0 ? (
        <p className="mb-1.5 text-[11px] font-semibold tabular-nums text-ink-900 dark:text-ink-100">
          CA généré : {fmt.euro(generatedCaHt)} HT{" "}
          <span className="font-normal text-ink-500 dark:text-ink-400">
            · encaissé + déjà facturé · {periodLabel}
          </span>
        </p>
      ) : null}
      <div className="h-[11.5rem] w-full sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: chartBottom }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={xTickInterval}
              angle={xAxisAngle}
              textAnchor="end"
              height={xAxisHeight}
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
              cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
            />
            <Bar
              dataKey="days"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
              isAnimationActive={data.length < 30}
            >
              {data.map((entry) => (
                <Cell key={entry.monthKey} fill={barFill(entry.kind, gradId, isDark)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend isDark={isDark} />
    </div>
  );
}
