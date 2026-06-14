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

  return (
    <section className={dashboardHeroSection} data-private>
      <p className="text-sm font-medium text-ink-500 dark:text-white/55">Cash disponible · EUR</p>
      <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-apple-tight text-ink-900 dark:text-white sm:text-5xl">
        {cashEur != null ? fmt.euro(cashEur) : "—"}
      </p>
      {statsReady ? (
        <div
          className={clsx(
            "mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
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
      ) : null}
    </section>
  );
}
