"use client";

import { useMemo, useState } from "react";
import {
  Baby,
  Building2,
  HandCoins,
  HeartHandshake,
  Landmark,
  PiggyBank,
  Sparkles,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import {
  dashboardDenseKpiGrid,
  dashboardEyebrow,
  dashboardFilterPill,
  dashboardHeroSection,
  dashboardInsightCard,
  dashboardInsightGrid,
  dashboardPanelTitle,
  dashboardSectionStack
} from "@/lib/dashboard-surfaces";
import { analyzeAllNotices } from "@/lib/impots/tax-analysis";
import type { TaxOptimizationKind } from "@/lib/impots/types";
import { TaxHistoryChart, type TaxHistoryPoint } from "./TaxHistoryChart";

const OPTIMIZATION_META: Record<
  TaxOptimizationKind,
  { icon: LucideIcon; tone: string }
> = {
  pension_alimentaire: { icon: HeartHandshake, tone: "text-rose-600 dark:text-rose-300 bg-rose-500/10" },
  per: { icon: PiggyBank, tone: "text-violet-600 dark:text-violet-300 bg-violet-500/10" },
  frais_garde: { icon: Baby, tone: "text-sky-600 dark:text-sky-300 bg-sky-500/10" },
  emploi_domicile: { icon: HandCoins, tone: "text-amber-600 dark:text-amber-300 bg-amber-500/10" },
  girardin: { icon: Building2, tone: "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10" },
  autre: { icon: Sparkles, tone: "text-ink-600 dark:text-white/70 bg-ink-500/10" }
};

function KpiCell({
  label,
  value,
  sub,
  privateValue = true
}: {
  label: string;
  value: string;
  sub?: string;
  privateValue?: boolean;
}) {
  return (
    <div className="flex flex-col py-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">{label}</span>
      <span
        className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-950 dark:text-white"
        {...(privateValue ? { "data-private": "" } : {})}
      >
        {value}
      </span>
      {sub ? <span className="mt-0.5 text-[11px] font-medium text-ink-500 dark:text-white/45 tabular-nums">{sub}</span> : null}
    </div>
  );
}

export function ImpotsSection() {
  const fmt = useDashboardDisplayFormat();
  const analyses = useMemo(() => analyzeAllNotices(), []);
  const latest = analyses[analyses.length - 1];
  const yearOptions = useMemo(() => analyses.map((a) => a.notice.revenusYear), [analyses]);
  const [selectedYear, setSelectedYear] = useState(() => latest.notice.revenusYear);
  const selectedAnalysis = useMemo(
    () => analyses.find((a) => a.notice.revenusYear === selectedYear) ?? latest,
    [analyses, selectedYear, latest]
  );
  const yearOptimizations = useMemo(
    () => [...selectedAnalysis.optimizations].sort((a, b) => b.economie - a.economie),
    [selectedAnalysis]
  );
  const yearOptimizationsTotal = selectedAnalysis.totalOptimizations;

  const historyData = useMemo<TaxHistoryPoint[]>(
    () =>
      analyses.map((a) => ({
        year: a.notice.revenusYear,
        label: String(a.notice.revenusYear),
        impotTotal: a.impotTotal,
        tauxMoyen: a.tauxMoyen
      })),
    [analyses]
  );

  return (
    <div className={dashboardSectionStack}>
      <section className="flex flex-col items-center gap-3 text-center">
        <div>
          <p className={dashboardEyebrow}>Impôts</p>
          <h2 className={clsx(dashboardPanelTitle, "mt-1")}>Année fiscale</h2>
          <p className="mt-1 text-[11px] font-medium text-ink-500 dark:text-white/45">
            Avis d'impôt et estimation BNC par année de revenus
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Année des revenus">
          {yearOptions.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={selectedYear === y}
              onClick={() => setSelectedYear(y)}
              className={dashboardFilterPill(selectedYear === y)}
            >
              {y}
            </button>
          ))}
        </div>
      </section>

      {/* Hero */}
      <section className={dashboardHeroSection}>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-500 dark:text-white/42">
          Impôts · foyer fiscal
        </p>
        <p className="mt-3 font-display text-5xl font-bold tabular-nums tracking-tight text-ink-950 dark:text-white" data-private>
          {fmt.euro(selectedAnalysis.impotTotal)}
        </p>
        <p className="mt-2 text-sm font-medium text-ink-500 dark:text-white/55">
          Impôt {selectedAnalysis.notice.revenusYear} · {fmt.euro(selectedAnalysis.impotMensuel)} / mois
          {selectedAnalysis.notice.declarative ? " · estimation déclarative" : ""}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300">
          <Wallet className="h-4 w-4" aria-hidden />
          <span data-private>{fmt.euro(selectedAnalysis.bncNetApresImpot)}</span> nets de BNC après impôt
        </div>
      </section>

      {/* KPIs */}
      <section className={dashboardInsightCard}>
        <div className={dashboardDenseKpiGrid(4)}>
          <KpiCell label={`Impôt ${selectedAnalysis.notice.revenusYear}`} value={fmt.euro(selectedAnalysis.impotTotal)} sub={`${fmt.euro(selectedAnalysis.impotMensuel)} / mois`} />
          <KpiCell label="BNC brut" value={fmt.euro(selectedAnalysis.bncBrut)} sub={`IR attribué ${fmt.euro(selectedAnalysis.irAttribuableBnc)}`} />
          <KpiCell label="BNC net après IR" value={fmt.euro(selectedAnalysis.bncNetApresImpot)} sub={`${selectedAnalysis.tauxEffectifBnc.toFixed(1)} % d'imposition`} />
          <KpiCell label="Taux moyen / marginal" value={`${selectedAnalysis.tauxMoyen.toFixed(1)} %`} sub={`marginal ${selectedAnalysis.tauxMarginal} %`} privateValue={false} />
        </div>
      </section>

      {/* Historique */}
      <section className={dashboardInsightCard}>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/15 dark:text-amber-300">
            <Landmark className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-base font-bold text-ink-950 dark:text-white">Historique de l'impôt</p>
            <p className="text-[11px] font-medium text-ink-500 dark:text-white/45">Impôt du foyer et taux moyen par année</p>
          </div>
        </div>
        <div className="mt-4">
          <TaxHistoryChart data={historyData} />
        </div>
      </section>

      <div className={dashboardInsightGrid}>
        {/* Détail par année */}
        <section className={dashboardInsightCard}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={dashboardEyebrow}>Impôts</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className={dashboardPanelTitle}>Détail par année</h2>
                {selectedAnalysis.notice.declarative ? (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    Déclaratif
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] font-medium text-ink-500 dark:text-white/45">
                Revenus {selectedAnalysis.notice.revenusYear} · attribution au BNC
              </p>
            </div>
            <span
              className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300"
              data-private
            >
              {fmt.euro(selectedAnalysis.impotTotal)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Revenu imposable" value={fmt.euro(selectedAnalysis.revenuImposable)} />
            <MiniStat label="Impôt / mois" value={fmt.euro(selectedAnalysis.impotMensuel)} />
            <MiniStat label="Taux moyen" value={`${selectedAnalysis.tauxMoyen.toFixed(2)} %`} priv={false} />
            <MiniStat label="RFR" value={fmt.euro(selectedAnalysis.revenuFiscalReference)} />
            <MiniStat label="BNC brut" value={fmt.euro(selectedAnalysis.bncBrut)} />
            <MiniStat label="IR sur BNC" value={fmt.euro(selectedAnalysis.irAttribuableBnc)} />
            <MiniStat label="BNC net" value={fmt.euro(selectedAnalysis.bncNetApresImpot)} highlight />
            <MiniStat label="Taux BNC" value={`${selectedAnalysis.tauxEffectifBnc.toFixed(1)} %`} priv={false} />
          </div>
        </section>

        {/* Optimisations */}
        <section className={dashboardInsightCard}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={dashboardEyebrow}>Impôts</p>
              <h2 className={clsx(dashboardPanelTitle, "mt-1")}>Optimisations fiscales</h2>
              <p className="mt-1 text-[11px] font-medium text-ink-500 dark:text-white/45">
                Impôt économisé sur les revenus {selectedAnalysis.notice.revenusYear}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
              data-private
            >
              {fmt.euro(yearOptimizationsTotal)}
            </span>
          </div>

          {yearOptimizations.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {yearOptimizations.map((o) => {
                const meta = OPTIMIZATION_META[o.kind];
                const Icon = meta.icon;
                return (
                  <div
                    key={`${selectedAnalysis.notice.revenusYear}-${o.kind}`}
                    className="flex items-center justify-between gap-3 border-b border-ink-200/45 py-2.5 last:border-0 dark:border-cyan-100/[0.07]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-2xl", meta.tone)}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">{o.label}</p>
                        <p className="text-[11px] font-medium tabular-nums text-ink-500 dark:text-white/45" data-private>
                          Base {fmt.euro(o.montant)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300" data-private>
                      −{fmt.euro(o.economie)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-ink-200/50 px-3 py-3 text-sm font-semibold text-ink-500 dark:border-white/[0.08] dark:text-white/45">
              Aucune optimisation déclarée pour cette année.
            </p>
          )}
        </section>
      </div>

      <p className="px-1 text-center text-[10px] font-medium text-ink-400 dark:text-white/35">
        Reconstitution à partir de vos avis d'impôt. Estimation indicative, ne remplace pas un conseil fiscal.
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  priv = true,
  highlight = false
}: {
  label: string;
  value: string;
  priv?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/40">{label}</p>
      <p
        className={clsx(
          "mt-0.5 text-sm font-bold tabular-nums",
          highlight ? "text-emerald-700 dark:text-emerald-300" : "text-ink-900 dark:text-white"
        )}
        {...(priv ? { "data-private": "" } : {})}
      >
        {value}
      </p>
    </div>
  );
}
