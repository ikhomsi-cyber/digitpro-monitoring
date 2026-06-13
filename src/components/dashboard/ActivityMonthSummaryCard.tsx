"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ReceiptText } from "lucide-react";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  cleanNdfMerchantLabel,
  formatNdfTxDateLabel,
  ndfDigitProAmountHtEur
} from "@/lib/ndf-digitpro";

export type ActivityMealFeesSummary = {
  dirigeant: number;
  ndfAffiche: number;
  total: number;
  ndfTransactions: DashboardTx[];
  pendingNdfTransactions: DashboardTx[];
};

const IK_REFERENCE_EUR = 550;
const MEALS_REFERENCE_EUR = 650;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function FeeProgress({ value, max }: { value: number; max: number }) {
  const pct = clamp01(max > 0 ? value / max : 0);
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-200/60 dark:bg-white/[0.08]">
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] dark:bg-brand-400"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export function ActivityMonthSummaryCard({
  countedDays,
  ikTotalEur,
  ikPerDayEur,
  mealFees
}: {
  countedDays: number;
  ikTotalEur: number;
  ikPerDayEur: number;
  mealFees: ActivityMealFeesSummary | null;
}) {
  const fmt = useDashboardDisplayFormat();
  const [ndfListOpen, setNdfListOpen] = useState(false);

  const mealsTotal = mealFees?.total ?? 0;

  return (
    <article className={clsx(dashboardInsightCard, "w-full")}>
      <div className="space-y-5">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-ink-500 dark:text-white/50">IK aller-retour</p>
            <p className="font-display text-lg font-semibold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(ikTotalEur)}
            </p>
          </div>
          <p className="text-xs tabular-nums text-ink-400 dark:text-white/38">
            {fmt.int(countedDays)} j. × {fmt.euro(ikPerDayEur)} · plafond {fmt.euro(IK_REFERENCE_EUR)}
          </p>
          <FeeProgress value={ikTotalEur} max={IK_REFERENCE_EUR} />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-ink-500 dark:text-white/50">Repas &amp; NDF</p>
            <p className="font-display text-lg font-semibold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(mealsTotal)}
            </p>
          </div>
          {mealFees ? (
            <p className="text-xs text-ink-400 dark:text-white/38">
              Dirigeant {fmt.euro(mealFees.dirigeant)} · NDF {fmt.euro(mealFees.ndfAffiche)}
            </p>
          ) : null}
          <FeeProgress value={mealsTotal} max={MEALS_REFERENCE_EUR} />

          {mealFees &&
          (mealFees.ndfTransactions.length > 0 || mealFees.pendingNdfTransactions.length > 0) ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setNdfListOpen((v) => !v)}
                aria-expanded={ndfListOpen}
                className="flex w-full items-center justify-between gap-2 py-1 text-left transition hover:opacity-80"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 dark:text-white/60">
                  <ReceiptText className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                  {mealFees.ndfTransactions.length} NDF validée
                  {mealFees.ndfTransactions.length > 1 ? "s" : ""}
                  {mealFees.pendingNdfTransactions.length > 0
                    ? ` · ${mealFees.pendingNdfTransactions.length} à valider`
                    : ""}
                </span>
                <ChevronDown
                  className={clsx(
                    "h-4 w-4 text-ink-400 transition-transform dark:text-white/40",
                    ndfListOpen && "rotate-180"
                  )}
                  strokeWidth={2.2}
                  aria-hidden
                />
              </button>
              {ndfListOpen ? (
                <div className="mt-2 space-y-3">
                  {mealFees.pendingNdfTransactions.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-600 dark:text-white/55">
                          À valider
                        </p>
                        <Link
                          href="/dashboard?section=categorisation"
                          scroll={false}
                          className="text-[10px] font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
                        >
                          Catégorisation
                        </Link>
                      </div>
                      <ul className="scrollbar-clean max-h-36 space-y-0 overflow-y-auto overscroll-contain">
                        {mealFees.pendingNdfTransactions.map((tx) => {
                          const dateLabel = formatNdfTxDateLabel(tx.date);
                          const isToday = dateLabel === "Aujourd’hui";
                          return (
                            <li
                              key={`pending-${tx.id}`}
                              className="flex items-center justify-between gap-2 border-b border-ink-200/30 py-2 last:border-b-0 dark:border-white/[0.06]"
                            >
                              <span className="min-w-0">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate text-xs font-semibold text-ink-900 dark:text-white">
                                    {cleanNdfMerchantLabel(tx.label)}
                                  </span>
                                  {isToday ? (
                                    <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-ink-600 dark:bg-white/[0.08] dark:text-white/65">
                                      Auj.
                                    </span>
                                  ) : null}
                                </span>
                                <span className="text-[10px] text-ink-400 dark:text-white/35">{dateLabel}</span>
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-ink-900 dark:text-white">
                                {fmt.euro(Math.abs(tx.amount))}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  {mealFees.ndfTransactions.length > 0 ? (
                    <ul className="scrollbar-clean max-h-44 space-y-0 overflow-y-auto overscroll-contain">
                      {mealFees.ndfTransactions.map((tx) => {
                        const dateLabel = formatNdfTxDateLabel(tx.date);
                        const isToday = dateLabel === "Aujourd’hui";
                        return (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between gap-2 border-b border-ink-200/30 py-2 last:border-b-0 dark:border-white/[0.06]"
                          >
                            <span className="min-w-0">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-xs font-semibold text-ink-900 dark:text-white">
                                  {cleanNdfMerchantLabel(tx.label)}
                                </span>
                                {isToday ? (
                                  <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-ink-600 dark:bg-white/[0.08] dark:text-white/65">
                                    Auj.
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-[10px] text-ink-400 dark:text-white/35">{dateLabel}</span>
                            </span>
                            <span className="text-right">
                              <span className="block text-xs font-semibold tabular-nums text-ink-900 dark:text-white">
                                {fmt.euro(Math.abs(tx.amount))}
                              </span>
                              <span className="block text-[10px] tabular-nums text-ink-400 dark:text-white/38">
                                {fmt.euro(ndfDigitProAmountHtEur(tx))} HT
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-400 dark:text-white/38">
              Aucune NDF —{" "}
              <Link
                href="/dashboard?section=categorisation"
                scroll={false}
                className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
              >
                Catégorisation
              </Link>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
