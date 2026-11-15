"use client";
import {useEffect,useId,useState} from 'react';
import {House} from 'lucide-react';
import {useOptionalDashboardSection} from './DashboardSectionContext';
import {useDashboardDisplayFormat} from './DashboardDisplayFormatContext';
import {bankinBalanceHistory} from '@/lib/gmail/bankin-balance-history';
import type {BankinBalancePoint} from '@/lib/gmail/bankin-balance-parser';
import {residenceGoal} from '@/lib/residence-goal';
type Savings={fortuneo:number|null;per:number|null;date:string|null};
const houseOutline = "M29 67 100 15 171 67V125a8 8 0 0 1-8 8H37a8 8 0 0 1-8-8Z";

function HouseProgress({percent}:{percent:number}){
 const id = useId();
 const level = Math.min(100, Math.max(0, percent));
 const waterline = 133 - 118 * level / 100;

 return (
  <svg viewBox="0 0 200 150" aria-hidden="true" className="w-[42%] max-w-44 shrink-0">
   <defs>
    <clipPath id={`${id}-house`}><path d={houseOutline}/></clipPath>
    <linearGradient id={`${id}-fill`} x2="0%" y2="100%">
     <stop stopColor="#6ee7b7"/>
     <stop offset="1" stopColor="#059669"/>
    </linearGradient>
   </defs>
   <path d="M16 141h168" className="stroke-emerald-500/30" strokeWidth="2" strokeLinecap="round"/>
   <path d={houseOutline} className="fill-emerald-500/10"/>
   <g clipPath={`url(#${id}-house)`}>
    <rect x="28" y={waterline} width="144" height={133 - waterline} fill={`url(#${id}-fill)`}/>
    {level > 0 && level < 100 && <path d={`M28 ${waterline}h144`} stroke="#6ee7b7" strokeWidth="2"/>}
    <path d="M84 133v-26a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v26M47 76h24v22H47zm82 0h24v22h-24zM59 76v22m82-22v22"
     fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
     className="text-emerald-900/70 dark:text-emerald-100/65"/>
   </g>
   <path d={houseOutline} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"
    className="text-emerald-700 dark:text-emerald-300"/>
   <path d="M18 74 100 14l82 60" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
    className="text-emerald-700 dark:text-emerald-300"/>
  </svg>
 );
}

export function ResidenceSection({demoMode=false,revision=0}:{demoMode?:boolean;revision?:number}){
 const investLoader=useOptionalDashboardSection()?.investReport;
 const fmt=useDashboardDisplayFormat(),[data,setData]=useState<Savings>({fortuneo:null,per:null,date:null}),[loading,setLoading]=useState(true),[error,setError]=useState('');
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
   <div className="mt-5 flex items-center justify-between gap-3 sm:gap-6">
    <div className="min-w-0">
     <p className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-white/50">Épargne constituée</p>
     <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-300 sm:text-3xl">{goal.total===null?'—':fmt.euro(goal.total)}</p>
     {pct !== null && (
      <p className="mt-2 text-xs text-ink-500 dark:text-white/60">
       <strong className="font-semibold tabular-nums text-ink-900 dark:text-white">{fmt.dummy ? '•• %' : `${pct} %`}</strong> de l’objectif
      </p>
     )}
    </div>
    {!fmt.dummy && goal.percent !== null && <HouseProgress percent={goal.percent}/>}
   </div>
   <div className="mt-5 grid grid-cols-3 gap-3 border-y border-ink-200/40 py-4 dark:border-white/10">{[{label:'Fortuneo',value:data.fortuneo},{label:'PER',value:data.per},{label:'Reste à constituer',value:goal.remaining}].map(item=><div key={item.label}><p className="text-[10px] text-ink-500 dark:text-white/50">{item.label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{item.value===null?'—':fmt.euro(item.value)}</p></div>)}</div>
   <p className="mt-2 text-[10px] text-ink-400">Fortuneo + versements PER nets · objectif {fmt.euro(goal.target)}{data.date?` · solde au ${data.date.split('-').reverse().join('/')}`:''}</p>
   {goal.total===null&&!error?<p className="mt-3 text-xs text-ink-400">Complétez l’historique Fortuneo et PER pour calculer la progression.</p>:null}
  </>}
 </article>;
}
