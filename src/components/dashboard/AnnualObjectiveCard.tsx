"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { computeAnnualObjectiveTracking } from "@/lib/annual-objective";
import type { KpiTrend } from "@/lib/kpi-month-trend";
import { KpiTrendBadge } from "@/components/dashboard/KpiTrendBadge";
import { dashboardFlatKpi } from "@/lib/dashboard-surfaces";

type Props = {
  achievedHtEur: number;
  trend?: KpiTrend | null;
};

function parseTargetInput(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function AnnualObjectiveCard({ achievedHtEur, trend }: Props) {
  const fmt = useDashboardDisplayFormat();
  const { annualRevenueTargetHt, setAnnualRevenueTargetHt } = useBillableActivity();
  const [draft, setDraft] = useState(
    annualRevenueTargetHt != null ? String(Math.round(annualRevenueTargetHt)) : ""
  );

  useEffect(() => {
    setDraft(annualRevenueTargetHt != null ? String(Math.round(annualRevenueTargetHt)) : "");
  }, [annualRevenueTargetHt]);

  const tracking = useMemo(
    () => computeAnnualObjectiveTracking(annualRevenueTargetHt, achievedHtEur),
    [annualRevenueTargetHt, achievedHtEur]
  );

  function commitDraft() {
    setAnnualRevenueTargetHt(parseTargetInput(draft));
  }

  const progressPct = tracking?.completionPct ?? 0;
  const progressTone = "bg-teal-500 dark:bg-teal-400";

  return (
    <div className={dashboardFlatKpi}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
              Objectif annuel
            </p>
            <KpiTrendBadge trend={trend} title="CA HT du mois vs mois précédent" />
          </div>
          <p className="mt-0.5 text-[10px] font-medium text-ink-400 dark:text-white/35">
            CA HT encaissé · {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Objectif annuel de CA HT</span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
            placeholder="Ex. 120000"
            className="w-full rounded-xl border border-ink-200/80 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-ink-900 outline-none ring-0 placeholder:font-medium placeholder:text-ink-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200/80 dark:border-cyan-100/[0.14] dark:bg-[#06242b]/55 dark:text-white dark:placeholder:text-white/30 dark:focus:border-emerald-400/35 dark:focus:ring-emerald-400/15"
          />
          <span className="shrink-0 text-[11px] font-bold text-ink-500 dark:text-white/45">€ HT</span>
        </div>
      </label>

      {tracking ? (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Objectif", value: fmt.euro(tracking.targetHtEur) },
              { label: "Réalisé", value: fmt.euro(tracking.achievedHtEur) },
              { label: "Reste", value: fmt.euro(tracking.remainingHtEur) },
              { label: "Avancement", value: `${fmt.int(progressPct)} %` }
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-ink-200/70 bg-white/55 px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <dt className="text-[9px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
                  {row.label}
                </dt>
                <dd className="mt-1 font-display text-sm font-bold tabular-nums text-ink-900 dark:text-white">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-ink-500 dark:text-white/45">
              <span>Progression</span>
              <span className="tabular-nums">{fmt.int(progressPct)} %</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-200/70 dark:bg-[#06242b]/70">
              <div
                className={clsx("h-full rounded-full transition-[width] duration-500", progressTone)}
                style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] font-medium text-ink-500 dark:text-white/40">
          Saisissez un objectif annuel de CA HT pour suivre votre avancement.
        </p>
      )}
    </div>
  );
}
