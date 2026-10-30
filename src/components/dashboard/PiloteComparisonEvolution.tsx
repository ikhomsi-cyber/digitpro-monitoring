"use client";
import {useMemo,useState} from "react";
import {buildPiloteComparisonEvolution,type PiloteMonthlyComparison} from "@/lib/bankin/pilote-comparison";
import type {PiloteDaily} from "@/lib/bankin/pilote-daily";
import type {PiloteExpenseView} from "@/lib/pilote";
import {useDashboardDisplayFormat} from "./DashboardDisplayFormatContext";
const monthLabel=(month:string)=>new Intl.DateTimeFormat("fr-FR",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`));
export function PiloteComparisonEvolution({comparison,daily,views}:{comparison:PiloteMonthlyComparison;daily?:PiloteDaily|null;views:readonly PiloteExpenseView[]}){
 const fmt=useDashboardDisplayFormat();const points=useMemo(()=>buildPiloteComparisonEvolution(comparison,daily,views),[comparison,daily,views]);const [selected,setSelected]=useState<number|null>(null);
 if(comparison.status!=="ready")return null;
 if(!points?.length)return <p className="mt-4 text-[10px] text-ink-400">Le détail quotidien des deux mois est nécessaire pour tracer leur évolution.</p>;
 const index=Math.min(selected??points.length-1,points.length-1),active=points[index];
 const maximum=Math.max(1,...points.flatMap(p=>[p.current??0,p.previous??0]));
 const x=(day:number)=>44+(day-1)/Math.max(1,points.length-1)*500;
 const y=(value:number)=>150-value/maximum*138;
 const line=(field:"current"|"previous")=>points.filter(p=>p[field]!==null).map((p,i)=>`${i?"L":"M"}${x(p.day).toFixed(2)},${y(p[field]!).toFixed(2)}`).join(" ");
 const currentLabel=monthLabel(comparison.current.month),previousLabel=monthLabel(comparison.previous.month);
 return <figure className="mt-4 border-t border-ink-200/40 pt-4 dark:border-white/[.07]" aria-label="Évolution comparée des dépenses cumulées des deux mois">
  <figcaption className="text-xs font-medium text-ink-600 dark:text-white/70">Dépenses cumulées · jour après jour</figcaption>
  {fmt.dummy?<p className="mt-3 text-xs text-ink-400">Graphique masqué avec les montants.</p>:<>
   <svg viewBox="0 0 560 180" className="mt-3 h-auto w-full" role="img" aria-label={`Dépenses cumulées : ${currentLabel} et ${previousLabel}`}>
    <title>Deux mois comparés sur la même échelle, jusqu’aux dates indiquées.</title>
    {[0,.5,1].map(part=><g key={part}><line x1="44" x2="544" y1={y(maximum*part)} y2={y(maximum*part)} stroke="currentColor" className="text-ink-200 dark:text-white/10"/><text x="38" y={y(maximum*part)+3} textAnchor="end" fontSize="9" fill="currentColor" className="text-ink-400">{fmt.chartAxisEuro(maximum*part)}</text></g>)}
    <path d={line("previous")} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 4"/>
    <path d={line("current")} fill="none" stroke="var(--app-accent)" strokeWidth="2.5"/>
    <line x1={x(active.day)} x2={x(active.day)} y1="10" y2="150" stroke="currentColor" className="text-ink-300 dark:text-white/25" strokeDasharray="3 4"/>
    {(["current","previous"] as const).map(field=>active[field]!==null?<circle key={field} cx={x(active.day)} cy={y(active[field]!)} r="3.5" fill={field==="current"?"var(--app-accent)":"#38bdf8"}/>:null)}
    {[...new Set([1,Math.ceil(points.length/2),points.length])].map(day=><text key={day} x={x(day)} y="172" textAnchor="middle" fontSize="9" fill="currentColor" className="text-ink-400">J{day}</text>)}
   </svg>
   <input type="range" min={1} max={points.length} value={active.day} onChange={event=>setSelected(Number(event.target.value)-1)} aria-label="Comparer les dépenses cumulées par jour sur les deux mois" className="mt-1 h-4 w-full accent-[var(--app-accent)]"/>
   <p className="mt-1 text-[10px] text-ink-400">Jour {active.day} · même échelle pour les deux mois</p>
   <dl className="mt-2 grid grid-cols-2 gap-3 text-xs"><div><dt className="flex items-center gap-1.5 capitalize text-ink-500 dark:text-white/55"><span className="h-0.5 w-4 bg-[var(--app-accent)]"/>{currentLabel}</dt><dd className="mt-1 font-semibold tabular-nums">{active.current===null?"Fin du mois":fmt.euroExact(active.current)}</dd></div><div><dt className="flex items-center gap-1.5 capitalize text-ink-500 dark:text-white/55"><span className="h-0 w-4 border-t-2 border-dashed border-sky-400"/>{previousLabel}</dt><dd className="mt-1 font-semibold tabular-nums">{active.previous===null?"Fin du mois":fmt.euroExact(active.previous)}</dd></div></dl>
  </>}
 </figure>;
}
