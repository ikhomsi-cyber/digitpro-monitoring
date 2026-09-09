"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { buildCsgHistory, computeGeneratedCaHtToDate, summarizeCsgHistory } from "@/lib/csg-history";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useHiwayInvoices } from "@/components/dashboard/HiwayInvoicesContext";

export function CsgHistoryCard({ transactions }: { transactions: DashboardTx[] }) {
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
  const periodLabel = allSelected ? "Toute la période" : selectedRows.map((row) => row.year).join(" · ");
  const toggleYear = (year: number) => setSelectedYears((previous) => {
    if (previous == null) return [year];
    const next = previous.includes(year) ? previous.filter((value) => value !== year) : [...previous, year];
    return next.length === 0 || next.length === annual.length ? null : next;
  });

  return (
    <section className={dashboardInsightCard} aria-label="Historique CSG par année">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-ink-500 dark:text-white/50">Historique CSG · 9,7 % vs 17,2 %</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white" data-private>
              {fmt.euro(totals.amountToCoverEur)}
            </p>
            <span className="text-xs font-medium tabular-nums text-ink-500 dark:text-white/45">à couvrir · {periodLabel}</span>
          </div>
        </div>
        <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-2xl border border-ink-200/70 bg-ink-50/80 p-0.5 dark:border-white/[0.1] dark:bg-white/[0.05]" role="group" aria-label="Années CSG">
          <button type="button" aria-pressed={allSelected} onClick={() => setSelectedYears(null)}
            className={clsx("rounded-full px-2.5 py-1 text-[10px] font-semibold transition", allSelected ? "bg-white text-ink-900 shadow-sm dark:bg-white/[0.18] dark:text-white" : "text-ink-500 hover:text-ink-800 dark:text-white/45 dark:hover:text-white/75")}
          >Toute la période</button>
          {annual.map(({ year }) => (
            <button key={year} type="button" aria-pressed={selectedYears == null || selectedYears.includes(year)} onClick={() => toggleYear(year)}
              className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums transition",
                selectedYears == null || selectedYears.includes(year) ? "bg-white text-ink-900 shadow-sm dark:bg-white/[0.18] dark:text-white" : "text-ink-500 hover:text-ink-800 dark:text-white/45 dark:hover:text-white/75")}
            >{year}</button>
          ))}
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {[
          { label: "CSG 9,7 %", value: totals.csg97Eur, dot: "bg-emerald-500 dark:bg-emerald-400" },
          { label: "CSG 17,2 %", value: totals.csg172Eur, dot: "bg-sky-500 dark:bg-sky-400" }
        ].map((item) => (
          <li key={item.label} className="flex min-w-0 flex-wrap items-center gap-1.5 text-ink-600 dark:text-white/60">
            <span className={clsx("h-2 w-2 shrink-0 rounded-full", item.dot)} aria-hidden />
            <span>{item.label}</span>
            <span className="font-medium tabular-nums text-ink-800 dark:text-white/85" data-private>{fmt.euro(item.value)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-ink-500 dark:text-white/45">CA rattaché au mois de prestation, comme dans « Jours facturés ». Pour {now.getFullYear()}, le réalisé à date inclut les mois travaillés et les factures déjà émises.</p>
      <p className="mt-2 text-[10px] text-ink-500 dark:text-white/45">Sélectionnez une ou plusieurs années pour ajuster le total.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums" aria-label="Comparaison annuelle CSG">
          <thead className="text-[10px] text-ink-500 dark:text-white/45">
            <tr><th scope="col" className="pb-2 pr-2 font-medium">Année</th><th scope="col" className="px-1 pb-2 text-right font-medium">9,7 %</th><th scope="col" className="px-1 pb-2 text-right font-medium">17,2 %</th><th scope="col" className="pb-2 pl-2 text-right font-medium">Écart</th></tr>
          </thead>
          <tbody>
            {selectedRows.map((row) => (
              <tr key={row.year} className="border-t border-ink-200/50 dark:border-white/[0.06]">
                <th scope="row" className="py-3 pr-2 font-medium text-ink-800 dark:text-white/85">
                  {row.year}
                  <span className="mt-1 block text-[9px] font-normal text-ink-500 dark:text-white/45" data-private>{fmt.euro(row.generatedCaHtEur)} HT</span>
                  {row.prescribed ? <span className="mt-1 block w-fit rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-700 dark:text-emerald-300">Prescrite</span> : null}
                </th>
                <td className="whitespace-nowrap px-1 py-3 text-right text-ink-800 dark:text-white/85" data-private>{fmt.euro(row.csg97Eur)}</td>
                <td className="whitespace-nowrap px-1 py-3 text-right text-ink-800 dark:text-white/85" data-private>{fmt.euro(row.csg172Eur)}</td>
                <td className={clsx("whitespace-nowrap py-3 pl-2 text-right font-semibold", row.differenceEur < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-ink-800 dark:text-white/85")} data-private>{fmt.euro(row.differenceEur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedRows.some((row) => row.prescribed) ? (
        <div className="mb-3 mt-1 space-y-1.5 text-xs text-ink-600 dark:text-white/60">
          <div className="flex justify-between gap-3"><span>Écart hors 2022</span><span className="tabular-nums" data-private>{fmt.euro(totals.differenceBeforeCompensationEur)}</span></div>
          <div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-300"><span>Compensation 2022 prescrite</span><span className="tabular-nums" data-private>−{fmt.euro(totals.compensationEur)}</span></div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200/70 pt-3 dark:border-white/[0.1]">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-600 dark:text-white/60">
          <span className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden />
          Écart total à couvrir · sélection
        </span>
        <span className="font-display text-lg font-semibold tabular-nums text-ink-900 dark:text-white" data-private>{fmt.euro(totals.amountToCoverEur)}</span>
      </div>
      {totals.surplusEur > 0 ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" data-private>Excédent de couverture : {fmt.euro(totals.surplusEur)}</p> : null}
      <p className="mt-2 text-[10px] text-ink-500 dark:text-white/45">Hypothèse de suivi : 2022 prescrite, montant à 17,2 % nul et provision à 9,7 % utilisée en compensation lorsque 2022 est sélectionnée.</p>
      <p className="mt-2 text-[10px] text-ink-500 dark:text-white/45">Montants calculés avant la correction globale de 1 200 €, commune aux deux taux.</p>
    </section>
  );
}
