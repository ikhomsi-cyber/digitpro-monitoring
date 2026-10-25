"use client";
import { useId, useState, type ReactNode } from "react";
import { cumulativePiloteDays, type PiloteDay } from "@/lib/bankin/pilote-daily";
import type { PiloteExpenseView } from "@/lib/pilote";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";
export function PiloteDailyChart({ days, month, views, summary }: { days?: PiloteDay[]; month: string; views: PiloteExpenseView[]; summary?: ReactNode }) {
  const gradientId = useId().replace(/:/g, "");
  const fmt = useDashboardDisplayFormat();
  const [hovered, setHovered] = useState<number | null>(null);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const through = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : month > today.slice(0, 7) ? 0 : days?.length ?? 0;
  const values = cumulativePiloteDays(days ?? [], views, through);
  const first = values.find(value => value.balance < 0);
  const last = values.at(-1);
  const active = values[Math.min(hovered ?? values.length - 1, values.length - 1)];
  const max = Math.max(1, ...values.flatMap(row => [row.income, row.expenses]));
  const x = (day: number) => 48 + (day - 1) / Math.max(1, (days?.length ?? 31) - 1) * 488;
  const y = (amount: number) => 182 - amount / max * 142;
  const path = (field: "income" | "expenses") => values.map((row, i) => `${i ? "L" : "M"}${x(row.day)},${y(row[field])}`).join(" ");
  return <div className="relative min-w-0 overflow-hidden rounded-3xl border border-ink-200/60 bg-gradient-to-br from-white via-white to-emerald-50/60 p-5 shadow-[0_12px_40px_-24px_rgba(16,185,129,0.2)] sm:p-6 dark:border-white/[.09] dark:from-white/[.045] dark:via-white/[.015] dark:to-emerald-950/20">
    <h3 className="text-base font-semibold tracking-tight text-ink-900 dark:text-white">Couverture au fil du mois</h3>
    <p className="mt-1 text-[11px] text-ink-500 dark:text-white/50">Entrées et sorties cumulées · {month.split("-").reverse().join("/")} · vues sélectionnées</p>
    <p className="mt-1 text-[10px] text-ink-400 dark:text-white/40">Solde global à la date affichée : les excédents des familles se compensent ici. Les montants en haut et en bas utilisent également toutes les compensations, sur tout le mois importé.</p>
    {summary ? <div className="mt-4 border-b border-ink-200/50 pb-4 dark:border-white/10">{summary}</div> : null}
    {fmt.dummy ? <p className="py-8 text-xs text-ink-500">Courbes masquées avec les montants.</p> : !last ? <p className="py-8 text-xs text-ink-500">{days ? "Aucune journée écoulée sur ce mois." : "Le détail quotidien sera disponible après un import Bankin."}</p> : <>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex gap-4 text-[11px] font-medium"><span className="flex items-center gap-1.5 text-ink-500 dark:text-white/65"><i className="h-1.5 w-4 rounded-full bg-emerald-400" />Entrées</span><span className="flex items-center gap-1.5 text-ink-500 dark:text-white/65"><i className="h-1.5 w-4 rounded-full bg-rose-400" />Sorties</span></div>
        <span className="rounded-full border border-ink-200/60 px-2.5 py-1 text-[10px] text-ink-400 dark:border-white/10 dark:text-white/45">Cumul journalier</span>
      </div>
      <svg viewBox="0 0 560 220" className="mt-3 w-full touch-pan-y rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60" role="slider" tabIndex={0} aria-label="Comparer les entrées et sorties par jour" aria-valuemin={1} aria-valuemax={values.length} aria-valuenow={active?.day ?? 1} aria-valuetext={active ? `Jour ${active.day}, entrées ${fmt.euro(active.income)}, sorties ${fmt.euro(active.expenses)}, solde ${fmt.euro(active.balance)}` : undefined}
        onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); const coordinate = (event.clientX - box.left) / box.width * 560; setHovered(Math.max(0, Math.min(values.length - 1, Math.round((coordinate - 48) / 488 * ((days?.length ?? 31) - 1))))); }}
        onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); setHovered(event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : Math.max(0, Math.min(values.length - 1, (hovered ?? values.length - 1) + (event.key === "ArrowRight" ? 1 : -1)))); } }}>
        <title>Entrées et sorties cumulées au fil du mois</title>
        <defs>{(["income", "expenses"] as const).map(field => <linearGradient key={field} id={`${gradientId}-${field}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={field === "income" ? "#34d399" : "#fb7185"} stopOpacity="0.17" /><stop offset="100%" stopColor={field === "income" ? "#34d399" : "#fb7185"} stopOpacity="0" /></linearGradient>)}</defs>
        {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1="48" x2="536" y1={y(max * ratio)} y2={y(max * ratio)} stroke="currentColor" strokeOpacity="0.08" strokeDasharray={ratio ? "3 5" : undefined} /><text x="38" y={y(max * ratio) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.4">{max * ratio >= 1000 ? `${(max * ratio / 1000).toFixed(1)}k` : Math.round(max * ratio)}</text></g>)}
        {(["income", "expenses"] as const).map(field => <g key={field}><path d={`${path(field)} L${x(last.day)},182 L48,182 Z`} fill={`url(#${gradientId}-${field})`} /><path d={path(field)} fill="none" stroke={field === "income" ? "#34d399" : "#fb7185"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>)}
        {first ? <g><line x1={x(first.day)} x2={x(first.day)} y1="36" y2="182" stroke="#fb7185" strokeDasharray="3 5" opacity="0.45" /><circle cx={x(first.day)} cy={y(first.expenses)} r="3" fill="#fb7185" /></g> : null}
        {active ? <g><line x1={x(active.day)} x2={x(active.day)} y1="30" y2="182" stroke="currentColor" strokeOpacity="0.22" />{(["income", "expenses"] as const).map(field => <g key={field}><circle cx={x(active.day)} cy={y(active[field])} r="8" fill={field === "income" ? "#34d399" : "#fb7185"} fillOpacity="0.14" /><circle cx={x(active.day)} cy={y(active[field])} r="3.5" fill={field === "income" ? "#34d399" : "#fb7185"} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" /></g>)}<rect x={Math.max(48, Math.min(478, x(active.day) - 29))} y="4" width="58" height="22" rx="11" className="fill-ink-100 dark:fill-white/10" /><text x={Math.max(77, Math.min(507, x(active.day)))} y="18" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.75">Jour {active.day}</text></g> : null}
        {[1, 8, 15, 22, days?.length ?? 31].map(day => <text key={day} x={x(day)} y="207" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.4">{day.toString().padStart(2, "0")}</text>)}
      </svg>
      {active ? <div className="rounded-2xl border border-ink-200/50 bg-ink-50/60 p-3.5 dark:border-white/[.06] dark:bg-black/10"><div className="mb-3 flex items-center justify-between text-[10px] text-ink-400 dark:text-white/40"><span>Au {active.day} · {new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`))}</span><span>Glissez sur la courbe</span></div><div className="grid grid-cols-3 gap-2 tabular-nums">{[{ label: "Entrées", amount: active.income, color: "text-emerald-500 dark:text-emerald-300" }, { label: "Sorties", amount: active.expenses, color: "text-rose-400" }, { label: "Solde global", amount: active.balance, color: active.balance < 0 ? "text-rose-400" : "text-ink-900 dark:text-white" }].map(item => <div key={item.label}><p className="text-[10px] text-ink-500 dark:text-white/45">{item.label}</p><p className={`mt-1 text-sm font-semibold tracking-tight sm:text-lg ${item.color}`}>{fmt.euro(item.amount)}</p></div>)}</div></div> : null}
      <div className={`mt-3 flex items-start gap-3 rounded-2xl px-3.5 py-3 ${first ? "bg-rose-500/[.06]" : "bg-emerald-500/[.06]"}`}><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${first ? "bg-rose-400" : "bg-emerald-400"}`} /><div><p className={`text-xs font-semibold ${first ? "text-rose-400" : "text-emerald-500"}`}>{first ? `Premier déficit le ${first.day} · ${fmt.euro(-first.balance)}` : "Entrées suffisantes chaque jour"}</p><p className="mt-1 text-[11px] leading-relaxed text-ink-500 dark:text-white/50">{first ? last.balance >= 0 ? "Les entrées couvrent à nouveau les sorties en fin de période." : `Au ${last.day}, solde global : ${fmt.euro(last.balance)}.` : "Aucun dépassement sur les journées renseignées."}</p></div></div>
      <details className="mt-3 text-[10px] leading-relaxed text-ink-400 dark:text-white/35"><summary className="cursor-pointer select-none py-1">Comprendre le calcul</summary><p className="pt-1">Opérations importées, sans projection ni solde initial. Le loyer Maroc est compté le 1er ; les loyers reportés sont placés au 1er du mois suivant.</p></details>
    </>}
  </div>;
}
