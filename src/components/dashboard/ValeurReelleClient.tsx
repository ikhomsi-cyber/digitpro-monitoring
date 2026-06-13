"use client";

import { useCallback, useMemo, useState } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { DashboardInsightPeriodFilter } from "@/components/dashboard/DashboardInsightPeriodFilter";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  buildDashboardMonthOptions,
  buildDashboardYearOptions,
  dashboardMonthKeyNowLocal,
  defaultDashboardPeriodFilter,
  formatDashboardMonthLabel
} from "@/lib/dashboard-period";
import { useBillableActivityOptional } from "@/components/dashboard/BillableActivityContext";
import { BILLABLE_CLIENT_TJM_HT, resolveBillableTjmForClientMonth } from "@/lib/billable-client-days";
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
import { computeValeurReelleDailyBreakdown } from "@/lib/valeur-reelle-daily-value";
import type {
  ValeurReelleCashTree,
  ValeurReelleVatLiability,
  ValeurReelleVatMonthlyRow,
  ValeurReelleWaterfallBreakdownRow
} from "@/lib/valeur-reelle-analyze";
import {
  dashboardEyebrow,
  dashboardInsightCard,
  dashboardInsightGrid,
  dashboardPanelTitle,
  dashboardSectionStack
} from "@/lib/dashboard-surfaces";

const SEG_COLORS = {
  net: "#0ea5e9",
  csg: "#f59e0b",
  digitpro: "#fb7185",
  perso: "#34d399"
} as const;

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
  "#0071E3",
  "#0ea5e9",
  "#38bdf8",
  "#3b82f6",
  "#60a5fa",
  "#2563eb"
];

function formatVatReferenceMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
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

type Fmt = ReturnType<typeof useDashboardDisplayFormat>;

type AllocationSegment = { id: string; label: string; amount: number; color: string };

/** Barre d'allocation horizontale empilée — visuel épuré qui remplace le waterfall. */
function AllocationStackBar({ segments, fmt }: { segments: AllocationSegment[]; fmt: Fmt }) {
  const total = segments.reduce((sum, seg) => sum + Math.max(0, seg.amount), 0);
  if (total <= 0) return null;
  const withPct = segments.map((seg) => ({
    ...seg,
    pct: Math.round((Math.max(0, seg.amount) / total) * 1000) / 10
  }));

  return (
    <div className="mt-3 space-y-3">
      <div className="flex h-12 w-full overflow-hidden rounded-2xl border border-ink-200/40 dark:border-white/[0.06]">
        {withPct.map((seg) => (
          <div
            key={seg.id}
            className="relative flex min-w-0 items-center justify-center transition-all"
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
            title={`${seg.label} · ${fmt.euro(seg.amount)} · ${seg.pct} %`}
          >
            {seg.pct >= 11 ? (
              <span className="truncate px-1 text-center text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                {seg.pct} %
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {withPct.map((seg) => (
          <li key={`legend-${seg.id}`} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden />
              <span className="truncate text-[11px] font-semibold text-ink-600 dark:text-white/60">{seg.label}</span>
            </div>
            <p className="mt-0.5 font-display text-sm font-bold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(seg.amount)}
            </p>
            <p className="text-[10px] font-medium tabular-nums text-ink-500 dark:text-white/40">{seg.pct} % du total</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** En-tête de bloc insight (eyebrow + titre + sous-titre + zone droite). */
function BlockHeader({
  eyebrow,
  title,
  sub,
  right
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={dashboardEyebrow}>{eyebrow}</p>
        <h3 className={clsx(dashboardPanelTitle, "mt-1")}>{title}</h3>
        {sub ? <p className="mt-0.5 text-[11px] font-medium text-ink-500 dark:text-white/40">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

/** Carte « Cash disponible » : net disponible réel + gain moyen, isolés. */
function CashAvailableCard({
  tree,
  fmt,
  billableDays,
  gainPerWorkDayEstimate,
  periodLabel
}: {
  tree: ValeurReelleCashTree;
  fmt: Fmt;
  billableDays: number;
  gainPerWorkDayEstimate: GainPerWorkDayEstimate | null;
  periodLabel: string;
}) {
  const isCurrentMonthEstimate = gainPerWorkDayEstimate != null;
  const gainDayDenominator = isCurrentMonthEstimate ? gainPerWorkDayEstimate.workedDays : billableDays;
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

  const gainBasisNote = isCurrentMonthEstimate
    ? gainPerWorkDayEstimate.workedDays > 0
      ? `${formattedGainDayDenominator} j. travaillé${gainDayDenominator > 1 ? "s" : ""}${
          gainPerWorkDayEstimate.gainAverageMonthKey
            ? ` · ${formatDashboardMonthLabel(gainPerWorkDayEstimate.gainAverageMonthKey)}`
            : " · mois passé"
        }${gainPerWorkDayEstimate.usesHistoricalEstimate ? " · estimé" : ""}`
      : "estimation sur historique"
    : `${formattedGainDayDenominator} j. facturé${gainDayDenominator > 1 ? "s" : ""}`;

  return (
    <section className="flex flex-col items-center py-6 text-center sm:py-8" data-private>
      <p className="text-sm font-medium text-ink-500 dark:text-white/55">Cash disponible · HT</p>
      <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-apple-tight text-ink-900 dark:text-white sm:text-5xl">
        {fmt.euro(netDisponibleReel)}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {netDisponiblePctCa != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-300">
            <span className="text-ink-600 dark:text-white/60">Part du CA HT</span>
            <span className="tabular-nums">{netDisponiblePctCa} %</span>
          </span>
        ) : null}
        {reelParJour != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200/70 px-4 py-2 text-sm font-medium text-ink-700 dark:border-white/10 dark:text-white/75">
            <span className="text-ink-600 dark:text-white/60">Gain moyen</span>
            <span className="tabular-nums">{fmt.euro(reelParJour)} /jour</span>
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] font-medium text-ink-500 dark:text-white/40">
        {reelParJour != null ? `${gainBasisNote} · ` : ""}
        <span className="capitalize">{periodLabel}</span>
      </p>
    </section>
  );
}

/** Bloc « Par jour facturé » — barre empilée (CA HT/jour réparti). */
function DailyValueBlock({
  tree,
  fmt,
  tjmHt,
  billableDays,
  gainPerWorkDayEstimate
}: {
  tree: ValeurReelleCashTree;
  fmt: Fmt;
  tjmHt: number;
  billableDays: number;
  gainPerWorkDayEstimate: GainPerWorkDayEstimate | null;
}) {
  const breakdown = useMemo(
    () => computeValeurReelleDailyBreakdown({ tree, tjmHt, billableDays, gainPerWorkDayEstimate }),
    [billableDays, gainPerWorkDayEstimate, tjmHt, tree]
  );

  if (breakdown.caHtPerDay <= 0 && breakdown.netPerDay <= 0) return null;

  const retainedPct =
    breakdown.caHtPerDay > 0 ? Math.round((breakdown.netPerDay / breakdown.caHtPerDay) * 1000) / 10 : null;
  const basisLabel =
    breakdown.workedDays > 0
      ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(breakdown.workedDays)} j. ${
          gainPerWorkDayEstimate != null ? "travaillés" : "facturés"
        }`
      : (breakdown.estimateNote ?? "estimation");

  const segments: AllocationSegment[] = [
    { id: "net", label: "Valeur retenue", amount: breakdown.netPerDay, color: SEG_COLORS.net },
    { id: "csg", label: "CSG", amount: breakdown.csgPerDay, color: SEG_COLORS.csg },
    { id: "digitpro", label: "Frais DigitPro", amount: breakdown.mandatoryFeesPerDay, color: SEG_COLORS.digitpro }
  ];

  return (
    <div className={dashboardInsightCard}>
      <BlockHeader
        eyebrow="Par jour facturé"
        title="Décomposition / jour"
        sub={`CA HT ${fmt.euro(breakdown.caHtPerDay)} · ${basisLabel}`}
      />
      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
          {fmt.euro(breakdown.netPerDay)}
        </p>
        <span className="text-sm font-medium tabular-nums text-sky-600 dark:text-sky-300">
          {retainedPct != null ? `${retainedPct} % retenu` : "/ jour"}
        </span>
      </div>
      <AllocationStackBar segments={segments} fmt={fmt} />
      <p className="mt-3 text-xs text-ink-400 dark:text-white/35">
        Valeur retenue = CA HT − CSG − frais DigitPro (frais perso réintégrés).
      </p>
    </div>
  );
}

/** Bloc « Waterfall financier » simplifié — barre empilée sur la période. */
function FinancialAllocationBlock({ tree, fmt }: { tree: ValeurReelleCashTree; fmt: Fmt }) {
  const caHt = Math.max(0, tree.caFactureEur);
  const valeurNette = Math.max(0, caHt - tree.csgEur - tree.mandatoryFeesEur - tree.personalChargesEur);
  if (caHt <= 0) return null;
  const netPct = caHt > 0 ? Math.round((valeurNette / caHt) * 1000) / 10 : null;

  const segments: AllocationSegment[] = [
    { id: "net", label: "Valeur nette", amount: valeurNette, color: SEG_COLORS.net },
    { id: "csg", label: "CSG", amount: tree.csgEur, color: SEG_COLORS.csg },
    { id: "digitpro", label: "Frais DigitPro", amount: tree.mandatoryFeesEur, color: SEG_COLORS.digitpro },
    { id: "perso", label: "Frais perso", amount: tree.personalChargesEur, color: SEG_COLORS.perso }
  ];

  return (
    <div className={dashboardInsightCard}>
      <BlockHeader eyebrow="Waterfall financier" title="Répartition du CA HT" sub={`Base ${fmt.euro(caHt)}`} />
      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
          {fmt.euro(valeurNette)}
        </p>
        <span className="text-sm font-medium tabular-nums text-sky-600 dark:text-sky-300">
          {netPct != null ? `${netPct} % net` : null}
        </span>
      </div>
      <AllocationStackBar segments={segments} fmt={fmt} />
      <p className="mt-3 text-xs text-ink-400 dark:text-white/35">
        CA HT → CSG → frais DigitPro → frais perso → valeur nette.
      </p>
    </div>
  );
}

/** Bloc dédié à une catégorie de frais (DigitPro / perso) avec camembert. */
function FeesBlock({
  eyebrow,
  title,
  amount,
  breakdown,
  palette,
  fmt,
  caHt,
  recategorizeOptions,
  onRecategorized
}: {
  eyebrow: string;
  title: string;
  amount: number;
  breakdown: ValeurReelleWaterfallBreakdownRow[];
  palette: readonly string[];
  fmt: Fmt;
  caHt: number;
  recategorizeOptions?: readonly string[];
  onRecategorized?: (transactionId: string, category: string) => void;
}) {
  const pctOfCa = caHt > 0 ? Math.round((amount / caHt) * 1000) / 10 : null;
  return (
    <div className={dashboardInsightCard}>
      <BlockHeader
        eyebrow={eyebrow}
        title={title}
        right={
          <div className="text-right">
            <p className="font-display text-xl font-bold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(amount)}
            </p>
            {pctOfCa != null ? (
              <p className="text-[11px] font-medium tabular-nums text-ink-500 dark:text-white/40">
                {pctOfCa} % du CA HT
              </p>
            ) : null}
          </div>
        }
      />
      {breakdown.length ? (
        <BreakdownPieChart
          breakdown={breakdown}
          fmt={fmt}
          palette={palette}
          recategorizeOptions={recategorizeOptions}
          onRecategorized={onRecategorized}
        />
      ) : (
        <p className="mt-3 text-xs text-ink-400 dark:text-white/35">Aucune dépense sur cette période.</p>
      )}
    </div>
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

  const compactKpis = [
    { id: "month", label: "Ce mois", value: fmt.euro(kpis.monthEur) },
    { id: "ytd", label: "Depuis janvier", value: fmt.euro(kpis.ytdEur) },
    { id: "avg", label: "Moyenne / mois", value: fmt.euro(kpis.averageMonthlyEur) },
    { id: "projection", label: "Projection", value: fmt.euro(kpis.annualProjectionEur) }
  ];

  return (
    <section className={clsx(dashboardInsightCard, "space-y-4")}>
      <BlockHeader
        eyebrow="Économies TVA"
        title="TVA récupérée"
        sub={`Sur vos dépenses éligibles · ${referenceMonthLabel}`}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {compactKpis.map((kpi) => (
          <div key={kpi.id} className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/42">
              {kpi.label}
            </p>
            <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900 dark:text-white sm:text-lg">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {breakdownRows.length ? (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500 dark:text-white/45">
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
        <p className="mt-5 rounded-xl border border-ink-200/50 px-3 py-3 text-xs font-semibold text-ink-600 dark:border-white/[0.08] dark:text-white/55">
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
  const [selectedYears, setSelectedYears] = useState<number[]>(
    () => defaultDashboardPeriodFilter().selectedYears
  );
  const [selectedMonths, setSelectedMonths] = useState<string[]>(
    () => [defaultDashboardPeriodFilter().selectedMonth]
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

  const onToggleYear = useCallback((y: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) {
        if (next.size <= 1) return prev;
        next.delete(y);
        setSelectedMonths((months) => months.filter((m) => Number(m.slice(0, 4)) !== y));
      } else {
        next.add(y);
      }
      return Array.from(next).sort((a, b) => b - a);
    });
  }, []);

  // Retire les mois dont l'année n'est plus sélectionnée.
  const selectedMonthsForYears = useMemo(
    () => selectedMonths.filter((m) => selectedYears.includes(Number(m.slice(0, 4)))),
    [selectedMonths, selectedYears]
  );

  const onToggleMonth = useCallback((m: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return Array.from(next).sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const onClearMonths = useCallback(() => setSelectedMonths([]), []);

  const singleMonth = selectedMonthsForYears.length === 1 ? selectedMonthsForYears[0]! : null;

  const analysis = useMemo(
    () =>
      analyzeValeurReelle(transactions, {
        years: selectedYears,
        months: selectedMonthsForYears.length ? selectedMonthsForYears : null
      }),
    [selectedMonthsForYears, selectedYears, transactions]
  );

  const vatYearMonthlyRows = useMemo(() => {
    const refMonth = singleMonth ?? dashboardMonthKeyNowLocal();
    const year = Number(refMonth.slice(0, 4));
    const yearsForVat = selectedYears.includes(year) ? [year] : [selectedYears[0]!];
    return analyzeValeurReelle(transactions, { years: yearsForVat, month: null }).vatRecoverableMonthlyRows;
  }, [singleMonth, selectedYears, transactions]);

  const vatSavingsKpis = useMemo(
    () => computeVatSavingsKpis(vatYearMonthlyRows, { referenceMonthKey: singleMonth }),
    [singleMonth, vatYearMonthlyRows]
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
      if (!singleMonth) return null;
      return estimateCurrentMonthGainPerWorkDay(
        transactions,
        analysis.cashTree,
        billableActivity?.selected ?? new Set<string>(),
        singleMonth
      );
    },
    [analysis.cashTree, billableActivity?.selected, singleMonth, transactions]
  );

  const tjmHtForPeriod = useMemo(() => {
    const monthKey = singleMonth ?? dashboardMonthKeyNowLocal();
    return resolveBillableTjmForClientMonth(
      billableActivity?.billableRatePeriods ?? [],
      billableActivity?.billableRatePeriods[0]?.clientName ?? "",
      monthKey,
      billableActivity?.tjmHt ?? BILLABLE_CLIENT_TJM_HT
    );
  }, [billableActivity?.billableRatePeriods, billableActivity?.tjmHt, singleMonth]);

  const tree = analysis.cashTree;

  return (
    <div className={clsx("scroll-mt-28 overflow-x-hidden", dashboardSectionStack)}>
      <DashboardInsightPeriodFilter
        eyebrow="Valeur réelle"
        title="Ce qu'il vous reste vraiment"
        yearOptions={yearOptions}
        monthOptions={monthOptions}
        selectedYears={selectedYears}
        selectedMonths={selectedMonthsForYears}
        onToggleYear={onToggleYear}
        onToggleMonth={onToggleMonth}
        onClearMonths={onClearMonths}
      />

      {demoMode ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Mode démo — montants fictifs.</p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {loadError}
        </p>
      ) : null}

      <CashAvailableCard
        tree={tree}
        fmt={fmt}
        billableDays={billableDaysInPeriod}
        gainPerWorkDayEstimate={gainPerWorkDayEstimate}
        periodLabel={analysis.periodLabel}
      />

      <div className={dashboardInsightGrid}>
        <DailyValueBlock
          tree={tree}
          fmt={fmt}
          tjmHt={tjmHtForPeriod}
          billableDays={billableDaysInPeriod}
          gainPerWorkDayEstimate={gainPerWorkDayEstimate}
        />
        <FinancialAllocationBlock tree={tree} fmt={fmt} />
      </div>

      <div className={dashboardInsightGrid}>
        <FeesBlock
          eyebrow="Frais société"
          title="Frais DigitPro"
          amount={tree.mandatoryFeesEur}
          breakdown={tree.mandatoryFeesBreakdown}
          palette={MANDATORY_FEES_COLORS}
          fmt={fmt}
          caHt={tree.caFactureEur}
          recategorizeOptions={VALEUR_REELLE_EXPENSE_CATEGORIES}
          onRecategorized={handleRecategorized}
        />
        <FeesBlock
          eyebrow="Dépenses perso"
          title="Frais perso"
          amount={tree.personalChargesEur}
          breakdown={tree.personalChargesBreakdown}
          palette={PERSONAL_CHARGES_COLORS}
          fmt={fmt}
          caHt={tree.caFactureEur}
          recategorizeOptions={VALEUR_REELLE_EXPENSE_CATEGORIES}
          onRecategorized={handleRecategorized}
        />
      </div>

      <RecoverableVatMonthlyBlock
        rows={analysis.vatRecoverableMonthlyRows}
        kpis={vatSavingsKpis}
        paidTransactions={analysis.vatLiability.paidTransactions}
        fmt={fmt}
      />
    </div>
  );
}
