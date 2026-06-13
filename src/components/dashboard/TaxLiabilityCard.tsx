"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import {
  computeTaxLiabilityCoverage,
  type TaxLiabilityCoverageTone
} from "@/lib/tax-liability";
import type { KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";

type Props = {
  cashEur: number | null;
  vatEur: number;
  csgEur: number;
  totalLiabilityEur: number;
  statsReady: boolean;
  formatEuro: (n: number) => string;
  formatInt: (n: number) => number;
  trend?: KpiTrend | null;
};

const COVERAGE_STYLES: Record<TaxLiabilityCoverageTone, { bar: string; label: string }> = {
  green: {
    bar: "bg-emerald-500 dark:bg-emerald-400",
    label: "Couverture confortable"
  },
  orange: {
    bar: "bg-amber-500 dark:bg-amber-400",
    label: "Couverture limite"
  },
  red: {
    bar: "bg-rose-500 dark:bg-rose-400",
    label: "Trésorerie insuffisante"
  },
  neutral: {
    bar: "bg-ink-400 dark:bg-white/40",
    label: "Aucune dette provisionnée"
  }
};

export function TaxLiabilityCard({
  cashEur,
  vatEur,
  csgEur,
  totalLiabilityEur,
  statsReady,
  formatEuro,
  formatInt,
  trend
}: Props) {
  const coverage = useMemo(
    () => computeTaxLiabilityCoverage(cashEur, totalLiabilityEur, vatEur, csgEur),
    [cashEur, csgEur, totalLiabilityEur, vatEur]
  );

  const styles = COVERAGE_STYLES[coverage.coverageTone];
  const barWidthPct =
    coverage.coveragePct == null ? 0 : Math.max(0, Math.min(100, coverage.coveragePct));

  const breakdownTotal = Math.max(coverage.vatEur + coverage.csgEur, 1);

  return (
    <div className={dashboardInsightCard}>
      <p className="text-sm text-ink-500 dark:text-white/50">Dettes fiscales</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
          {statsReady ? formatEuro(coverage.totalLiabilityEur) : "Calcul…"}
        </p>
        <KpiTrendBadge trend={trend} />
      </div>

      {statsReady ? (
        <>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 text-ink-600 dark:text-white/60">
              <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
              TVA{" "}
              <span className="font-medium tabular-nums text-ink-800 dark:text-white/85">
                {formatEuro(coverage.vatEur)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-600 dark:text-white/60">
              <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden />
              CSG{" "}
              <span className="font-medium tabular-nums text-ink-800 dark:text-white/85">
                {formatEuro(coverage.csgEur)}
              </span>
            </span>
          </div>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-ink-200/60 dark:bg-white/[0.08]">
            <div
              className="bg-sky-400 dark:bg-sky-400"
              style={{ width: `${(coverage.vatEur / breakdownTotal) * 100}%` }}
              title={`TVA : ${formatEuro(coverage.vatEur)}`}
              aria-hidden
            />
            <div
              className="bg-orange-400 dark:bg-orange-400"
              style={{ width: `${(coverage.csgEur / breakdownTotal) * 100}%` }}
              title={`CSG : ${formatEuro(coverage.csgEur)}`}
              aria-hidden
            />
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-200/60 dark:bg-white/[0.08]">
            <div
              className={clsx("h-full rounded-full transition-[width] duration-500", styles.bar)}
              style={{ width: `${barWidthPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-500 dark:text-white/45">
            <span>{styles.label}</span>
            <span className="tabular-nums">
              {coverage.coveragePct != null ? `${formatInt(coverage.coveragePct)} %` : "—"}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-ink-500 dark:text-white/45">Calcul des dettes TVA et CSG en cours…</p>
      )}
    </div>
  );
}
