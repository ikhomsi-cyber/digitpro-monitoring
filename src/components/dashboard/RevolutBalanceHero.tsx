"use client";

import { computeCsgRemainingEur } from "@/lib/csg-remaining";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { dashboardHeroSection } from "@/lib/dashboard-surfaces";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";

/**
 * Solde mis en avant façon Revolut : cash disponible (solde Qonto) affiché seul et centré,
 * avec la « Rémunération à verser » (cash − dette CSG/TVA) en dessous.
 */
export function RevolutBalanceHero({
  stats,
  statsReady = true
}: {
  stats: DashboardHeroStats;
  statsReady?: boolean;
}) {
  const fmt = useDashboardDisplayFormat();
  const cashEur = stats.soldeQontoEur;
  const remunerationEur = (stats.soldeQontoEur ?? 0) - stats.detteTotaleDepuisDebutEur;
  const positive = remunerationEur >= 0;
  const csgRemainingEur = computeCsgRemainingEur(stats);

  return (
    <section className={dashboardHeroSection} data-private>
      <p className="text-sm font-medium text-ink-500 dark:text-white/55">Cash disponible · EUR</p>
      <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-apple-tight text-ink-900 dark:text-white sm:text-5xl">
        {cashEur != null ? fmt.euro(cashEur) : "—"}
      </p>
        <div className="mt-4 grid w-full max-w-2xl grid-cols-2 gap-2 sm:gap-3">
          <div
            className={clsx(
              "inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-center text-xs font-medium sm:px-4 sm:text-sm",
              positive
                ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-300"
                : "border-rose-300/50 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:text-rose-300"
            )}
          >
            <span className="text-ink-600 dark:text-white/60">
              {!statsReady || positive ? "Rémunération à verser" : "Dette nette"}
            </span>
            <span className="tabular-nums" aria-busy={!statsReady}>{statsReady ? fmt.euro(Math.abs(remunerationEur)) : <span className="inline-block h-4 w-20 animate-pulse rounded bg-current opacity-15" aria-label="Calcul en cours" />}</span>
          </div>
          <div
            className={clsx(
              "inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-center text-xs font-medium sm:px-4 sm:text-sm",
              csgRemainingEur === 0
                ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-300"
                : "border-violet-300/50 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-300"
            )}
            title="CSG à 17,2 % depuis le 01/01/2023 + dette TVA − cash disponible."
          >
            <span className="text-ink-600 dark:text-white/60">Reste à couvrir · CSG 17,2 %</span>
            <span className="tabular-nums" aria-busy={!statsReady}>{!statsReady ? <span className="inline-block h-4 w-20 animate-pulse rounded bg-current opacity-15" aria-label="Calcul en cours" /> : csgRemainingEur == null ? "—" : fmt.euro(csgRemainingEur)}</span>
          </div>
        </div>
    </section>
  );
}
