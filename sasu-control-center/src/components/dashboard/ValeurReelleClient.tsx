"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { toast } from "sonner";
import { DashboardPeriodFilterSection } from "@/components/dashboard/DashboardPeriodFilterSection";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  buildDashboardMonthOptions,
  buildDashboardYearOptions,
  toggleDashboardYearInFilter
} from "@/lib/dashboard-period";
import { useBillableActivityOptional } from "@/components/dashboard/BillableActivityContext";
import { BILLABLE_CLIENT_TJM_HT } from "@/lib/billable-client-days";
import { analyzeValeurReelle, VALEUR_REELLE_EXPENSE_CATEGORIES } from "@/lib/valeur-reelle-analyze";
import type {
  ValeurReelleCashTree,
  ValeurReelleVatLiability,
  ValeurReelleVatMonthlyRow,
  ValeurReelleWaterfallBreakdownRow
} from "@/lib/valeur-reelle-analyze";

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
  onRecategorized
}: {
  breakdown: ValeurReelleWaterfallBreakdownRow[];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  palette: readonly string[];
  recategorizeOptions?: readonly string[];
  onRecategorized?: (transactionId: string, category: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [openCategoryLabel, setOpenCategoryLabel] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hiddenTransactionIds, setHiddenTransactionIds] = useState<Set<string>>(() => new Set());
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
      setHiddenTransactionIds((prev) => new Set(prev).add(transactionId));
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
      <div className="relative overflow-hidden rounded-full border border-white/70 bg-ink-100 p-1 shadow-inner dark:border-white/10 dark:bg-black/30">
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
          <svg viewBox="0 0 200 200" role="img" aria-label="Répartition par catégorie" className="block h-52 w-52">
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
            <circle cx="100" cy="100" r="43" className="fill-white dark:fill-[#101015]" />
            <text x="100" y="98" textAnchor="middle" className="fill-ink-900 text-[11px] font-bold tabular-nums dark:fill-white">
              {fmt.euro(total)}
            </text>
            <text x="100" y="112" textAnchor="middle" className="fill-ink-400 text-[7px] font-semibold uppercase tracking-[0.14em] dark:fill-white/35">
              total
            </text>
          </svg>
          <div className="mb-3 flex max-w-full flex-wrap justify-center gap-1.5">
            {slices.slice(0, 6).map((slice) => (
              <span
                key={`compact-legend-${slice.row.label}`}
                className="inline-flex max-w-[9rem] items-center gap-1.5 rounded-full border border-ink-200/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65"
                title={`${slice.row.label} · ${slice.percent} % · ${fmt.euro(slice.row.amountEur)}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
                <span className="truncate">{slice.row.label}</span>
              </span>
            ))}
            {slices.length > 6 ? (
              <span className="inline-flex items-center rounded-full border border-ink-200/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-ink-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
                +{slices.length - 6}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-ink-200 bg-white/70 px-4 text-xs font-bold text-ink-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70 dark:hover:bg-white/[0.08]"
            aria-expanded={showDetails}
          >
            {showDetails ? "Masquer le détail" : "Afficher le détail"}
          </button>
        </div>
        {showDetails ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {slices.map((slice) => {
            const transactions = (slice.row.transactions ?? []).filter((tx) => !hiddenTransactionIds.has(tx.id));
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
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-200/55 dark:bg-black/25">
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
                    <div key={tx.id} className="rounded-xl border border-ink-100 bg-white/70 p-2.5 dark:border-white/10 dark:bg-black/20">
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
  periodLabel,
  onRecategorized
}: {
  tree: ValeurReelleCashTree;
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  billableDays: number;
  periodLabel: string;
  onRecategorized?: (transactionId: string, category: string) => void;
}) {
  const formattedBillableDays = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1
  }).format(billableDays);
  const reelParJour =
    billableDays > 0
      ? Math.round(((tree.bncEur + tree.personalChargesEur) / billableDays) * 100) / 100
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
      className="rounded-2xl border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-emerald-50/30 p-4 shadow-sm dark:border-white/[0.08] dark:from-[#0c0c10] dark:via-[#0a0a0f] dark:to-emerald-950/20 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <motion.div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-white/45">
            Combien je gagne vraiment
          </p>
          <p className="mt-1 text-xs text-ink-600 dark:text-white/50">{periodLabel}</p>
        </motion.div>
        {reelParJour != null ? (
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              = gain / jour
            </p>
            <p className="font-display text-xl font-bold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(reelParJour)}
            </p>
            <p className="text-[10px] text-ink-500 dark:text-white/40">
              {formattedBillableDays} jour{billableDays > 1 ? "s" : ""} facturé{billableDays > 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <p className="max-w-[12rem] text-right text-[10px] leading-snug text-ink-500 dark:text-white/40">
            Cochez vos jours travaillés sur le dashboard pour le réel / jour.
          </p>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
              Répartition du CA HT
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">Jauge de valeur</p>
          </div>
          <div className="text-right">
            <p className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(tree.caFactureEur)}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400 dark:text-white/35">
              100 % CA HT
            </p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-full border border-white/70 bg-ink-100 p-1 shadow-inner dark:border-white/10 dark:bg-black/30">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/10 dark:from-white/10" aria-hidden />
          <div className="relative flex h-5 overflow-hidden rounded-full">
          {[
            { key: "mandatory", value: tree.mandatoryFeesEur, color: "from-rose-400 to-rose-600" },
            { key: "csg", value: tree.csgEur, color: "from-orange-300 to-amber-500" },
            { key: "personal", value: tree.personalChargesEur, color: "from-emerald-400 to-teal-500" },
            { key: "bnc", value: tree.bncEur, color: "from-sky-400 to-blue-600" }
          ].map((segment) => {
            const width = Math.max(0, Math.min(100, percentOfCa(segment.value)));
            return width > 0 ? (
              <motion.span
                key={segment.key}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.7, delay: 0.08 }}
                className={clsx("h-full bg-gradient-to-r", segment.color)}
                style={{ width: `${width}%` }}
                aria-hidden
              />
            ) : null;
          })}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Frais", value: tree.mandatoryFeesEur, dot: "bg-rose-500" },
            { label: "CSG", value: tree.csgEur, dot: "bg-orange-400" },
            { label: "Perso", value: tree.personalChargesEur, dot: "bg-emerald-500" },
            { label: "BNC", value: tree.bncEur, dot: "bg-sky-500" }
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/40 px-3 py-2 dark:bg-white/[0.03]">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-white/40">
                <span className={clsx("h-2 w-2 rounded-full", item.dot)} aria-hidden />
                {item.label}
              </div>
              <p className="mt-1 font-display text-sm font-bold tabular-nums text-ink-900 dark:text-white">
                {percentOfCa(item.value)} %
              </p>
              <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-ink-500 dark:text-white/45">
                {fmt.euro(item.value)}
              </p>
            </div>
          ))}
        </div>
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
  fmt,
  periodLabel
}: {
  rows: ValeurReelleVatMonthlyRow[];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  periodLabel: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const totalVat = rows.reduce((sum, row) => sum + row.vatEur, 0);
  const totalGross = rows.reduce((sum, row) => sum + row.grossEur, 0);
  const averageVat = rows.length > 0 ? totalVat / rows.length : 0;
  const latest = rows[0] ?? null;
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      for (const item of row.breakdown) {
        map.set(item.label, (map.get(item.label) ?? 0) + item.amountEur);
      }
    }
    return Array.from(map.entries())
      .map(([label, amountEur]) => ({ label, amountEur }))
      .sort((a, b) => Math.abs(b.amountEur) - Math.abs(a.amountEur));
  }, [rows]);
  const topCategories = categoryBreakdown.slice(0, 4);
  const maxCategory = Math.max(1, ...topCategories.map((item) => Math.abs(item.amountEur)));
  const chartRows = [...rows].reverse();
  const maxMonthlyVat = Math.max(1, ...chartRows.map((row) => row.vatEur));

  const monthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
      new Date(Date.UTC(year || 2000, (month || 1) - 1, 1))
    );
  };

  return (
    <section className="rounded-2xl border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-sky-50/30 p-4 shadow-sm dark:border-white/[0.08] dark:from-[#0c0c10] dark:via-[#0a0a0f] dark:to-sky-950/20 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-white/45">
            TVA récupérable
          </p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-ink-950 dark:text-white sm:text-xl">
            Ce que je gagne en TVA par mois
          </h2>
        </div>
        <div className="rounded-2xl bg-white/45 px-4 py-3 text-right dark:bg-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-white/40">
            Moyenne mensuelle
          </p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-sky-800 dark:text-sky-200">
            {fmt.euro(averageVat)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-ink-500 dark:text-white/40">{periodLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Dernier mois", value: latest ? fmt.euro(latest.vatEur) : "—", sub: latest ? monthLabel(latest.monthKey) : "Aucun mois" },
          { label: "Total TVA", value: fmt.euro(totalVat), sub: `${rows.length} mois` },
          { label: "Base TTC", value: fmt.euro(totalGross), sub: "Éligible" },
          { label: "Taux", value: "20 / 10 %", sub: "Services / resto" }
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/40 px-3 py-2 dark:bg-white/[0.03]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-white/40">
              {item.label}
            </p>
            <p className="mt-1 font-display text-sm font-bold tabular-nums text-ink-950 dark:text-white">
              {item.value}
            </p>
            <p className="mt-0.5 truncate text-[11px] capitalize text-ink-500 dark:text-white/40">{item.sub}</p>
          </div>
        ))}
      </div>

      {chartRows.length ? (
        <div className="mt-4 rounded-2xl bg-white/40 px-3 py-3 dark:bg-white/[0.025]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-white/40">
              Évolution mensuelle
            </p>
            <p className="text-[11px] font-semibold tabular-nums text-sky-800 dark:text-sky-200">
              max {fmt.euro(maxMonthlyVat)}
            </p>
          </div>
          <div className="flex h-36 items-end gap-1.5">
            {chartRows.map((row) => {
              const heightPx = Math.max(10, Math.round((row.vatEur / maxMonthlyVat) * 92));
              return (
                <div key={row.monthKey} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-lg border border-ink-200 bg-white px-2 py-1 text-[10px] font-semibold tabular-nums text-ink-800 shadow-lg group-hover:block dark:border-white/10 dark:bg-[#101015] dark:text-white">
                    {monthLabel(row.monthKey)} · {fmt.euro(row.vatEur)}
                  </div>
                  <span className="mb-1 text-[10px] font-bold tabular-nums text-sky-900 dark:text-sky-100">
                    {fmt.euro(row.vatEur)}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-sky-400/90 shadow-[0_0_18px_rgba(56,189,248,0.18)]"
                    style={{ height: `${heightPx}px` }}
                    aria-hidden
                  />
                  <span className="mt-1 h-3 max-w-full truncate text-[9px] font-semibold uppercase text-ink-400 dark:text-white/30">
                    {row.monthKey.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {topCategories.length ? (
        <div className="mt-4 space-y-2">
          {topCategories.map((item) => (
            <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-white/45 px-3 py-2 text-xs dark:bg-white/[0.025]">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-semibold text-ink-700 dark:text-white/65">{item.label}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-200/60 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-sky-400"
                    style={{ width: `${Math.max(5, Math.round((Math.abs(item.amountEur) / maxCategory) * 100))}%` }}
                    aria-hidden
                  />
                </div>
              </div>
              <span className="shrink-0 font-bold tabular-nums text-ink-950 dark:text-white">{fmt.euro(item.amountEur)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-sky-200 bg-white/70 px-4 text-xs font-bold text-sky-800 shadow-sm transition hover:bg-white dark:border-sky-400/20 dark:bg-white/[0.05] dark:text-sky-200 dark:hover:bg-white/[0.08]"
        aria-expanded={showDetails}
      >
        {showDetails ? "Masquer le détail" : "Afficher les catégories TVA"}
      </button>

      {showDetails ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categoryBreakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/50 px-3 py-2 text-xs dark:bg-white/[0.03]">
                <span className="min-w-0 truncate font-semibold text-ink-700 dark:text-white/65">
                  {item.label}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-ink-950 dark:text-white">{fmt.euro(item.amountEur)}</span>
              </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function VatLiabilityBlock({
  liability,
  fmt,
  periodLabel
}: {
  liability: ValeurReelleVatLiability;
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  periodLabel: string;
}) {
  const [showPaidTransactions, setShowPaidTransactions] = useState(false);
  const remainingTone =
    liability.remainingVatEur > 0
      ? "text-amber-800 dark:text-amber-200"
      : "text-emerald-800 dark:text-emerald-200";
  const denominator = Math.max(
    1,
    liability.collectedVatEur,
    liability.paidVatEur + liability.recoverableVatEur
  );
  const paidPct = Math.max(0, Math.min(100, (liability.paidVatEur / denominator) * 100));
  const recoveredPct = Math.max(0, Math.min(100, (liability.recoverableVatEur / denominator) * 100));
  const remainingPct = Math.max(0, Math.min(100, (Math.max(0, liability.remainingVatEur) / denominator) * 100));

  return (
    <section className="rounded-2xl border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-amber-50/35 p-4 shadow-sm dark:border-white/[0.08] dark:from-[#0c0c10] dark:via-[#0a0a0f] dark:to-amber-950/15 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-white/45">
            TVA à reverser
          </p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-ink-950 dark:text-white sm:text-xl">
            TVA collectée non versée
          </h2>
          <p className="mt-1 text-xs font-medium text-ink-500 dark:text-white/40">{periodLabel}</p>
        </div>
        <div className="rounded-2xl bg-white/50 px-4 py-3 text-right dark:bg-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-white/40">
            Reste estimé
          </p>
          <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${remainingTone}`}>
            {fmt.euro(liability.remainingVatEur)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-full border border-white/70 bg-ink-100 p-1 shadow-inner dark:border-white/10 dark:bg-black/30">
        <div className="flex h-4 overflow-hidden rounded-full">
          <span className="bg-slate-400" style={{ width: `${paidPct}%` }} aria-hidden />
          <span className="bg-sky-400" style={{ width: `${recoveredPct}%` }} aria-hidden />
          <span className="bg-amber-400" style={{ width: `${remainingPct}%` }} aria-hidden />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "TVA collectée", value: fmt.euro(liability.collectedVatEur), sub: "CA TTC - CA HT", dot: "bg-violet-400" },
          { label: "Déjà payée", value: fmt.euro(liability.paidVatEur), sub: "Transactions TVA", dot: "bg-slate-400" },
          { label: "Gagnée 20 %", value: fmt.euro(liability.recoverableVat20Eur), sub: "Services / logiciels", dot: "bg-sky-400" },
          { label: "Gagnée 10 %", value: fmt.euro(liability.recoverableVat10Eur), sub: "Repas / NDF", dot: "bg-emerald-400" }
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/45 px-3 py-2 dark:bg-white/[0.03]">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-white/40">
              <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden />
              {item.label}
            </p>
            <p className="mt-1 font-display text-sm font-bold tabular-nums text-ink-950 dark:text-white">
              {item.value}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-ink-500 dark:text-white/40">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white/40 p-3 dark:bg-white/[0.025]">
        <button
          type="button"
          onClick={() => setShowPaidTransactions((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={showPaidTransactions}
        >
          <span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-white/40">
              Paiements TVA
            </span>
            <span className="mt-0.5 block text-sm font-bold text-ink-950 dark:text-white">
              {liability.paidTransactions.length} transaction{liability.paidTransactions.length > 1 ? "s" : ""}
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-bold text-ink-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
            {showPaidTransactions ? "Masquer" : "Afficher"}
          </span>
        </button>

        {showPaidTransactions ? (
          liability.paidTransactions.length ? (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {liability.paidTransactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-950 dark:text-white">
                      {cleanTransactionLabel(tx.label, tx.company)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-ink-500 dark:text-white/40">
                      {formatTransactionDate(tx.date)} · {tx.category || "TVA"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-ink-700 dark:text-white/70">
                    {fmt.euro(tx.amountEur)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-ink-200 px-3 py-3 text-sm font-medium text-ink-500 dark:border-white/10 dark:text-white/45">
              Aucun paiement TVA sur cette période.
            </p>
          )
        ) : null}
      </div>
    </section>
  );
}

function DebtDistributionBlock({
  tvaDebtEur,
  csgDebtEur,
  fmt
}: {
  tvaDebtEur: number;
  csgDebtEur: number;
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
}) {
  const tvaDebt = Math.max(0, tvaDebtEur);
  const csgDebt = Math.max(0, csgDebtEur);
  const totalDebt = tvaDebt + csgDebt;
  const circumference = 2 * Math.PI * 54;
  const tvaRatio = totalDebt > 0 ? tvaDebt / totalDebt : 0;
  const csgRatio = totalDebt > 0 ? csgDebt / totalDebt : 0;
  const tvaDash = Math.max(0, tvaRatio * circumference - 2);
  const csgDash = Math.max(0, csgRatio * circumference - 2);

  return (
    <section className="rounded-2xl border border-ink-200/90 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-5">
      <h2 className="font-display text-lg font-bold tracking-tight text-ink-800 dark:text-white sm:text-xl">
        Répartition des dettes
      </h2>

      <div className="mt-4 flex justify-center">
        <div className="relative h-56 w-56">
          <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label="Répartition des dettes TVA et CSG">
            <circle cx="80" cy="80" r="54" fill="none" stroke="rgba(248,113,113,0.22)" strokeWidth="16" />
            {totalDebt > 0 ? (
              <>
                <circle
                  cx="80"
                  cy="80"
                  r="54"
                  fill="none"
                  stroke="#fb7c63"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${tvaDash} ${circumference}`}
                  strokeDashoffset="0"
                  transform="rotate(-90 80 80)"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="54"
                  fill="none"
                  stroke="#fec7bc"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${csgDash} ${circumference}`}
                  strokeDashoffset={-(tvaRatio * circumference)}
                  transform="rotate(-90 80 80)"
                />
              </>
            ) : null}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-3xl font-black tabular-nums text-rose-900 dark:text-rose-200">
                {fmt.euro(totalDebt)}
              </p>
              <p className="mt-2 text-lg font-bold text-ink-700 dark:text-white/65">Dette totale</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[
          { label: "Dette TVA", value: tvaDebt, color: "bg-[#fb7c63]" },
          { label: "Dette CSG", value: csgDebt, color: "bg-[#fec7bc]" }
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex min-w-0 items-center gap-3 text-lg font-bold text-ink-700 dark:text-white/70">
              <span className={`h-3 w-3 shrink-0 rounded-full ${item.color} shadow-[0_0_0_8px_rgba(251,124,99,0.08)]`} aria-hidden />
              {item.label}
            </span>
            <span className="shrink-0 font-display text-xl font-black tabular-nums text-ink-950 dark:text-white">
              {fmt.euro(item.value)}
            </span>
          </div>
        ))}
      </div>
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
  const [selectedYears, setSelectedYears] = useState<number[] | null>(() => [new Date().getFullYear()]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [localCategoryOverrides, setLocalCategoryOverrides] = useState<Record<string, string>>({});
  const transactions = useMemo(
    () =>
      initialTransactions.map((tx) => {
        const category = localCategoryOverrides[tx.id];
        return category ? { ...tx, category } : tx;
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

  const handleRecategorized = useCallback((transactionId: string, category: string) => {
    setLocalCategoryOverrides((prev) => ({ ...prev, [transactionId]: category }));
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
        periodLabel={analysis.periodLabel}
        onRecategorized={handleRecategorized}
      />

      <RecoverableVatMonthlyBlock
        rows={analysis.vatRecoverableMonthlyRows}
        fmt={fmt}
        periodLabel={analysis.periodLabel}
      />

      <VatLiabilityBlock
        liability={analysis.vatLiability}
        fmt={fmt}
        periodLabel={analysis.periodLabel}
      />

      <DebtDistributionBlock
        tvaDebtEur={analysis.vatLiability.remainingVatEur}
        csgDebtEur={analysis.cashTree.csgEur}
        fmt={fmt}
      />

    </div>
  );
}
