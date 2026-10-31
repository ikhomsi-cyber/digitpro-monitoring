"use client";
import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {mergeBankinBalancePoints,type BankinBalancePoint} from '@/lib/gmail/bankin-balance-parser';
import {bankinBalanceHistory} from '@/lib/gmail/bankin-balance-history';
import {useDashboardDisplayFormat} from './DashboardDisplayFormatContext';
export function PiloteBankinBalances(){
 const fmt=useDashboardDisplayFormat(),request=useRef<AbortController|null>(null);
 const [points,setPoints]=useState<BankinBalancePoint[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[scanned,setScanned]=useState(0),[account,setAccount]=useState('primary'),[range,setRange]=useState({from:'',to:''});
 useEffect(()=>()=>request.current?.abort(),[]);
 const resume=useRef<string|undefined>(undefined);
 const [paused,setPaused]=useState(false),[cooldown,setCooldown]=useState(false),[complete,setComplete]=useState(false);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(false),60000);return ()=>clearTimeout(timer);},[cooldown]);
 const load=async()=>{
  if(loading||cooldown||complete||request.current)return;
  const controller=new AbortController();request.current=controller;setLoading(true);setError('');if(!paused){setPoints([]);setScanned(0);}
  let cursor=paused?resume.current:undefined;const seen=new Set<string>();let all:BankinBalancePoint[]=paused?points:[];setPaused(false);
  try{do{
   const response=await fetch('/api/gmail/bankin/balances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account,cursor}),signal:controller.signal});const body=await response.json();if(!response.ok){resume.current=cursor;setPaused(true);if(body.reason==='quota')setCooldown(true);throw new Error(body.error??'Lecture indisponible.');}
   // Merge successful pages and retain the next cursor for explicit resumption.
   all=mergeBankinBalancePoints([...all,...body.points]);setPoints(all);setScanned(n=>n+body.scanned);
   cursor=body.next??undefined;resume.current=cursor;if(cursor){if(seen.has(cursor))throw new Error('Pagination Gmail interrompue.');seen.add(cursor);}
  }while(cursor&&!controller.signal.aborted);
   if(!controller.signal.aborted&&!cursor)setComplete(true);
  }catch(error){if(!controller.signal.aborted){resume.current=cursor;setPaused(true);setError(error instanceof Error?error.message:'Lecture indisponible.');}}
  finally{if(request.current===controller){request.current=null;setLoading(false);}}
 };
 const years=[...new Set(points.map(p=>p.date.slice(0,4)))].sort(),from=range.from||years[0]||'',to=range.to||years.at(-1)||'';
 const visible=points.filter(p=>p.date.slice(0,4)>=from&&p.date.slice(0,4)<=to),banks=bankinBalanceHistory(visible);
 return <section aria-label="Historique des soldes Fortuneo" className="min-w-0 rounded-2xl border border-ink-200/50 bg-white/40 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[.025]">
  <h3 className="text-sm font-semibold">Soldes · Fortuneo</h3>
  <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-xs text-ink-400">Gmail<select aria-label="Compte Gmail des relevés Bankin" value={account} disabled={loading} onChange={e=>{setAccount(e.target.value);setComplete(false);setScanned(0);setPaused(false);resume.current=undefined;setPoints([]);setRange({from:'',to:''});setError('');}} className="ml-2 rounded-lg bg-transparent p-2 text-base"><option value="primary">Principal</option><option value="secondary">Secondaire</option></select></label><button type="button" disabled={loading||cooldown||complete} onClick={()=>void load()} className="min-h-10 rounded-full border border-ink-200/50 px-3 text-xs disabled:opacity-50 dark:border-white/15">{loading?`${scanned} emails lus…`:cooldown?'Pause quota · 1 min':complete?'Historique chargé':paused?'Reprendre la lecture':'Charger les emails'}</button>{loading?<button type="button" onClick={()=>{request.current?.abort();setLoading(false);setPaused(true);setError('Lecture arrêtée : historique partiel.');}} className="text-xs underline">Arrêter</button>:null}</div>
  {error?<p role="alert" className="mt-2 text-xs text-amber-600 dark:text-amber-300">{error}</p>:null}
  {!loading&&!points.length?<p className="mt-3 text-xs text-ink-400">{scanned?'Aucun solde Fortuneo reconnu dans ces emails.':'Chargez les emails « Balance quotidienne » pour afficher les soldes Fortuneo et la ZAKA annuelle.'}</p>:null}
  {years.length?<div className="mt-3 flex gap-3 text-xs"><label>De<select aria-label="Année de début des soldes Bankin" value={from} onChange={e=>setRange({from:e.target.value,to:e.target.value>to?e.target.value:to})} className="ml-2 bg-transparent p-1 text-base">{years.map(y=><option key={y}>{y}</option>)}</select></label><label>À<select aria-label="Année de fin des soldes Bankin" value={to} onChange={e=>setRange({from:e.target.value<from?e.target.value:from,to:e.target.value})} className="ml-2 bg-transparent p-1 text-base">{years.map(y=><option key={y}>{y}</option>)}</select></label></div>:null}
  <div className="mt-3 divide-y divide-ink-200/50 dark:divide-white/10">{banks.map(({bank:name,accounts,history,annual})=>{const last=history.at(-1);if(!last)return null;const low=Math.min(0,...history.map(p=>p.balance)),high=Math.max(1,...history.map(p=>p.balance));const start=Date.parse(history[0].date),end=Date.parse(last.date);const x=(p:BankinBalancePoint)=>10+(Date.parse(p.date)-start)/Math.max(1,end-start)*380,y=(v:number)=>90-(v-low)/Math.max(1,high-low)*80;return <details key={name} open className="py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2.5 text-xs"><Image src="/images/banks/fortuneo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain"/><span>{name}<span className="mt-1 block text-[10px] text-ink-400">{accounts.length} compte(s) · {last.date.split('-').reverse().join('/')}</span></span></span><strong className="shrink-0 text-sm tabular-nums">{fmt.euroExact(last.balance)}</strong></summary>{fmt.dummy?<p className="mt-3 text-xs text-ink-400">Graphique masqué.</p>:<svg role="img" aria-label={`Historique du solde de ${name}`} viewBox="0 0 400 110" className="mt-3 w-full"><path d={history.map((p,i)=>`${i?'L':'M'}${x(p)},${y(p.balance)}`).join(' ')} fill="none" stroke="var(--app-accent)" strokeWidth="2"/><circle cx={x(last)} cy={y(last.balance)} r="3" fill="var(--app-accent)"/><text x="10" y="108" fontSize="9" fill="currentColor">{history[0].date}</text><text x="390" y="108" fontSize="9" fill="currentColor" textAnchor="end">{last.date}</text></svg>}<div className="mt-3 space-y-2 border-t border-white/10 pt-3">{annual.map(row=><div key={row.year} className="flex items-center justify-between gap-3 text-xs"><span>{row.year}<span className="mt-1 block text-[10px] text-ink-400">Minimum observé · {fmt.euroExact(row.minimum)}</span></span><span className="text-right text-emerald-400">ZAKA · <strong>{fmt.euroExact(row.zaka)}</strong></span></div>)}</div><p className="mt-3 text-[10px] text-ink-400">2,5 % du minimum annuel observé · {history.length} relevés complets. Les jours sans email ne sont pas reconstitués.</p></details>;})}</div>
 </section>;
}
