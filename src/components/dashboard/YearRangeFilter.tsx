"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';
type Props={years:readonly string[];from:string;to:string;onChange:(from:string,to:string)=>void};
export function YearRangeFilter({years,from,to,onChange}:Props){
 const [editing,setEditing]=useState<'from'|'to'|null>(null);
 const root=useRef<HTMLDivElement>(null),firstTrigger=useRef<HTMLButtonElement>(null),lastTrigger=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{
  if(!editing)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setEditing(null);};
  document.addEventListener('pointerdown',outside);
  root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  return ()=>document.removeEventListener('pointerdown',outside);
 },[editing]);
 const close=()=>{(editing==='from'?firstTrigger:lastTrigger).current?.focus();setEditing(null);};
 return <div ref={root} role="group" aria-label="Intervalle d’années de l’historique" className="relative mt-2 inline-flex items-center gap-0.5" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>
  {(['from','to'] as const).map((side,index)=><div key={side} className="flex items-center gap-0.5">
   {index>0?<span aria-hidden="true" className="px-1 text-[10px] text-ink-400/60">—</span>:null}
   <button ref={side==='from'?firstTrigger:lastTrigger} type="button" aria-label={side==='from'?'Année de début de l’historique':'Année de fin de l’historique'} aria-haspopup="dialog" aria-expanded={editing===side} aria-controls={editing===side?id:undefined} onClick={()=>setEditing(editing===side?null:side)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium tabular-nums text-ink-600 transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/60 dark:text-white/70 dark:hover:bg-white/5"><span className="text-[10px] font-normal text-ink-400">{side==='from'?'De':'À'}</span>{side==='from'?from:to}<ChevronDown size={10} aria-hidden="true" className={`text-ink-400 transition ${editing===side?'rotate-180':''}`}/></button>
  </div>)}
  {editing?<div id={id} role="dialog" aria-label={editing==='from'?'Choisir l’année de début':'Choisir l’année de fin'} className="absolute left-0 top-full z-40 mt-1 w-60 rounded-2xl border border-ink-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-[#103c44]/95">
   <p className="px-2 py-1.5 text-[10px] text-ink-400">{editing==='from'?'Année de début':'Année de fin'}</p>
   <div className="grid max-h-60 grid-cols-4 gap-1 overflow-y-auto">{years.map(year=>{const selected=year===(editing==='from'?from:to);return <button key={year} type="button" aria-pressed={selected} onClick={()=>{onChange(editing==='from'?year:year<from?year:from,editing==='to'?year:year>to?year:to);close();}} className={`min-h-10 rounded-xl text-xs tabular-nums transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${selected?'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200':'text-ink-600 hover:bg-ink-100 dark:text-white/70 dark:hover:bg-white/10'}`}>{year}</button>;})}</div>
  </div>:null}
 </div>;
}
