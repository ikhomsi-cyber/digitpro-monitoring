"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { CalendarDays, LineChart, PiggyBank, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DashboardPeriodFilterSection } from "@/components/dashboard/DashboardPeriodFilterSection";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  buildDashboardMonthOptions,
  buildDashboardYearOptions,
  defaultDashboardPeriodFilter,
  toggleDashboardYearInFilter
} from "@/lib/dashboard-period";
import { useBillableActivityOptional } from "@/components/dashboard/BillableActivityContext";
import { BILLABLE_CLIENT_TJM_HT, resolveBillableTjmForClientMonth } from "@/lib/billable-client-days";
import { dashboardMonthKeyNowLocal } from "@/lib/dashboard-period";
import { ValeurReelleDailyValueCard } from "@/components/dashboard/ValeurReelleDailyValueCard";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import {
  analyzeValeurReelle,
  computeVatSavingsKpis,
  VALEUR_REELLE_EXPENSE_CATEGORIES,
  type ValeurReelleVatSavingsKpis
} from "@/lib/valeur-reelle-analyze";
import {
  estimateCurrentMonthGainPerWorkDay,
  type GainPerWorkDayEstimate
} from "@/lib/valeur-reelle-gain-per-day";
import type {
  ValeurReelleCashTree,
  ValeurReelleVatLiability,
  ValeurReelleVatMonthlyRow,
  ValeurReelleWaterfallBreakdownRow
} from "@/lib/valeur-reelle-analyze";
import { ValeurReellePer100AllocationCard } from "@/components/dashboard/ValeurReellePer100AllocationCard";
import { ValeurReelleMonthlyTrendChart } from "@/components/dashboard/ValeurReelleMonthlyTrendChart";
import { ValeurReelleWaterfallChart } from "@/components/dashboard/ValeurReelleWaterfallChart";
import { buildValeurReelleMonthlyTrendSeries } from "@/lib/valeur-reelle-monthly-trend";

const MANDATORY_FEES_COLORS = [
  "#fb7185",
  "#f97316",
  "#ef4444",
  "#f43f5e",
  "#f59e0b",
  "#fdba74",
  "#fecdd3",
  "#b91c1c"
];

const PERSONAL_CHARGES_COLORS = [
  "#10b981",
  "#34d399",
  "#2dd4bf",
  "#14b8a6",
  "#22c55e",
  "#84cc16",
  "#a3e635",
  "#6ee7b7"
];

const RECOVERABLE_VAT_COLORS = [
  "#10b981",
  "#14b8a6",
  "#2dd4bf",
  "#34d399",
  "#5eead4",
  "#6ee7b7"
];

function formatVatReferenceMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

function VatSavingsMetricTile({
  label,
  value,
  sublabel,
  icon: Icon,
  emphasized = false
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: typeof LineChart;
  emphasized?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-3.5",
        emphasized
          ? "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/10"
          : "border-ink-200/75 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.04]"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={clsx(
            "h-3.5 w-3.5",
            emphasized ? "text-emerald-600 dark:text-emerald-300" : "text-ink-500 dark:text-white/45"
          )}
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/45">
          {label}
        </p>
      </div>
      <p
        className={clsx(
          "mt-2 font-display font-bold tabular-nums",
          emphasized
            ? "text-xl text-emerald-900 dark:text-emerald-100 sm:text-2xl"
            : "text-lg text-ink-900 dark:text-white sm:text-xl"
        )}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-[10px] font-medium text-ink-500 dark:text-white/40">{sublabel}</p>
      ) : null}
    </div>
  );
}

function cleanTransactionLabel(raw: string, company?: string): string {
  const cleaned = (raw || "")
    .replace(/\b(carte|cb|card)\b(?:\s+\d{2,})?/gi, " ")
    .replace(/\b\d{2}([./-]\d{2}){1,2}\b/g, " ")
    .replace(/\bcompte principal\s*\(qonto\)\b/gi, " ")
    .replace(/\bqonto\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—·:]+|[\s\-–—·:]+$/g, "")
    .trim();
  return cleaned || company || raw;
}

function formatTransactionDate(raw: string): string {
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function shouldShowHtTtc(label: string): boolean {
  const n = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return !(
    n.includes("kilomet") ||
    n.includes("urssaf") ||
    n.includes("retraite") ||
    n.includes("assurance")
  );
}

function BreakdownPieChart({
  breakdown,
  fmt,
  palette,
  recategorizeOptions,
  onRecategorized,
  showDetailToggle = true
}: {
  breakdown: ValeurReelleWaterfallBreakdownRow[];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  palette: readonly string[];
  recategorizeOptions?: readonly string[];
  onRecategorized?: (transactionId: string, category: string) => void;
  showDetailToggle?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [openCategoryLabel, setOpenCategoryLabel] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const total = breakdown.reduce((sum, row) => sum + Math.abs(row.amountEur), 0);
  if (total <= 0) return null;

  const pct = (amount: number) => Math.round((Math.abs(amount) / total) * 1000) / 10;
  const circumference = 2 * Math.PI * 50;
  let cursor = 0;
  const slices = breakdown.map((row, index) => {
    const ratio = Math.abs(row.amountEur) / total;
    const start = cursor;
    const dash = Math.max(0, ratio * circumference - 1.5);
    cursor += ratio * circumference;
    return {
      row,
      color: palette[index % palette.length],
      dash,
      offset: -start,
      percent: pct(row.amountEur)
    };
  });

  async function saveCategory(transactionId: string, category: string) {
    setPendingId(transactionId);
    try {
      const res = await fetch("/api/categorisation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transactionId, category })
      });
      const body = (await res.json().catch(() => null)) as null | { ok?: boolean; error?: string };
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Impossible d’enregistrer");
      toast.success("Catégorie mise à jour");
      onRecategorized?.(transactionId, category);
    } catch (error) {
      toast.error("Catégorisation impossible", {
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="relative overflow-hidden rounded-full border border-white/70 bg-ink-100 p-1 shadow-inner dark:border-cyan-100/[0.10] dark:bg-[#06242b]/70">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/10 dark:from-white/10" aria-hidden />
        <div className="relative flex h-5 overflow-hidden rounded-full">
          {slices.map((slice) => (
            <span
              key={`bar-${slice.row.label}`}
              className="h-full"
              style={{ width: `${slice.percent}%`, backgroundColor: slice.color }}
              aria-hidden
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 200 200" role="img" aria-label="Répartition par catégorie" className="block h-64 w-64 max-w-full">
            <defs>
              <filter id="breakdown-pie-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.18" />
              </filter>
            </defs>
            <circle cx="100" cy="100" r="58" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="16" />
            {slices.map((slice) => (
              <circle
                key={`slice-${slice.row.label}`}
                cx="100"
                cy="100"
                r="58"
                fill="none"
                stroke={slice.color}
                strokeWidth="16"
                strokeDasharray={`${slice.dash} ${circumference}`}
                strokeDashoffset={slice.offset}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                filter="url(#breakdown-pie-shadow)"
              />
            ))}
            <text x="100" y="97" textAnchor="middle" className="fill-ink-900 text-[13px] font-bold tabular-nums dark:fill-white">
              {fmt.euro(total)}
            </text>
            <text x="100" y="114" textAnchor="middle" className="fill-ink-400 text-[8px] font-semibold uppercase tracking-[0.14em] dark:fill-white/45">
              total
            </text>
          </svg>
          <div className="mb-3 grid w-full max-w-md grid-cols-2 gap-1.5">
            {slices.slice(0, 6).map((slice) => (
              <span
                key={`compact-legend-${slice.row.label}`}
                className="group/legend relative inline-flex min-w-0 items-center gap-1.5 rounded-full border border-ink-200/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65"
                title={`${slice.row.label} · ${slice.percent} % · ${fmt.euro(slice.row.amountEur)}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
                <span className="truncate">{slice.row.label}</span>
                <span className="shrink-0 text-ink-500 dark:text-white/45">
                  · {fmt.euro(slice.row.amountEur)} · {slice.percent} %
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-center text-[11px] font-bold text-ink-800 opacity-0 shadow-[0_18px_60px_-24px_rgba(0,0,0,0.35)] transition group-hover/legend:block group-hover/legend:opacity-100 dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:text-white/80">
                  {slice.row.label} · {fmt.euro(slice.row.amountEur)} · {slice.percent} %
                </span>
              </span>
            ))}
            {slices.length > 6 ? (
              <span className="inline-flex min-w-0 items-center rounded-full border border-ink-200/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-ink-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
                +{slices.length - 6}
              </span>
            ) : null}
          </div>
          {showDetailToggle ? (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex h-9 items-center justify-center rounded-full border border-ink-200 bg-white/70 px-4 text-xs font-bold text-ink-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70 dark:hover:bg-white/[0.08]"
              aria-expanded={showDetails}
            >
              {showDetails ? "Masquer le détail" : "Afficher le détail"}
            </button>
          ) : null}
        </div>
        {showDetails && showDetailToggle ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {slices.map((slice) => {
            const transactions = slice.row.transactions ?? [];
            const hasTransactions = transactions.length > 0;
            const isOpen = openCategoryLabel === slice.row.label;
            const showHtTtc = shouldShowHtTtc(slice.row.label);
            const grossAmountEur = slice.row.grossAmountEur ?? slice.row.amountEur;
            return (
            <div
              key={`legend-${slice.row.label}`}
              className={clsx(
                "min-w-0 rounded-xl bg-white/40 px-3 py-2 ring-1 ring-ink-100/60 dark:bg-white/[0.035] dark:ring-white/[0.05]",
                isOpen && hasTransactions && "sm:col-span-2"
              )}
            >
              <button
                type="button"
                onClick={() =>
                  hasTransactions
                    ? setOpenCategoryLabel((current) => (current === slice.row.label ? null : slice.row.label))
                    : undefined
                }
                className={clsx(
                  "flex w-full items-center justify-between gap-2 text-left",
                  hasTransactions && "cursor-pointer"
                )}
                aria-expanded={hasTransactions ? isOpen : undefined}
              >
                <span className="min-w-0 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-700 dark:text-white/70">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
                  <span className="truncate">{slice.row.label}</span>
                  {hasTransactions ? (
                    <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500 dark:bg-white/[0.06] dark:text-white/45">
                      {isOpen ? "Masquer" : "Voir"} {transactions.length}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink-950 dark:text-white">
                  {slice.percent} %
                </span>
              </button>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-200/55 dark:bg-[#06242b]/65">
                <span className="block h-full rounded-full" style={{ width: `${slice.percent}%`, backgroundColor: slice.color }} aria-hidden />
              </div>
              <div className="mt-1 text-right text-xs font-semibold tabular-nums text-ink-500 dark:text-white/40">
                {showHtTtc ? (
                  <>
                    <p>HT {fmt.euro(slice.row.amountEur)}</p>
                    <p className="text-[10px] font-medium">TTC {fmt.euro(grossAmountEur)}</p>
                  </>
                ) : (
                  <p>{fmt.euro(slice.row.amountEur)}</p>
                )}
              </div>
              {isOpen && hasTransactions ? (
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="rounded-xl border border-ink-100 bg-white/70 p-2.5 dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.05]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-ink-900 dark:text-white">
                            {cleanTransactionLabel(tx.label, tx.company)}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium text-ink-500 dark:text-white/40">
                            {formatTransactionDate(tx.date)} · {tx.category || "Sans catégorie"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs font-bold tabular-nums text-ink-700 dark:text-white/70">
                          {showHtTtc ? (
                            <>
                              <p>HT {fmt.euro(tx.amountEur)}</p>
                              <p className="text-[10px] font-medium text-ink-500 dark:text-white/40">
                                TTC {fmt.euro(tx.grossAmountEur ?? tx.amountEur)}
                              </p>
                            </>
                          ) : (
                            <p>{fmt.euro(tx.amountEur)}</p>
                          )}
                        </div>
                      </div>
                      {recategorizeOptions?.length ? (
                        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                          {recategorizeOptions.map((category) => (
                            <button
                              key={`${tx.id}-${category}`}
                              type="button"
                              disabled={pendingId === tx.id}
                              onClick={() => saveCategory(tx.id, category)}
                              className="shrink-0 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[10px] font-bold text-ink-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65 dark:hover:bg-emerald-500/10"
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
          })}
        </div>
        ) : null}
      </div>
    </div>
  );
}

function CashFlowTreeVisual({
  tree,
  fmt,
  billableDays,
  gainPerWorkDayEstimate,
  periodLabel,
  tjmHt,
  onRecategorized
}: {
  tree: ValeurReelleCashTree;
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  billableDays: number;
  /** Mois en cours : estimation historique + jours ouvrés cochés jusqu'à aujourd'hui. */
  gainPerWorkDayEstimate: GainPerWorkDayEstimate | null;
  periodLabel: string;
  tjmHt: number;
  onRecategorized?: (transactionId: string, category: string) => void;
}) {
  const isCurrentMonthEstimate = gainPerWorkDayEstimate != null;
  const gainDayDenominator = isCurrentMonthEstimate
    ? gainPerWorkDayEstimate.workedDays
    : billableDays;
  const formattedGainDayDenominator = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: isCurrentMonthEstimate ? 0 : 1
  }).format(gainDayDenominator);
  const netDisponibleReel = tree.bncEur + tree.personalChargesEur;
  const netDisponiblePctCa =
    tree.caFactureEur > 0 ? Math.round((netDisponibleReel / tree.caFactureEur) * 1000) / 10 : null;
  const reelParJour = isCurrentMonthEstimate
    ? gainPerWorkDayEstimate.gainPerDayEur
    : gainDayDenominator > 0
      ? Math.round((netDisponibleReel / gainDayDenominator) * 100) / 100
      : null;
  const percentOfCa = (amount: number) =>
    tree.caFactureEur > 0 ? Math.round((amount / tree.caFactureEur) * 1000) / 10 : 0;

  const rows: Array<{
    icon?: string;
    label: string;
    detail?: string;
    amount: number | null;
    gaugeAmount?: number;
    breakdown?: ValeurReelleWaterfallBreakdownRow[];
    showBreakdownPie?: boolean;
    breakdownPalette?: readonly string[];
    recategorizeOptions?: readonly string[];
    tone: "neutral" | "deduct" | "result" | "highlight";
    emphasize?: boolean;
  }> = [
    {
      icon: "💶",
      label: "CA facturé HT",
      detail: `TTC encaissé ${fmt.euro(tree.caTtcEur)} / 1,20`,
      amount: tree.caFactureEur,
      gaugeAmount: tree.caFactureEur,
      tone: "neutral"
    },
    {
      icon: "📋",
      label: "CSG",
      detail: "9,7 % de (CA HT − frais obligatoires − charges perso)",
      amount: -tree.csgEur,
      gaugeAmount: tree.csgEur,
      tone: "deduct"
    },
    {
      icon: "🧾",
      label: "Frais DigitPro",
      amount: -tree.mandatoryFeesEur,
      gaugeAmount: tree.mandatoryFeesEur,
      breakdown: tree.mandatoryFeesBreakdown,
      showBreakdownPie: true,
      breakdownPalette: MANDATORY_FEES_COLORS,
      recategorizeOptions: VALEUR_REELLE_EXPENSE_CATEGORIES,
      tone: "deduct"
    },
    {
      icon: "🏠",
      label: "Frais perso",
      amount: -tree.personalChargesEur,
      gaugeAmount: tree.personalChargesEur,
      breakdown: tree.personalChargesBreakdown,
      showBreakdownPie: true,
      breakdownPalette: PERSONAL_CHARGES_COLORS,
      recategorizeOptions: VALEUR_REELLE_EXPENSE_CATEGORIES,
      tone: "deduct"
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-[2rem] border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-emerald-50/30 p-4 shadow-sm dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5"
    >
      <div className="mb-5 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-50/60 via-white/80 to-white/40 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-emerald-400/20 dark:from-emerald-500/[0.12] dark:via-[#0b3038]/40 dark:to-[#06242b]/30 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-5 sm:py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/40">
          {periodLabel}
        </p>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
          Net disponible réel
        </p>
        <p className="mt-1 font-display text-4xl font-semibold leading-[1.05] tracking-apple-tight tabular-nums text-ink-950 dark:text-white sm:text-5xl md:text-6xl">
          {fmt.euro(netDisponibleReel)}
        </p>
        {netDisponiblePctCa != null ? (
          <p className="mt-2 text-sm font-semibold tabular-nums text-ink-700 dark:text-white/75">
            <span className="text-emerald-700 dark:text-emerald-300">{netDisponiblePctCa} %</span>
            {" "}du CA HT
          </p>
        ) : null}
        {reelParJour != null ? (
          <p className="mt-3 text-sm font-medium text-ink-600 dark:text-white/60">
            <span className="font-semibold text-ink-700 dark:text-white/75">Gain moyen :</span>{" "}
            <span className="font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
              {fmt.euro(reelParJour)}/jour
            </span>
            <span className="text-[11px] text-ink-500 dark:text-white/40">
              {" "}
              ·{" "}
              {isCurrentMonthEstimate ? (
                gainPerWorkDayEstimate.workedDays > 0 ? (
                  <>
                    {formattedGainDayDenominator} jour{gainDayDenominator > 1 ? "s" : ""} travaillé
                    {gainDayDenominator > 1 ? "s" : ""}
                    {gainPerWorkDayEstimate.usesHistoricalEstimate ? " · estimé sur historique" : null}
                  </>
                ) : (
                  "estimation sur historique"
                )
              ) : (
                `${formattedGainDayDenominator} jour${gainDayDenominator > 1 ? "s" : ""} facturé${gainDayDenominator > 1 ? "s" : ""}`
              )}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-[11px] font-medium leading-snug text-ink-500 dark:text-white/40">
            Cochez vos jours travaillés sur le dashboard pour le gain moyen / jour.
          </p>
        )}
      </div>

      <ValeurReelleDailyValueCard
        tree={tree}
        fmt={fmt}
        tjmHt={tjmHt}
        billableDays={billableDays}
        gainPerWorkDayEstimate={gainPerWorkDayEstimate}
      />

      <div className="mb-4">
        <ValeurReelleWaterfallChart tree={tree} fmt={fmt} />
      </div>

      <div className="space-y-2 text-[12px] leading-relaxed sm:text-[13px]">
        {rows.map((row, i) => {
          if (row.amount === null) {
            return null;
          }

          const amountClass =
            row.tone === "deduct"
              ? "text-rose-700 dark:text-rose-300"
              : row.tone === "highlight"
                ? "text-emerald-700 dark:text-emerald-300"
                : row.tone === "result"
                  ? "text-sky-800 dark:text-sky-200"
                  : "text-ink-900 dark:text-white";

          return (
            <div
              key={`${row.label}-${i}`}
              className={clsx(
                row.showBreakdownPie
                  ? "rounded-xl border border-transparent px-3 py-3"
                  : "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 rounded-xl border border-transparent px-3 py-2",
                row.emphasize
                  ? "border-emerald-500/15 bg-emerald-500/8 dark:bg-emerald-500/10"
                  : "bg-white/45 dark:bg-white/[0.025]"
              )}
            >
              <div className="min-w-0 font-sans">
                <div className="flex items-start justify-between gap-3">
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 font-medium",
                    row.emphasize
                      ? "text-ink-900 dark:text-white"
                      : "text-ink-700 dark:text-white/80"
                  )}
                >
                  {row.icon ? <span aria-hidden>{row.icon}</span> : null}
                  {row.label}
                </span>
                {row.showBreakdownPie ? (
                  <span className={clsx("shrink-0 text-right font-semibold tabular-nums", amountClass)}>
                    {row.amount >= 0 && row.tone !== "deduct" ? "" : row.amount < 0 ? "−" : ""}
                    {fmt.euro(Math.abs(row.amount))}
                  </span>
                ) : null}
                </div>
                {row.detail ? (
                  <span className="mt-0.5 block font-sans text-[10px] font-normal text-ink-500 dark:text-white/40">
                    {row.detail}
                    {row.gaugeAmount != null ? ` · ${percentOfCa(row.gaugeAmount)} % du CA HT` : ""}
                  </span>
                ) : null}
                {row.breakdown?.length && !row.showBreakdownPie ? (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {row.breakdown.map((b) => (
                      <span
                        key={`${row.label}-${b.label}`}
                        className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-ink-600 dark:bg-white/[0.06] dark:text-white/55"
                      >
                        {b.label} {fmt.euro(b.amountEur)}
                      </span>
                    ))}
                  </span>
                ) : null}
                {row.showBreakdownPie && row.breakdown?.length ? (
                  <BreakdownPieChart
                    breakdown={row.breakdown}
                    fmt={fmt}
                    palette={row.breakdownPalette ?? MANDATORY_FEES_COLORS}
                    recategorizeOptions={row.recategorizeOptions}
                    onRecategorized={onRecategorized}
                  />
                ) : null}
              </div>
              {!row.showBreakdownPie ? (
                <span className={clsx("shrink-0 text-right font-semibold tabular-nums", amountClass)}>
                  {row.amount >= 0 && row.tone !== "deduct" ? "" : row.amount < 0 ? "−" : ""}
                  {fmt.euro(Math.abs(row.amount))}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function RecoverableVatMonthlyBlock({
  rows,
  kpis,
  paidTransactions,
  fmt
}: {
  rows: ValeurReelleVatMonthlyRow[];
  kpis: ValeurReelleVatSavingsKpis;
  paidTransactions: ValeurReelleVatLiability["paidTransactions"];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
}) {
  const [showPaidVatTransactions, setShowPaidVatTransactions] = useState(false);
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { amountEur: number; count: number }>();
    for (const row of rows) {
      for (const item of row.breakdown) {
        const previous = map.get(item.label);
        map.set(item.label, {
          amountEur: (previous?.amountEur ?? 0) + item.amountEur,
          count: (previous?.count ?? 0) + item.count
        });
      }
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, amountEur: value.amountEur, count: value.count }))
      .sort((a, b) => Math.abs(b.amountEur) - Math.abs(a.amountEur));
  }, [rows]);
  const breakdownRows: ValeurReelleWaterfallBreakdownRow[] = categoryBreakdown.map((item) => ({
    label: item.label,
    amountEur: item.amountEur,
    count: item.count
  }));
  const referenceMonthLabel = formatVatReferenceMonthLabel(kpis.referenceMonthKey);

  return (
    <section className="rounded-[2rem] border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-4 shadow-[0_20px_60px_-28px_rgba(16,185,129,0.28)] dark:border-emerald-300/15 dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_32px_80px_-24px_rgba(0,22,28,0.72)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-50 text-emerald-600 dark:border-emerald-300/20 dark:bg-emerald-500/12 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700/85 dark:text-emerald-300/80">
              Économies TVA
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink-900 dark:text-white sm:text-xl">
              Chaque achat pro vous fait gagner de la TVA
            </h2>
            <p className="mt-1 text-[11px] text-ink-600 dark:text-white/50">
              TVA récupérable sur vos dépenses éligibles · {referenceMonthLabel}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-white/70 px-3 py-2 text-right dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-[9px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
            Moyenne mensuelle
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
            {fmt.euro(kpis.averageMonthlyEur)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <VatSavingsMetricTile
          label="Ce mois"
          value={fmt.euro(kpis.monthEur)}
          sublabel={referenceMonthLabel}
          icon={CalendarDays}
        />
        <VatSavingsMetricTile
          label="Depuis janvier"
          value={fmt.euro(kpis.ytdEur)}
          sublabel={`${kpis.monthsElapsed} mois · ${kpis.referenceYear}`}
          icon={PiggyBank}
          emphasized
        />
        <VatSavingsMetricTile
          label="Projection annuelle"
          value={fmt.euro(kpis.annualProjectionEur)}
          sublabel={`Moy. ${fmt.euro(kpis.averageMonthlyEur)} × 12`}
          icon={LineChart}
        />
      </div>

      {breakdownRows.length ? (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-300/70">
            Répartition par catégorie
          </p>
          <BreakdownPieChart
            breakdown={breakdownRows}
            fmt={fmt}
            palette={RECOVERABLE_VAT_COLORS}
            showDetailToggle={false}
          />
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-emerald-200/50 bg-emerald-50/40 px-3 py-3 text-xs font-semibold text-emerald-800/80 dark:border-emerald-400/15 dark:bg-emerald-500/8 dark:text-emerald-200/80">
          Aucune économie TVA sur cette période — vos achats éligibles apparaîtront ici.
        </p>
      )}

      {paidTransactions.length ? (
        <div className="mt-4 rounded-2xl border border-ink-200/70 bg-white/55 p-3 dark:border-cyan-100/[0.08] dark:bg-[#06242b]/40" data-private>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-white/40">
                Transactions TVA payées
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-ink-500 dark:text-white/35">
                {paidTransactions.length} ligne{paidTransactions.length > 1 ? "s" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPaidVatTransactions((prev) => !prev)}
              className="shrink-0 rounded-full border border-ink-200/80 bg-white/65 px-3 py-1.5 text-[11px] font-bold text-ink-700 shadow-sm transition hover:bg-white dark:border-cyan-100/[0.10] dark:bg-white/[0.06] dark:text-white/65 dark:shadow-none dark:hover:bg-white/[0.10] dark:hover:text-white"
              aria-expanded={showPaidVatTransactions}
            >
              {showPaidVatTransactions ? "Masquer" : "Développer"}
            </button>
          </div>
          {showPaidVatTransactions ? (
            <>
              <ul className="max-h-56 space-y-2 overflow-y-auto pr-1 text-xs">
                {paidTransactions.slice(0, 12).map((tx) => (
                  <li
                    key={`${tx.id}-${tx.date}`}
                    className="flex justify-between gap-3 border-b border-ink-200/70 pb-2 last:border-0 last:pb-0 dark:border-cyan-100/[0.06]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink-800 dark:text-white/78">{tx.label}</span>
                      <span className="text-ink-500 dark:text-white/35">{tx.date} · {tx.category}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink-900 dark:text-white">
                      {fmt.euro(Math.abs(tx.amountEur))}
                    </span>
                  </li>
                ))}
              </ul>
              {paidTransactions.length > 12 ? (
                <p className="mt-2 text-[11px] font-medium text-ink-500 dark:text-white/38">
                  + {paidTransactions.length - 12} autres transactions TVA
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function ValeurReelleClient({
  initialTransactions,
  demoMode,
  loadError
}: {
  initialTransactions: readonly DashboardTx[];
  demoMode: boolean;
  loadError: string | null;
}) {
  const fmt = useDashboardDisplayFormat();
  const [selectedYears, setSelectedYears] = useState<number[] | null>(
    () => defaultDashboardPeriodFilter().selectedYears
  );
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    () => defaultDashboardPeriodFilter().selectedMonth
  );
  const [localCategoryOverrides, setLocalCategoryOverrides] = useState<
    Record<string, { category: string; categoryManual: true }>
  >({});
  const transactions = useMemo(
    () =>
      initialTransactions.map((tx) => {
        const override = localCategoryOverrides[tx.id];
        return override
          ? { ...tx, category: override.category, categoryManual: true }
          : tx;
      }),
    [initialTransactions, localCategoryOverrides]
  );
  const proTransactions = useMemo(
    () => transactions.filter((tx) => (tx.scope ?? "pro") === "pro"),
    [transactions]
  );

  const yearOptions = useMemo(
    () => buildDashboardYearOptions(null, proTransactions),
    [proTransactions]
  );
  const monthOptions = useMemo(
    () => buildDashboardMonthOptions(null, proTransactions),
    [proTransactions]
  );

  const onToggleYear = useCallback(
    (y: number) => {
      setSelectedMonth(null);
      setSelectedYears(toggleDashboardYearInFilter(y, yearOptions));
    },
    [yearOptions]
  );

  const analysis = useMemo(
    () => analyzeValeurReelle(transactions, { years: selectedYears, month: selectedMonth }),
    [selectedMonth, selectedYears, transactions]
  );

  const vatYearMonthlyRows = useMemo(() => {
    const refMonth = selectedMonth ?? dashboardMonthKeyNowLocal();
    const year = Number(refMonth.slice(0, 4));
    const yearsForVat =
      selectedYears != null && selectedYears.length > 0
        ? selectedYears.includes(year)
          ? [year]
          : [selectedYears[0]!]
        : [year];
    return analyzeValeurReelle(transactions, { years: yearsForVat, month: null }).vatRecoverableMonthlyRows;
  }, [selectedMonth, selectedYears, transactions]);

  const vatSavingsKpis = useMemo(
    () => computeVatSavingsKpis(vatYearMonthlyRows, { referenceMonthKey: selectedMonth }),
    [selectedMonth, vatYearMonthlyRows]
  );

  const handleRecategorized = useCallback((transactionId: string, category: string) => {
    setLocalCategoryOverrides((prev) => ({
      ...prev,
      [transactionId]: { category: mapExpenseCategoryLabel(category), categoryManual: true }
    }));
  }, []);

  const billableActivity = useBillableActivityOptional();
  const billableDaysInPeriod = useMemo(
    () => {
      const tjmHt = billableActivity?.tjmHt ?? BILLABLE_CLIENT_TJM_HT;
      if (!Number.isFinite(tjmHt) || tjmHt <= 0) return 0;
      return Math.round((analysis.cashTree.caFactureEur / tjmHt) * 10) / 10;
    },
    [analysis.cashTree.caFactureEur, billableActivity?.tjmHt]
  );

  const gainPerWorkDayEstimate = useMemo(
    () => {
      if (!selectedMonth) return null;
      return estimateCurrentMonthGainPerWorkDay(
        transactions,
        analysis.cashTree,
        billableActivity?.selected ?? new Set<string>(),
        selectedMonth
      );
    },
    [analysis.cashTree, billableActivity?.selected, selectedMonth, transactions]
  );

  const tjmHtForPeriod = useMemo(() => {
    const monthKey = selectedMonth ?? dashboardMonthKeyNowLocal();
    return resolveBillableTjmForClientMonth(
      billableActivity?.billableRatePeriods ?? [],
      billableActivity?.billableRatePeriods[0]?.clientName ?? "",
      monthKey,
      billableActivity?.tjmHt ?? BILLABLE_CLIENT_TJM_HT
    );
  }, [billableActivity?.billableRatePeriods, billableActivity?.tjmHt, selectedMonth]);

  const monthlyTrendSeries = useMemo(
    () =>
      buildValeurReelleMonthlyTrendSeries(transactions, {
        years: selectedYears,
        month: selectedMonth
      }),
    [selectedMonth, selectedYears, transactions]
  );

  return (
    <div className="scroll-mt-28 space-y-6 overflow-x-hidden sm:space-y-8">
      <DashboardPeriodFilterSection
        selectedYears={selectedYears}
        setSelectedYears={setSelectedYears}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        monthOptions={monthOptions}
        yearOptions={yearOptions}
        onToggleYear={onToggleYear}
        sticky
        showRollingOption={false}
        showActiveLabel={false}
      />

      {demoMode ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Mode démo — montants fictifs.</p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {loadError}
        </p>
      ) : null}

      <CashFlowTreeVisual
        tree={analysis.cashTree}
        fmt={fmt}
        billableDays={billableDaysInPeriod}
        gainPerWorkDayEstimate={gainPerWorkDayEstimate}
        periodLabel={analysis.periodLabel}
        tjmHt={tjmHtForPeriod}
        onRecategorized={handleRecategorized}
      />

      <RecoverableVatMonthlyBlock
        rows={analysis.vatRecoverableMonthlyRows}
        kpis={vatSavingsKpis}
        paidTransactions={analysis.vatLiability.paidTransactions}
        fmt={fmt}
      />

      <ValeurReellePer100AllocationCard tree={analysis.cashTree} fmt={fmt} />

      <ValeurReelleMonthlyTrendChart series={monthlyTrendSeries} />

    </div>
  );
}
