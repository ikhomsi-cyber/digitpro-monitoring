"use client";
import { PiloteComparisonEvolution } from "./PiloteComparisonEvolution";
import type { PiloteDaily } from "@/lib/bankin/pilote-daily";
import type { PiloteExpenseView } from "@/lib/pilote";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { PiloteMonthlyComparison as Comparison } from "@/lib/bankin/pilote-comparison";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";

const dateLabel = (date: string) => date.split("-").reverse().join("/");
export function PiloteMonthlyComparison({ comparison, daily, views=[] }: { comparison: Comparison; daily?:PiloteDaily|null; views?:readonly PiloteExpenseView[] }) {
  const fmt = useDashboardDisplayFormat();
  if (comparison.status === "unavailable") {
    const messages = { future: "La comparaison sera disponible une fois cette période écoulée.", "missing-month": "Le mois sélectionné ou le mois calendaire précédent n’a pas de données importées pour cette fenêtre.", "missing-daily": "Le détail quotidien à jour est nécessaire pour comparer le mois courant. Actualisez le bilan ou importez un nouvel export." };
    return <section aria-label="Comparaison mensuelle des dépenses" className="rounded-2xl border border-ink-200/50 p-4 dark:border-white/10"><h3 className="text-sm font-semibold text-ink-800 dark:text-white/85">Par rapport au mois précédent</h3><p className="mt-2 text-xs leading-relaxed text-ink-500 dark:text-white/50">{messages[comparison.reason]}</p></section>;
  }
  const { current, previous, delta, percent, categories, otherDelta } = comparison;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const tone = delta > 0 ? "text-amber-700 dark:text-amber-300" : delta < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-ink-600 dark:text-white/75";
  return <section aria-label="Comparaison mensuelle des dépenses" className="min-w-0 rounded-2xl border border-ink-200/50 bg-white/40 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[.025]">
    <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold text-ink-800 dark:text-white/85">Par rapport au mois précédent</h3><span className="rounded-full bg-ink-100/70 px-2 py-1 text-[10px] text-ink-500 dark:bg-white/5 dark:text-white/55">{comparison.atDate ? "À date comparable" : "Mois complets"}</span></div>
    <div className={`mt-3 flex items-center gap-2 ${tone}`}><Icon size={20} aria-hidden="true"/><p className="text-xl font-semibold tabular-nums tracking-tight">{fmt.euro(Math.abs(delta))} {delta > 0 ? "de plus" : delta < 0 ? "de moins" : "d’écart"}</p>{percent !== null ? <span className="text-xs font-medium">({fmt.dummy ? "••" : `${percent > 0 ? "+" : ""}${percent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`} %)</span> : null}</div>
    <p className="mt-2 text-[11px] leading-relaxed text-ink-500 dark:text-white/50">Dépenses du {dateLabel(current.start)} au {dateLabel(current.end)} : {fmt.euro(current.expenses)}.<br/>Du {dateLabel(previous.start)} au {dateLabel(previous.end)} : {fmt.euro(previous.expenses)}.</p>
    <PiloteComparisonEvolution key={`${current.month}-${views.join(",")}`} comparison={comparison} daily={daily} views={views}/>
    {percent === null ? <p className="mt-2 text-[11px] text-ink-500 dark:text-white/50">Aucun pourcentage calculé : la référence précédente est de zéro.</p> : null}
    {categories.length ? <div className="mt-4 border-t border-ink-200/40 pt-3 dark:border-white/[.07]"><p className="text-[10px] font-medium uppercase tracking-wider text-ink-400 dark:text-white/40">Principaux écarts par catégorie</p><ul className="mt-2 space-y-2">{categories.map(category => <li key={category.name} className="flex justify-between gap-4 text-xs"><span className="min-w-0 text-ink-600 dark:text-white/65">{category.name}</span><span className={`shrink-0 tabular-nums ${category.delta > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{fmt.signedEuro(category.delta)}</span></li>)}</ul>{otherDelta !== 0 ? <p className="mt-2 flex justify-between gap-4 text-[10px] text-ink-400 dark:text-white/40"><span>Autres catégories</span><span className="tabular-nums">{fmt.signedEuro(otherDelta)}</span></p> : null}</div> : null}
    <p className="mt-3 text-[10px] leading-relaxed text-ink-400 dark:text-white/40">Même sélection de dépenses et mêmes règles Pilote. Comparaison des opérations importées, sans garantie d’exhaustivité. Le solde principal reste celui de toute la période sélectionnée.</p>
  </section>;
}
