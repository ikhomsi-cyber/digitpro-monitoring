"use client";
import {useEffect,useState} from 'react';
import {House,RefreshCw,ChevronDown} from 'lucide-react';
import {useOptionalDashboardSection} from './DashboardSectionContext';
import {useDashboardDisplayFormat} from './DashboardDisplayFormatContext';
import {bankinBalanceHistory} from '@/lib/gmail/bankin-balance-history';
import type {BankinBalancePoint} from '@/lib/gmail/bankin-balance-parser';
import {residenceGoal} from '@/lib/residence-goal';
type Savings={fortuneo:number|null;per:number|null;date:string|null};
export function ResidenceSection({demoMode=false}:{demoMode?:boolean}){
 const investLoader=useOptionalDashboardSection()?.investReport;
 const fmt=useDashboardDisplayFormat(),[data,setData]=useState<Savings>({fortuneo:null,per:null,date:null}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(demoMode){setData({fortuneo:65000,per:60000,date:'2026-11-01'});setLoading(false);return;}
  const controller=new AbortController();setLoading(true);setError('');
  const read=async(url:string)=>{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(response.status===401||response.status===403?'Connexion requise pour consulter votre épargne.':'Épargne indisponible. Réessayez plus tard.');return response.json();};
  void Promise.all([read('/api/gmail/bankin/balances?account=primary'),investLoader?investLoader.load(revision>0):read('/api/dashboard/invest')]).then(([balances,invest])=>{
   if(controller.signal.aborted)return;
   const banks=bankinBalanceHistory((balances.points??[]) as BankinBalancePoint[]),latest=banks.flatMap(bank=>bank.history).sort((a,b)=>b.date.localeCompare(a.date))[0];
   const fortuneo=latest?Math.round(banks.reduce((sum,bank)=>sum+(bank.history.find(point=>point.date===latest.date)?.balance??0),0)*100)/100:null;
   setData({fortuneo,per:invest.per?.netContributions??null,date:latest?.date??null});
  }).catch(error=>{if(!controller.signal.aborted){setData({fortuneo:null,per:null,date:null});setError(error instanceof Error?error.message:'Épargne indisponible.');}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[demoMode,revision,investLoader]);
 const goal=residenceGoal(data.fortuneo,data.per),pct=goal.percent===null?null:new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(goal.percent);
 const panel='rounded-3xl border border-ink-200/50 bg-white/40 p-5 dark:border-white/10 dark:bg-white/[.025]';
 return <article className={panel} aria-label="Résidence principale · objectif RP">
  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><House size={19} strokeWidth={1.6}/></span><div><h3 className="text-sm font-semibold">Résidence principale</h3><p className="mt-0.5 text-[10px] text-ink-500 dark:text-white/50">Road to la RP</p></div><span className="ml-auto text-[10px] text-ink-400">Objectif {fmt.euro(goal.target)}</span></div>
  {error?<p role="alert" className="mt-4 text-xs text-amber-600 dark:text-amber-300">{error}</p>:null}
  {loading?<div role="status" aria-label="Chargement de l’épargne RP" className="mt-6 space-y-5 motion-safe:animate-pulse"><div className="h-9 w-36 rounded-lg bg-ink-200/60 dark:bg-white/10"/><div className="h-10 rounded-lg bg-ink-200/60 dark:bg-white/10"/><div className="h-2 rounded-full bg-ink-200/60 dark:bg-white/10"/></div>:<>
   <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-white/50">Épargne constituée</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-300">{goal.total===null?'—':fmt.euro(goal.total)}</p></div><div className="text-right"><strong className="text-xl tabular-nums">{pct===null?'—':fmt.dummy?'•• %':`${pct} %`}</strong><p className="mt-1 text-[10px] text-ink-400">de l’objectif</p></div></div>
   <div className="mt-5 grid grid-cols-3 gap-3 border-y border-ink-200/40 py-4 dark:border-white/10">{[{label:'Fortuneo',value:data.fortuneo},{label:'PER',value:data.per},{label:'Reste à constituer',value:goal.remaining}].map(item=><div key={item.label}><p className="text-[10px] text-ink-500 dark:text-white/50">{item.label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{item.value===null?'—':fmt.euro(item.value)}</p></div>)}</div>
   <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-200/50 dark:bg-white/10" aria-hidden="true"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{width:fmt.dummy?'0%':`${Math.min(100,Math.max(0,goal.percent??0))}%`}}/></div>
   <p className="mt-2 text-[10px] text-ink-400">Fortuneo + versements PER nets · objectif {fmt.euro(goal.target)}{data.date?` · solde au ${data.date.split('-').reverse().join('/')}`:''}</p>
   {goal.total===null&&!error?<p className="mt-3 text-xs text-ink-400">Complétez l’historique Fortuneo et PER pour calculer la progression.</p>:null}
  </>}
  <details className="group/rp mt-4 border-t border-ink-200/40 pt-2 dark:border-white/10"><summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-xs text-ink-500 dark:text-white/50"><span>Détail de l’objectif</span><ChevronDown size={14} className="transition group-open/rp:rotate-180"/></summary><p className="mt-2 text-[10px] leading-relaxed text-ink-400">Le PER reprend les versements nets identifiés, sans valorisation de marché. Ce total suit l’objectif de résidence principale ; il ne représente pas un montant immédiatement disponible.</p>{!demoMode?<button type="button" disabled={loading} onClick={()=>setRevision(n=>n+1)} className="mt-2 inline-flex min-h-9 items-center gap-2 text-xs text-ink-400 disabled:opacity-50"><RefreshCw size={13} className={loading?'animate-spin':''}/>Actualiser</button>:null}</details>
 </article>;
}
