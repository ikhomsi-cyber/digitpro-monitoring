"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ChevronDown,
  HelpCircle,
  TrendingUp
} from "lucide-react";
import { clsx } from "clsx";
import { AppSectionNav } from "@/components/AppSectionNav";
import { DashboardPeriodFilterSection } from "@/components/dashboard/DashboardPeriodFilterSection";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { buildDashboardYearOptions, toggleDashboardYearInFilter } from "@/lib/dashboard-period";
import { useBillableActivityOptional } from "@/components/dashboard/BillableActivityContext";
import {
  analyzeValeurReelle,
  countBillableDaysForAnalyticsFilter
} from "@/lib/valeur-reelle-analyze";
import type {
  ValeurReelleCashTree,
  ValeurReelleWaterfallBreakdownRow,
  ValeurReelleWaterfallStep
} from "@/lib/valeur-reelle-analyze";
import {
  groupMetaForKind,
  PEDAGOGIC_TOOLTIPS,
  VALEUR_REELLE_GROUP_META,
  type ValeurReelleGroup,
  type ValeurReelleKind
} from "@/lib/valeur-reelle-config";

function PedagogicTooltip({ text, detail }: { text: string; detail?: string }) {
  return (
    <span className="group relative inline-flex">
      <HelpCircle
        className="h-3.5 w-3.5 cursor-help text-ink-400 transition hover:text-emerald-600 dark:text-white/35 dark:hover:text-emerald-300"
        aria-hidden
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-ink-200/90 bg-white px-3 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-ink-700 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
      >
        {text}
        {detail ? <span className="mt-1 block text-ink-500 dark:text-ink-400">{detail}</span> : null}
      </span>
    </span>
  );
}

function CashFlowTreeVisual({
  tree,
  fmt,
  billableDays,
  periodLabel
}: {
  tree: ValeurReelleCashTree;
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  billableDays: number;
  periodLabel: string;
}) {
  const reelParJour =
    billableDays > 0 ? Math.round((tree.realEarningsEur / billableDays) * 100) / 100 : null;
  const percentOfCa = (amount: number) =>
    tree.caFactureEur > 0 ? Math.round((amount / tree.caFactureEur) * 1000) / 10 : 0;

  const rows: Array<{
    icon?: string;
    label: string;
    detail?: string;
    amount: number | null;
    gaugeAmount?: number;
    breakdown?: ValeurReelleWaterfallBreakdownRow[];
    transactions?: ValeurReelleCashTree["mandatoryFeeTransactions"];
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
      icon: "🧾",
      label: "frais obligatoires",
      detail: "Hiway, impôt, URSSAF, SFR, Free, mutuelle Wemind et autres",
      amount: -tree.mandatoryFeesEur,
      gaugeAmount: tree.mandatoryFeesEur,
      breakdown: tree.mandatoryFeesBreakdown,
      transactions: tree.mandatoryFeeTransactions,
      tone: "deduct"
    },
    {
      icon: "🏠",
      label: "charges perso",
      detail: "NDF, IK, CESU",
      amount: -tree.personalChargesEur,
      gaugeAmount: tree.personalChargesEur,
      breakdown: tree.personalChargesBreakdown,
      tone: "deduct"
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
      icon: "📘",
      label: "BNC",
      detail: "somme des transactions virement BNC",
      amount: tree.bncEur,
      gaugeAmount: tree.bncEur,
      tone: "result"
    }
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
              {billableDays} jour{billableDays > 1 ? "s" : ""} facturé{billableDays > 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <p className="max-w-[12rem] text-right text-[10px] leading-snug text-ink-500 dark:text-white/40">
            Cochez vos jours travaillés sur le dashboard pour le réel / jour.
          </p>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/45 p-3 dark:bg-white/[0.025]">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-ink-800 dark:text-white/80">Jauge du CA HT</span>
          <span className="tabular-nums text-ink-500 dark:text-white/45">{fmt.euro(tree.caFactureEur)} = 100 %</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.08]">
          {[
            { key: "mandatory", value: tree.mandatoryFeesEur, color: "bg-rose-500" },
            { key: "csg", value: tree.csgEur, color: "bg-orange-400" },
            { key: "personal", value: tree.personalChargesEur, color: "bg-emerald-500" },
            { key: "bnc", value: tree.bncEur, color: "bg-sky-500" }
          ].map((segment) => {
            const width = Math.max(0, Math.min(100, percentOfCa(segment.value)));
            return width > 0 ? (
              <span
                key={segment.key}
                className={segment.color}
                style={{ width: `${width}%` }}
                aria-hidden
              />
            ) : null;
          })}
        </div>
        <div className="mt-2 grid gap-1.5 text-[10px] text-ink-500 dark:text-white/45 sm:grid-cols-4">
          <span><span className="text-rose-500">●</span> frais {percentOfCa(tree.mandatoryFeesEur)} %</span>
          <span><span className="text-orange-400">●</span> CSG {percentOfCa(tree.csgEur)} %</span>
          <span><span className="text-emerald-500">●</span> perso {percentOfCa(tree.personalChargesEur)} %</span>
          <span><span className="text-sky-500">●</span> BNC {percentOfCa(tree.bncEur)} %</span>
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
                "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 rounded-xl border border-transparent px-3 py-2",
                row.emphasize
                  ? "border-emerald-500/15 bg-emerald-500/8 dark:bg-emerald-500/10"
                  : "bg-white/45 dark:bg-white/[0.025]"
              )}
            >
              <span className="min-w-0 font-sans">
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
                {row.detail ? (
                  <span className="mt-0.5 block font-sans text-[10px] font-normal text-ink-500 dark:text-white/40">
                    {row.detail}
                    {row.gaugeAmount != null ? ` · ${percentOfCa(row.gaugeAmount)} % du CA HT` : ""}
                  </span>
                ) : null}
                {row.breakdown?.length ? (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {row.breakdown.map((b) => {
                      const chipTransactions = row.transactions?.filter((tx) => tx.group === b.label) ?? [];

                      return (
                        <span
                          key={`${row.label}-${b.label}`}
                          className="group/chip relative inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-ink-600 ring-1 ring-transparent transition hover:bg-white hover:text-ink-900 hover:ring-ink-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:bg-white/[0.06] dark:text-white/55 dark:hover:bg-white/[0.1] dark:hover:text-white dark:hover:ring-white/10"
                          tabIndex={chipTransactions.length ? 0 : -1}
                        >
                          {b.label} {fmt.euro(b.amountEur)}
                          {chipTransactions.length ? (
                            <span className="pointer-events-none absolute left-0 top-full z-40 mt-2 hidden w-[24rem] max-w-[86vw] overflow-hidden rounded-2xl border border-ink-200/80 bg-white/95 text-left font-normal text-ink-700 shadow-2xl shadow-ink-950/15 ring-1 ring-black/[0.03] backdrop-blur-xl group-hover/chip:block group-focus/chip:block dark:border-white/10 dark:bg-[#101015]/95 dark:text-white/75 dark:shadow-black/50 dark:ring-white/[0.03]">
                              <span className="block border-b border-ink-100 bg-gradient-to-br from-ink-50 to-white px-3 py-2.5 dark:border-white/[0.06] dark:from-white/[0.08] dark:to-white/[0.025]">
                                <span className="flex items-start justify-between gap-3">
                                  <span>
                                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-white/45">
                                      Transactions
                                    </span>
                                    <span className="mt-0.5 block text-sm font-semibold text-ink-950 dark:text-white">
                                      {b.label}
                                    </span>
                                  </span>
                                  <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-bold tabular-nums text-rose-700 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-400/15">
                                    {fmt.euro(b.amountEur)}
                                  </span>
                                </span>
                                <span className="mt-1 block text-[10px] text-ink-500 dark:text-white/45">
                                  {chipTransactions.length} ligne{chipTransactions.length > 1 ? "s" : ""} prise{chipTransactions.length > 1 ? "s" : ""} en compte
                                </span>
                              </span>
                              <span className="block max-h-56 overflow-auto p-2">
                                {chipTransactions.slice(0, 8).map((tx) => (
                                  <span
                                    key={`${b.label}-${tx.date}-${tx.label}-${tx.amountEur}`}
                                    className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 py-1.5 transition odd:bg-ink-50/70 dark:odd:bg-white/[0.035]"
                                  >
                                    <span className="text-[10px] font-medium tabular-nums text-ink-500 dark:text-white/45">
                                      {tx.date.slice(5)}
                                    </span>
                                    <span className="truncate text-[11px] font-medium text-ink-800 dark:text-white/80">
                                      {tx.label}
                                    </span>
                                    <span className="text-[11px] font-bold tabular-nums text-rose-700 dark:text-rose-200">
                                      {fmt.euro(tx.amountEur)}
                                    </span>
                                  </span>
                                ))}
                                {chipTransactions.length > 8 ? (
                                  <span className="mt-1 block rounded-xl bg-ink-50 px-2 py-1.5 text-center text-[10px] font-medium text-ink-500 dark:bg-white/[0.04] dark:text-white/45">
                                    +{chipTransactions.length - 8} autres transactions
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </span>
                ) : null}
              </span>
              <span className={clsx("shrink-0 text-right font-semibold tabular-nums", amountClass)}>
                {row.amount >= 0 && row.tone !== "deduct" ? "" : row.amount < 0 ? "−" : ""}
                {fmt.euro(Math.abs(row.amount))}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function WaterfallBreakdownList({
  rows,
  fmt,
  stepId
}: {
  rows: ValeurReelleWaterfallBreakdownRow[];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
  stepId: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-2 text-[11px] text-ink-500 dark:text-white/40">
        Aucune sous-catégorie sur la période.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-ink-100/80 dark:divide-white/[0.05]">
      {rows.map((row) => (
        <li
          key={`${stepId}-${row.label}`}
          className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]"
        >
          <span className="min-w-0 truncate text-ink-700 dark:text-white/75">{row.label}</span>
          <span className="flex shrink-0 items-center gap-2 tabular-nums">
            {row.count > 0 ? (
              <span className="text-ink-400 dark:text-white/30">{row.count} mvts</span>
            ) : null}
            <span
              className={clsx(
                "font-semibold",
                row.amountEur >= 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-700 dark:text-rose-300"
              )}
            >
              {row.amountEur >= 0 ? "+" : ""}
              {fmt.euro(row.amountEur)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function WaterfallFlow({
  steps,
  fmt
}: {
  steps: ValeurReelleWaterfallStep[];
  fmt: ReturnType<typeof useDashboardDisplayFormat>;
}) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.cumulativeEur)), 1);

  return (
    <motion.div className="space-y-0">
      {steps.map((step, i) => {
        const widthPct = Math.max(8, (Math.abs(step.cumulativeEur) / maxAbs) * 100);
        const barTone =
          step.tone === "emerald"
            ? "from-emerald-400 to-emerald-600"
            : step.tone === "rose"
              ? "from-rose-400 to-rose-600"
              : step.tone === "green"
                ? "from-green-400 to-emerald-500"
                : step.tone === "amber"
                  ? "from-amber-400 to-orange-500"
                  : "from-sky-400 to-blue-600";

        return (
          <div key={step.id}>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-[9.5rem] shrink-0">
                <p className="text-xs font-semibold text-ink-800 dark:text-white/90">{step.label}</p>
                <p
                  className={clsx(
                    "mt-0.5 font-display text-sm font-bold tabular-nums",
                    step.deltaEur >= 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  )}
                >
                  {step.deltaEur >= 0 ? "+" : ""}
                  {fmt.euro(step.deltaEur)}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-3 overflow-hidden rounded-full bg-ink-100/90 dark:bg-white/[0.06]">
                  <motion.div
                    className={clsx("h-full rounded-full bg-gradient-to-r shadow-sm", barTone)}
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                  />
                </div>
                <p className="mt-1 text-[10px] tabular-nums text-ink-500 dark:text-white/40">
                  Cumul : {fmt.euro(step.cumulativeEur)}
                </p>
              </div>
            </motion.div>
            {i < steps.length - 1 ? (
              <div className="flex justify-center py-0.5 text-ink-300 dark:text-white/20" aria-hidden>
                <ArrowDown className="h-4 w-4" />
              </div>
            ) : null}
          </div>
        );
      })}
    </motion.div>
  );
}

const FILTER_OPTIONS: Array<{ id: "all" | ValeurReelleGroup; label: string }> = [
  { id: "all", label: "Tout" },
  ...(
    [
      "real_expense",
      "hidden_value",
      "passive_income",
      "active_income",
      "mixed"
    ] as const
  ).map((g) => ({
    id: g,
    label: `${VALEUR_REELLE_GROUP_META[g].emoji} ${VALEUR_REELLE_GROUP_META[g].filterLabel}`
  }))
];

function KindBadge({ kind }: { kind: ValeurReelleKind }) {
  const meta = groupMetaForKind(kind);
  const toneClass =
    meta.tone === "red"
      ? "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
      : meta.tone === "green"
        ? "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        : meta.tone === "orange"
          ? "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          : meta.tone === "violet"
            ? "border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
            : "border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200";

  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        toneClass
      )}
    >
      {meta.emoji} {meta.shortLabel}
    </span>
  );
}

export function ValeurReelleClient({
  initialTransactions,
  transactionYearBounds,
  demoMode,
  loadError
}: {
  initialTransactions: readonly DashboardTx[];
  transactionYearBounds: { minYear: number; maxYear: number } | null;
  demoMode: boolean;
  loadError: string | null;
}) {
  const fmt = useDashboardDisplayFormat();
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null);
  const [groupFilter, setGroupFilter] = useState<"all" | ValeurReelleGroup>("all");

  const yearOptions = useMemo(
    () => buildDashboardYearOptions(transactionYearBounds, initialTransactions),
    [transactionYearBounds, initialTransactions]
  );

  const onToggleYear = useCallback(
    (y: number) => {
      setSelectedYears(toggleDashboardYearInFilter(y, yearOptions));
    },
    [yearOptions]
  );

  const analysis = useMemo(
    () => analyzeValeurReelle(initialTransactions, { years: selectedYears }),
    [initialTransactions, selectedYears]
  );

  const filteredMovements = useMemo(() => {
    if (groupFilter === "all") return analysis.movements.slice(0, 80);
    return analysis.movements.filter((m) => m.group === groupFilter).slice(0, 80);
  }, [analysis.movements, groupFilter]);

  const billableActivity = useBillableActivityOptional();
  const billableDaysInPeriod = useMemo(
    () =>
      countBillableDaysForAnalyticsFilter(
        billableActivity?.sortedIsos ?? [],
        selectedYears
      ),
    [billableActivity?.sortedIsos, selectedYears]
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-800 dark:text-brand-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour au dashboard
      </Link>

      <header className="relative overflow-hidden rounded-3xl border border-ink-200/80 bg-gradient-to-br from-white via-white to-violet-50/50 px-5 py-8 shadow-[0_24px_80px_-28px_rgba(124,58,237,0.25)] dark:border-white/[0.08] dark:from-[#101018] dark:via-[#0a0a0f] dark:to-[#050505] sm:px-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/20"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-700/90 dark:text-violet-300/85">
            DigitPro Monitoring
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
            Analyse de valeur réelle
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-white/55">
            Comprenez ce qui est vraiment consommé, ce qui cache de la valeur, et ce qui reste dans votre
            poche — {analysis.periodLabel}, périmètre SASU.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              {analysis.classifiedCount} lignes classées
            </span>
            <PedagogicTooltip text={PEDAGOGIC_TOOLTIPS.waterfall} />
          </div>
        </div>
      </header>

      {demoMode ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Mode démo — montants fictifs.</p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {loadError}
        </p>
      ) : null}

      <AppSectionNav offset="dashboard" maxWidthClass="max-w-6xl" />

      <DashboardPeriodFilterSection
        selectedYears={selectedYears}
        setSelectedYears={setSelectedYears}
        yearOptions={yearOptions}
        onToggleYear={onToggleYear}
      />

      <CashFlowTreeVisual
        tree={analysis.cashTree}
        fmt={fmt}
        billableDays={billableDaysInPeriod}
        periodLabel={analysis.periodLabel}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="solid" className="overflow-hidden">
          <CardHeader className="border-b border-ink-100/80 dark:border-white/[0.06]">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Cascade valeur réelle
            </CardTitle>
            <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
              CA → charges entreprise → avantages & flux → impôts → valeur finale
            </p>
          </CardHeader>
          <CardBody className="p-4 sm:p-5">
            <WaterfallFlow steps={analysis.waterfall} fmt={fmt} />
          </CardBody>
        </Card>

        <Card variant="solid">
          <CardHeader className="border-b border-ink-100/80 dark:border-white/[0.06]">
            <CardTitle className="text-base">Répartition par catégorie</CardTitle>
          </CardHeader>
          <CardBody className="max-h-[22rem] overflow-y-auto p-0">
            <ul className="divide-y divide-ink-100 dark:divide-white/[0.06]">
              {analysis.categoryRows.slice(0, 14).map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900 dark:text-white">{row.label}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500 dark:text-white/40">
                        <KindBadge kind={row.kind} />
                        <span>
                          {row.count} ligne{row.count > 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums text-ink-900 dark:text-white">
                        {fmt.euro(row.totalEur)}
                      </p>
                      {row.hiddenValueEur > 0 ? (
                        <p className="text-[10px] tabular-nums text-emerald-700 dark:text-emerald-300">
                          +{fmt.euro(row.hiddenValueEur)} valeur
                        </p>
                      ) : null}
                    </div>
                  </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card variant="solid">
        <CardHeader className="flex flex-col gap-3 border-b border-ink-100/80 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06]">
          <CardTitle className="text-base">Détail des mouvements classés</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGroupFilter(opt.id)}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                  groupFilter === opt.id
                    ? "bg-ink-900 text-white dark:bg-emerald-500 dark:text-ink-950"
                    : "bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-white/10 dark:text-white/70"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody className="divide-y divide-ink-100 p-0 dark:divide-white/[0.06]">
          {filteredMovements.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">Aucun mouvement pour ce filtre.</p>
          ) : (
            filteredMovements.map((m) => (
              <motion.div
                key={m.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-white">{m.label}</p>
                    <KindBadge kind={m.kind} />
                  </div>
                  <p className="text-[10px] text-ink-500 dark:text-white/40">
                    {m.date} · {m.sublabel}
                    {m.recoveredValuePercent > 0 ? ` · ${m.recoveredValuePercent} % récup.` : ""}
                  </p>
                  <p className="mt-1 text-[10px] italic text-ink-500 dark:text-white/35">{m.tooltip}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={clsx(
                      "font-display text-sm font-semibold tabular-nums",
                      m.amount >= 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {fmt.euro(m.amount)}
                  </p>
                  {m.hiddenValueEur > 0 ? (
                    <p className="text-[10px] tabular-nums text-emerald-700 dark:text-emerald-300">
                      +{fmt.euro(m.hiddenValueEur)} récup.
                    </p>
                  ) : null}
                </div>
              </motion.div>
            ))
          )}
        </CardBody>
      </Card>
    </main>
  );
}
