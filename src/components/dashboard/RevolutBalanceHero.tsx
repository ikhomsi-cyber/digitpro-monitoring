"use client";

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
  const csgRemainingEur = cashEur == null
    ? null
    : Math.max(0, Math.round((stats.csgComparaison172Eur + stats.detteTvaDepuisDebutEur - cashEur) * 100) / 100);

  return (
    <section className={dashboardHeroSection} data-private>
      <p className="text-sm font-medium text-ink-500 dark:text-white/55">Cash disponible · EUR</p>
      <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-apple-tight text-ink-900 dark:text-white sm:text-5xl">
        {cashEur != null ? fmt.euro(cashEur) : "—"}
      </p>
      {statsReady ? (
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
              {positive ? "Rémunération à verser" : "Dette nette"}
            </span>
            <span className="tabular-nums">{fmt.euro(Math.abs(remunerationEur))}</span>
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
            <span className="tabular-nums">{csgRemainingEur == null ? "—" : fmt.euro(csgRemainingEur)}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
