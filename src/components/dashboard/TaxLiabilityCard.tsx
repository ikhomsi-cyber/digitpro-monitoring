"use client";

import { useMemo } from "react";
import { Landmark } from "lucide-react";
import { clsx } from "clsx";
import {
  computeTaxLiabilityCoverage,
  type TaxLiabilityCoverageTone
} from "@/lib/tax-liability";
import type { KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";

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

const COVERAGE_STYLES: Record<
  TaxLiabilityCoverageTone,
  { badge: string; bar: string; label: string }
> = {
  green: {
    badge: "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200",
    bar: "bg-emerald-500 dark:bg-emerald-400",
    label: "Couverture confortable"
  },
  orange: {
    badge: "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100",
    bar: "bg-amber-500 dark:bg-amber-400",
    label: "Couverture limite"
  },
  red: {
    badge: "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100",
    bar: "bg-rose-500 dark:bg-rose-400",
    label: "Trésorerie insuffisante"
  },
  neutral: {
    badge: "border-ink-200/80 bg-ink-50 text-ink-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70",
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
    coverage.coveragePct == null
      ? 0
      : Math.max(0, Math.min(100, (coverage.coveragePct / 120) * 100));

  const breakdownTotal = Math.max(coverage.vatEur + coverage.csgEur, 1);

  return (
    <div className="flex h-full min-h-[8.75rem] flex-col rounded-2xl border border-ink-200/80 bg-white/75 px-4 py-4 shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
              Dettes fiscales
            </p>
            <KpiTrendBadge trend={trend} />
          </div>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink-900 dark:text-white sm:text-2xl">
            {statsReady ? formatEuro(coverage.totalLiabilityEur) : "Calcul…"}
          </p>
        </div>
        <PremiumIconBadge icon={Landmark} tone="orange" size="md" />
      </div>

      {statsReady ? (
        <>
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
              Détail
            </p>
            <div className="flex h-2 overflow-hidden rounded-full bg-ink-200/70 dark:bg-[#06242b]/70">
              <div
                className="bg-cyan-400 dark:bg-cyan-300"
                style={{ width: `${(coverage.vatEur / breakdownTotal) * 100}%` }}
                title={`TVA : ${formatEuro(coverage.vatEur)}`}
                aria-hidden
              />
              <div
                className="bg-orange-400 dark:bg-orange-300"
                style={{ width: `${(coverage.csgEur / breakdownTotal) * 100}%` }}
                title={`CSG : ${formatEuro(coverage.csgEur)}`}
                aria-hidden
              />
            </div>
            <dl className="grid grid-cols-2 gap-2">
              {[
                { label: "TVA", value: coverage.vatEur, dot: "bg-cyan-400" },
                { label: "CSG", value: coverage.csgEur, dot: "bg-orange-400" }
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-ink-200/70 bg-white/55 px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]"
                >
                  <dt className="flex items-center gap-1.5 text-[10px] font-bold text-ink-500 dark:text-white/45">
                    <span className={clsx("h-2 w-2 rounded-full", row.dot)} aria-hidden />
                    {row.label}
                  </dt>
                  <dd className="mt-1 font-display text-sm font-bold tabular-nums text-ink-900 dark:text-white">
                    {formatEuro(row.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-3 rounded-xl border border-ink-200/70 bg-white/55 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
                  Couverture trésorerie
                </p>
                <p className="text-[10px] text-ink-500 dark:text-white/45">Cash / dettes</p>
              </div>
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                  styles.badge
                )}
              >
                {coverage.coveragePct != null ? `${formatInt(coverage.coveragePct)} %` : "—"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-200/70 dark:bg-[#06242b]/70">
              <div
                className={clsx("h-full rounded-full transition-[width] duration-500", styles.bar)}
                style={{ width: `${barWidthPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-ink-500 dark:text-white/40">
              {styles.label}
              {coverage.coveragePct != null ? (
                <span className="text-ink-400 dark:text-white/35">
                  {" "}
                  · {formatEuro(coverage.cashEur)} / {formatEuro(coverage.totalLiabilityEur)}
                </span>
              ) : null}
            </p>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[11px] font-medium text-ink-500 dark:text-white/40">
          Calcul des dettes TVA et CSG en cours…
        </p>
      )}
    </div>
  );
}
