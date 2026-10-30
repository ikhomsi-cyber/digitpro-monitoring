"use client";
import { useState, type ReactNode } from "react";
import { cumulativePiloteDays, type PiloteDay } from "@/lib/bankin/pilote-daily";
import type { PiloteExpenseView } from "@/lib/pilote";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";
export function PiloteDailyChart({ days, month, views, summary }: { days?: PiloteDay[]; month: string; views: PiloteExpenseView[]; summary?: ReactNode }) {
  const fmt = useDashboardDisplayFormat();
  const [selected, setSelected] = useState<number | null>(null);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const through = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : month > today.slice(0, 7) ? 0 : days?.length ?? 0;
  const values = cumulativePiloteDays(days ?? [], views, through);
  const first = values.find(value => value.balance < 0), last = values.at(-1);
  const active = values[Math.min(selected ?? values.length - 1, values.length - 1)];
  const maximum = Math.max(1, ...values.flatMap(row => [row.income, row.expenses]));
  const x = (day: number) => 44 + (day - 1) / Math.max(1, values.length - 1) * 500;
  const y = (amount: number) => 150 - amount / maximum * 138;
  const path = (field: "income" | "expenses") => values.map((row, i) => `${i ? "L" : "M"}${x(row.day).toFixed(2)},${y(row[field]).toFixed(2)}`).join(" ");
  return <section aria-label="Couverture au fil du mois" className="min-w-0 rounded-2xl border border-ink-200/50 bg-white/40 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[.025]">
    <h3 className="text-sm font-semibold text-ink-800 dark:text-white/85">Couverture au fil du mois</h3>
    <p className="mt-1 text-[10px] text-ink-400 dark:text-white/45">Entrées et sorties cumulées · {month.split("-").reverse().join("/")}</p>
    {summary ? <div className="mt-4 border-b border-ink-200/40 pb-4 dark:border-white/[.07]">{summary}</div> : null}
    {fmt.dummy ? <p className="py-8 text-xs text-ink-500">Courbes masquées avec les montants.</p> : !last ? <p className="py-8 text-xs text-ink-500">{days ? "Aucune journée écoulée sur ce mois." : "Le détail quotidien sera disponible après un import Bankin."}</p> : <>
      <svg viewBox="0 0 560 180" className="mt-4 h-auto w-full touch-pan-y" role="img" aria-label="Entrées et sorties cumulées au fil du mois"
        onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); const coordinate = (event.clientX - box.left) / box.width * 560; setSelected(Math.max(0, Math.min(values.length - 1, Math.round((coordinate - 44) / 500 * (values.length - 1))))); }}>
        <title>Entrées et sorties cumulées sur une même échelle</title>
        {[0, .5, 1].map(ratio => <g key={ratio}><line x1="44" x2="544" y1={y(maximum * ratio)} y2={y(maximum * ratio)} stroke="currentColor" className="text-ink-200 dark:text-white/10"/><text x="38" y={y(maximum * ratio) + 3} textAnchor="end" fontSize="9" fill="currentColor" className="text-ink-400">{fmt.chartAxisEuro(maximum * ratio)}</text></g>)}
        <path d={path("income")} fill="none" stroke="var(--app-accent)" strokeWidth="2.5"/>
        <path d={path("expenses")} fill="none" stroke="#fb7185" strokeWidth="2" strokeDasharray="5 4"/>
        {active ? <g><line x1={x(active.day)} x2={x(active.day)} y1="10" y2="150" stroke="currentColor" className="text-ink-300 dark:text-white/25" strokeDasharray="3 4"/>{(["income", "expenses"] as const).map(field => <circle key={field} cx={x(active.day)} cy={y(active[field])} r="3.5" fill={field === "income" ? "var(--app-accent)" : "#fb7185"}/>)}</g> : null}
        {[...new Set([1, Math.ceil(values.length / 2), values.length])].map(day => <text key={day} x={x(day)} y="172" textAnchor="middle" fontSize="9" fill="currentColor" className="text-ink-400">J{day}</text>)}
      </svg>
      {active ? <>
        <input type="range" min={1} max={values.length} value={active.day} onChange={event=>setSelected(Number(event.target.value)-1)} aria-label="Comparer les entrées et sorties par jour" aria-valuetext={`Jour ${active.day}, entrées ${fmt.euro(active.income)}, sorties ${fmt.euro(active.expenses)}, solde ${fmt.euro(active.balance)}`} className="mt-1 h-4 w-full accent-[var(--app-accent)]"/>
        <p className="mt-1 text-[10px] text-ink-400">Jour {active.day} · cumul journalier</p>
        <dl className="mt-2 grid grid-cols-3 gap-3 text-xs">{[{label:"Entrées",amount:active.income,tone:"text-emerald-600 dark:text-emerald-300"},{label:"Sorties",amount:active.expenses,tone:"text-rose-500 dark:text-rose-400"},{label:"Solde global",amount:active.balance,tone:active.balance<0?"text-rose-500 dark:text-rose-400":"text-ink-800 dark:text-white/85"}].map(item=><div key={item.label} className="min-w-0"><dt className="flex items-center gap-1.5 text-ink-500 dark:text-white/55">{item.label==="Entrées"?<span className="h-0.5 w-4 shrink-0 bg-[var(--app-accent)]"/>:item.label==="Sorties"?<span className="h-0 w-4 shrink-0 border-t-2 border-dashed border-rose-400"/>:null}{item.label}</dt><dd className={`mt-1 break-words font-semibold tabular-nums ${item.tone}`}>{fmt.euroExact(item.amount)}</dd></div>)}</dl>
      </> : null}
      <p className={`mt-4 border-t border-ink-200/40 pt-3 text-[11px] dark:border-white/[.07] ${first?"text-rose-500 dark:text-rose-400":"text-emerald-600 dark:text-emerald-300"}`}>{first ? `Premier déficit le ${first.day} · ${fmt.euro(-first.balance)}` : "Entrées suffisantes chaque jour"}</p>
    </>}
  </section>;
}
