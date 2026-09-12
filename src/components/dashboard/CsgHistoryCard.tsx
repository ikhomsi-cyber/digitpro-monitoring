"use client";

import { computeCsgRemainingEur } from "@/lib/csg-remaining";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { buildCsgHistory, computeGeneratedCaHtToDate, summarizeCsgHistory } from "@/lib/csg-history";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useHiwayInvoices } from "@/components/dashboard/HiwayInvoicesContext";

export function CsgHistoryCard({ transactions, stats }: { transactions: DashboardTx[]; stats: DashboardHeroStats }) {
  const remainingEur = computeCsgRemainingEur(stats);
  const fmt = useDashboardDisplayFormat();
  const now = useMemo(() => new Date(), []);
  const { selected: selectedWorkDays, billableRatePeriods, tjmHt } = useBillableActivity();
  const { invoices } = useHiwayInvoices();
  const currentYearGeneratedCaHtEur = useMemo(
    () => computeGeneratedCaHtToDate(transactions, selectedWorkDays, billableRatePeriods, tjmHt, invoices, now),
    [billableRatePeriods, invoices, now, selectedWorkDays, tjmHt, transactions]
  );
  const annual = useMemo(
    () => buildCsgHistory(transactions, now, currentYearGeneratedCaHtEur),
    [currentYearGeneratedCaHtEur, transactions, now]
  );
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null);
  const selectedRows = annual.filter((row) => selectedYears == null || selectedYears.includes(row.year));
  const totals = summarizeCsgHistory(selectedRows);
  const allSelected = selectedRows.length === annual.length;
  const toggleYear = (year: number) => setSelectedYears((previous) => {
    if (previous == null) return [year];
    const next = previous.includes(year) ? previous.filter((value) => value !== year) : [...previous, year];
    return next.length === 0 || next.length === annual.length ? null : next;
  });

  return (
    <section className={dashboardInsightCard} aria-label="Historique CSG par année">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-500 dark:text-white/50">CSG · Reste à couvrir</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="font-display text-3xl font-semibold tabular-nums text-ink-900 dark:text-white" data-private>
              {remainingEur == null ? "—" : fmt.euro(remainingEur)}
            </p>
            <span className="text-xs font-medium tabular-nums text-ink-500 dark:text-white/45">scénario à 17,2 %</span>
          </div>
        </div>
        <p className="-mt-2 text-[10px] text-ink-500 dark:text-white/45">Solde global · TVA et cash disponible inclus</p>
        <div className="inline-flex w-fit max-w-full flex-wrap gap-0.5 rounded-2xl border border-ink-200/70 bg-ink-50/80 p-0.5 dark:border-white/[0.1] dark:bg-white/[0.05]" role="group" aria-label="Années CSG">
          <button type="button" aria-pressed={allSelected} onClick={() => setSelectedYears(null)}
            className={clsx("rounded-full px-2.5 py-1 text-[10px] font-semibold transition", allSelected ? "bg-white text-ink-900 shadow-sm dark:bg-white/[0.18] dark:text-white" : "text-ink-500 hover:text-ink-800 dark:text-white/45 dark:hover:text-white/75")}
          >Tout</button>
          {annual.map(({ year }) => (
            <button key={year} type="button" aria-pressed={selectedYears == null || selectedYears.includes(year)} onClick={() => toggleYear(year)}
              className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums transition",
                selectedYears?.includes(year) ? "bg-white text-ink-900 shadow-sm dark:bg-white/[0.18] dark:text-white" : "text-ink-500 hover:text-ink-800 dark:text-white/45 dark:hover:text-white/75")}
            >{year}</button>
          ))}
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {[
          { label: "CSG 9,7 %", value: totals.csg97Eur, dot: "bg-emerald-500 dark:bg-emerald-400" },
          { label: "CSG 17,2 %", value: totals.csg172Eur, dot: "bg-sky-500 dark:bg-sky-400" }
        ].map((item) => (
          <li key={item.label} className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl bg-ink-50 px-3 py-2.5 text-ink-600 dark:bg-white/[0.035] dark:text-white/60">
            <span className={clsx("h-2 w-2 shrink-0 rounded-full", item.dot)} aria-hidden />
            <span>{item.label}</span>
            <span className="font-medium tabular-nums text-ink-800 dark:text-white/85" data-private>{fmt.euro(item.value)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums" aria-label="Comparaison annuelle CSG">
          <thead className="text-[10px] text-ink-500 dark:text-white/45">
            <tr><th scope="col" className="pb-2 pr-2 font-medium">Année</th><th scope="col" className="px-1 pb-2 text-right font-medium">9,7 %</th><th scope="col" className="px-1 pb-2 text-right font-medium">17,2 %</th><th scope="col" className="pb-2 pl-2 text-right font-medium">Écart</th></tr>
          </thead>
          <tbody>
            {selectedRows.map((row) => (
              <tr key={row.year} className="border-t border-ink-200/50 dark:border-white/[0.06]">
                <th scope="row" className="py-2.5 pr-2 font-medium text-ink-800 dark:text-white/85">
                  {row.year}
                  <span className="mt-1 block text-[9px] font-normal text-ink-500 dark:text-white/45" data-private>{fmt.euro(row.generatedCaHtEur)} HT</span>
                  {row.prescribed ? <span className="mt-1 block w-fit rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-700 dark:text-emerald-300">Prescrite</span> : null}
                </th>
                <td className="whitespace-nowrap px-1 py-2.5 text-right text-ink-800 dark:text-white/55" data-private>{fmt.euro(row.csg97Eur)}</td>
                <td className="whitespace-nowrap px-1 py-2.5 text-right text-ink-800 dark:text-white/85" data-private>{fmt.euro(row.csg172Eur)}</td>
                <td className={clsx("whitespace-nowrap py-2.5 pl-2 text-right font-semibold", row.differenceEur < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-ink-800 dark:text-white/85")} data-private>{fmt.euro(row.differenceEur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="group mt-3 border-t border-ink-200/50 pt-3 text-[10px] leading-relaxed text-ink-500 dark:border-white/[0.08] dark:text-white/45">
        <summary className="w-fit cursor-pointer rounded-md text-xs font-medium text-ink-600 transition-colors hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:text-white/60 dark:hover:text-white">Détail du calcul</summary>
        <div className="mt-3 space-y-3">
          <dl className="space-y-1.5 tabular-nums" data-private>
            <div className="flex justify-between gap-3"><dt>CSG à 17,2 % depuis 2023</dt><dd>{fmt.euro(stats.csgComparaison172Eur)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Dette TVA</dt><dd>+ {fmt.euro(stats.detteTvaDepuisDebutEur)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Cash disponible</dt><dd>{stats.soldeQontoEur == null ? "—" : `− ${fmt.euro(stats.soldeQontoEur)}`}</dd></div>
          </dl>
          <p>Le reste à couvrir est limité à zéro et reste global. Les filtres annuels concernent uniquement la comparaison des provisions.</p>
          <p>Le tableau rattache le CA au mois de prestation. Pour {now.getFullYear()}, il inclut le réalisé à date et les factures émises. Ses montants précèdent la correction globale de 1 200 €, déjà déduite de la CSG du solde global.</p>
          <p>Hypothèse de suivi : 2022 prescrite, CSG à 17,2 % nulle et provision à 9,7 % en compensation.</p>
          {totals.compensationEur > 0 ? <p data-private>Compensation sur la sélection : {fmt.euro(totals.compensationEur)}.</p> : null}
        </div>
      </details>
    </section>
  );
}
