"use client";
import {useMemo,useState} from "react";
import {YearRangeFilter} from "./YearRangeFilter";
import {buildPilotePocketHistory,filterPilotePocketHistoryYears} from "@/lib/pilote-pocket-history";
import type {PiloteMonth,PiloteExpenseView} from "@/lib/pilote";
import {useDashboardDisplayFormat} from "./DashboardDisplayFormatContext";
const label=(month:string)=>new Intl.DateTimeFormat("fr-FR",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`));
export function PilotePocketHistory({months,views}:{months:readonly PiloteMonth[];views:readonly PiloteExpenseView[]}){
 const fmt=useDashboardDisplayFormat();
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Paris"}).format(new Date());
 const allPoints=useMemo(()=>buildPilotePocketHistory(months,views,today),[months,views,today]);
 const [selected,setSelected]=useState<number|null>(null);
 const [range,setRange]=useState<{from?:string;to?:string}>({});
 const [recent,setRecent]=useState(true);
 const years=[...new Set(allPoints.filter(point=>point.balance!==null).map(point=>point.month.slice(0,4)))];
 const from=range.from&&years.includes(range.from)?range.from:years[0];
 const to=range.to&&years.includes(range.to)?range.to:years.at(-1)!;
 const points=recent?allPoints.slice(-12):from&&to?filterPilotePocketHistoryYears(allPoints,from,to):[];
 if(!points.length)return <p className="mt-4 text-[10px] text-ink-400">L’historique sera disponible après un import Bankin.</p>;
 const index=Math.min(selected??points.length-1,points.length-1),active=points[index];
 const low=Math.min(0,...points.map(p=>p.balance??0)),high=Math.max(0,...points.map(p=>p.balance??0));
 const span=Math.max(1,high-low),x=(i:number)=>44+i/Math.max(1,points.length-1)*500,y=(v:number)=>150-(v-low)/span*138;
 let move=true;const path=points.map((p,i)=>{if(p.balance===null){move=true;return "";}const part=`${move?"M":"L"}${x(i).toFixed(2)},${y(p.balance).toFixed(2)}`;move=false;return part;}).join(" ");
 return <figure className="mt-4 border-t border-ink-200/40 pt-4 dark:border-white/[.07]" aria-label="Historique mensuel de votre poche depuis le premier mois importé">
  <figcaption className="text-xs font-medium text-ink-600 dark:text-white/70">De votre poche · historique mensuel</figcaption>
  <div className="mt-3 inline-flex rounded-full bg-ink-100/70 p-0.5 dark:bg-white/[.06]" role="group" aria-label="Période du graphique">{[{value:true,label:'12 derniers mois'},{value:false,label:'Historique'}].map(option=><button key={option.label} type="button" aria-pressed={recent===option.value} onClick={()=>{setRecent(option.value);setSelected(null);}} className={`min-h-8 rounded-full px-3 text-[11px] ${recent===option.value?'bg-white font-medium shadow-sm dark:bg-white/15':'text-ink-400'}`}>{option.label}</button>)}</div>
  {!recent?<YearRangeFilter years={years} from={from} to={to} onChange={(from,to)=>{setRange({from,to});setSelected(null);}}/>:null}
  {fmt.dummy?<p className="mt-3 text-xs text-ink-400">Graphique masqué avec les montants.</p>:<>
   <svg viewBox="0 0 560 185" className="mt-3 h-auto w-full" role="img" aria-label="Évolution mensuelle des rentrées moins les dépenses, toutes compensations déduites">
    {[low,(low+high)/2,high].filter((v,i,all)=>all.indexOf(v)===i).map(value=><g key={value}><line x1="44" x2="544" y1={y(value)} y2={y(value)} stroke="currentColor" className="text-ink-200 dark:text-white/10"/><text x="38" y={y(value)+3} textAnchor="end" fontSize="9" fill="currentColor" className="text-ink-400">{fmt.chartAxisEuro(value)}</text></g>)}
    {low<0&&high>0?<line x1="44" x2="544" y1={y(0)} y2={y(0)} stroke="currentColor" strokeDasharray="3 4" className="text-ink-300 dark:text-white/25"/>:null}
    <path d={path} fill="none" stroke="var(--app-accent)" strokeWidth="2.5"/>
    <line x1={x(index)} x2={x(index)} y1="10" y2="150" stroke="currentColor" strokeDasharray="3 4" className="text-ink-300 dark:text-white/25"/>
    {active.balance!==null?<circle cx={x(index)} cy={y(active.balance)} r="3.5" fill={active.balance<0?"#fb7185":"var(--app-accent)"}/>:null}
    {[...new Set([0,Math.floor((points.length-1)/2),points.length-1])].map(i=><text key={i} x={x(i)} y="176" textAnchor={i===0?"start":i===points.length-1?"end":"middle"} fontSize="9" fill="currentColor" className="text-ink-400">{label(points[i].month)}</text>)}
   </svg>
   <input type="range" min={0} max={points.length-1} value={index} onChange={event=>setSelected(Number(event.target.value))} aria-label="Parcourir l’historique mensuel de votre poche" className="mt-1 h-4 w-full accent-[var(--app-accent)]"/>
   <div className="mt-2 flex items-baseline justify-between gap-3"><span className="text-xs capitalize text-ink-500 dark:text-white/55">{label(active.month)}</span><strong className={`text-sm tabular-nums ${active.balance!==null&&active.balance<0?"text-rose-500 dark:text-rose-400":"text-emerald-600 dark:text-emerald-300"}`}>{active.balance===null?"Non importé":fmt.euroExact(active.balance)}</strong></div>
  </>}
 </figure>;
}
