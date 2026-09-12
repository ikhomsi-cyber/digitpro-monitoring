"use client";

import { useState } from "react";
import { Check, ChevronDown, ReceiptText, X } from "lucide-react";
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

/** Plafonds de repli si l'historique 12 mois est indisponible (aucune donnée). */
const IK_REFERENCE_FALLBACK_EUR = 550;
const MEALS_REFERENCE_FALLBACK_EUR = 650;

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
  annualKm,
  annualBilledDays,
  mealFees,
  ikReferenceEur,
  ikReferenceMonths,
  mealsReferenceEur,
  mealsReferenceMonths,
  onNdfArbitration
}: {
  countedDays: number;
  ikTotalEur: number;
  ikPerDayEur: number;
  /** Kilométrage annuel auto-calculé (A/R × jours facturés sur l'année). */
  annualKm?: number;
  /** Jours facturés sur l'année (base du barème). */
  annualBilledDays?: number;
  mealFees: ActivityMealFeesSummary | null;
  /** Plafond IK = moyenne mensuelle des IK versées (repli sur une valeur fixe sinon). */
  ikReferenceEur?: number;
  /** Nombre de mois réellement comptés dans la moyenne IK (≤ 12). */
  ikReferenceMonths?: number;
  /** Plafond Repas = moyenne mensuelle (Repas dirigeant + Repas d'affaire) versés (repli sinon). */
  mealsReferenceEur?: number;
  /** Nombre de mois réellement comptés dans la moyenne Repas (≤ 12). */
  mealsReferenceMonths?: number;
  /** Classe une candidate en NDF DigitPro ou dans sa catégorie de rejet suggérée. */
  onNdfArbitration?: (tx: DashboardTx, decision: "ndf" | "not-ndf") => Promise<void>;
}) {
  const fmt = useDashboardDisplayFormat();
  const [ndfListOpen, setNdfListOpen] = useState(false);
  const [pendingDecisionId, setPendingDecisionId] = useState<string | null>(null);

  const decideNdf = async (tx: DashboardTx, decision: "ndf" | "not-ndf") => {
    if (!onNdfArbitration) return;
    setPendingDecisionId(tx.id);
    try {
      await onNdfArbitration(tx, decision);
    } finally {
      setPendingDecisionId(null);
    }
  };

  const mealsTotal = mealFees?.total ?? 0;
  const ikHasHistory = Boolean(ikReferenceEur && ikReferenceEur > 0 && ikReferenceMonths);
  const mealsHasHistory = Boolean(mealsReferenceEur && mealsReferenceEur > 0 && mealsReferenceMonths);
  const ikMax = ikHasHistory ? (ikReferenceEur as number) : IK_REFERENCE_FALLBACK_EUR;
  const mealsMax = mealsHasHistory ? (mealsReferenceEur as number) : MEALS_REFERENCE_FALLBACK_EUR;
  const monthsLabel = (n?: number) => (n && n > 0 ? `moyenne sur ${n} mois` : "valeur de référence");

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
            {fmt.int(countedDays)} j. · dernier trajet {fmt.euro(ikPerDayEur)}
            {annualKm && annualKm > 0 ? (
              <> · barème {fmt.int(annualKm)} km/an</>
            ) : null}
          </p>
          {annualBilledDays && annualBilledDays > 0 ? (
            <p className="mt-0.5 text-[10px] tabular-nums text-ink-400/80 dark:text-white/30">
              Barème fiscal 7 CV et plus · {fmt.int(annualBilledDays)} A/R voiture enregistrés cette année
            </p>
          ) : null}
          <FeeProgress value={ikTotalEur} max={ikMax} />
          <p className="mt-1 text-[10px] tabular-nums text-ink-400/80 dark:text-white/30">
            Plafond {fmt.euro(ikMax)} · {monthsLabel(ikHasHistory ? ikReferenceMonths : undefined)}
          </p>
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
          <FeeProgress value={mealsTotal} max={mealsMax} />
          <p className="mt-1 text-[10px] tabular-nums text-ink-400/80 dark:text-white/30">
            Plafond {fmt.euro(mealsMax)} · {monthsLabel(mealsHasHistory ? mealsReferenceMonths : undefined)}
          </p>

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
                          À arbitrer · {mealFees.pendingNdfTransactions.length}
                        </p>
                      </div>
                      <ul className="scrollbar-clean max-h-64 space-y-0 overflow-y-auto overscroll-contain">
                        {mealFees.pendingNdfTransactions.map((tx) => {
                          const dateLabel = formatNdfTxDateLabel(tx.date);
                          const isToday = dateLabel === "Aujourd’hui";
                          const busy = pendingDecisionId === tx.id;
                          return (
                            <li
                              key={`pending-${tx.id}`}
                              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-2 border-b border-ink-200/30 py-2.5 last:border-b-0 dark:border-white/[0.06]"
                            >
                              <span className="min-w-0 pt-1.5">
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
                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={busy || !onNdfArbitration}
                                  aria-label={`Valider ${cleanNdfMerchantLabel(tx.label)} en NDF DigitPro`}
                                  onClick={() => void decideNdf(tx, "ndf")}
                                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-emerald-600/15 bg-emerald-50 px-3 text-[10px] font-medium text-emerald-700 transition-colors hover:border-emerald-600/30 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-40 dark:border-emerald-300/15 dark:bg-emerald-300/[0.08] dark:text-emerald-200 dark:hover:bg-emerald-300/[0.15] dark:focus-visible:ring-offset-[#103038]"
                                >
                                  <Check className="h-3 w-3" strokeWidth={1.75} aria-hidden /> <span>NDF</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || !onNdfArbitration}
                                  aria-label={`${cleanNdfMerchantLabel(tx.label)} : pas une NDF`}
                                  onClick={() => void decideNdf(tx, "not-ndf")}
                                  className="inline-flex min-h-8 items-center justify-center gap-1 rounded-full px-2.5 text-[10px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 disabled:cursor-wait disabled:opacity-40 dark:text-white/50 dark:hover:bg-white/[0.05] dark:hover:text-white/80"
                                >
                                  <X className="h-3 w-3" strokeWidth={1.5} aria-hidden /> <span>Pas NDF</span>
                                </button>
                              </div>
                              <span className="whitespace-nowrap pt-1.5 text-right text-xs font-semibold tabular-nums text-ink-900 dark:text-white">
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
              Aucune NDF à arbitrer ce mois.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
