"use client";
import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {type BankinBalancePoint} from '@/lib/gmail/bankin-balance-parser';
import {bankinBalanceHistory} from '@/lib/gmail/bankin-balance-history';
import {useDashboardDisplayFormat} from './DashboardDisplayFormatContext';
export function PiloteBankinBalances(){
 const fmt=useDashboardDisplayFormat(),request=useRef<AbortController|null>(null);
 const [points,setPoints]=useState<BankinBalancePoint[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[scanned,setScanned]=useState(0),[account,setAccount]=useState('primary'),[range,setRange]=useState({from:'',to:''});
 const [refreshVersion,setRefreshVersion]=useState(0),[missed,setMissed]=useState(0);
 useEffect(()=>{const refresh=()=>setRefreshVersion(n=>n+1);window.addEventListener('bankin-balances-updated',refresh);return ()=>window.removeEventListener('bankin-balances-updated',refresh);},[]);
 const [pending,setPending]=useState(false),[hydrating,setHydrating]=useState(true),[pauseUntil,setPauseUntil]=useState(0);
 const [now,setNow]=useState(()=>Date.now());
 const apply=(body:{points:BankinBalancePoint[];scanned:number;missed:number;pending:boolean;error:string|null;pauseUntil:number})=>{setMissed(body.missed);setPoints(body.points);setScanned(body.scanned);setPending(body.pending);setPauseUntil(body.pauseUntil);setError(body.error??'');};
 useEffect(()=>{
  const controller=new AbortController();setHydrating(true);setPoints([]);setScanned(0);setError('');setPending(false);setPauseUntil(0);
  void fetch(`/api/gmail/bankin/balances?account=${account}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'Historique indisponible.');apply(body);}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Historique indisponible.');}).finally(()=>{if(!controller.signal.aborted)setHydrating(false);});
  return ()=>{controller.abort();request.current?.abort();};
 },[account,refreshVersion]);
 useEffect(()=>{if(pauseUntil<=Date.now())return;const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[pauseUntil]);
 const cooldown=pauseUntil>now;
 const load=async()=>{
  if(loading||hydrating||cooldown||request.current)return;
  const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{
   let more=true;
   while(more&&!controller.signal.aborted){
    const response=await fetch('/api/gmail/bankin/balances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account}),signal:controller.signal});const body=await response.json();
    if(!response.ok){if(body.reason==='quota'){setPauseUntil(Date.now()+60000);setNow(Date.now());}throw new Error(body.error??'Lecture indisponible.');}
    apply(body);more=body.pending&&!body.error;
   }
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Lecture indisponible.');}
  finally{if(request.current===controller){request.current=null;setLoading(false);}}
 };
 const years=[...new Set(points.map(p=>p.date.slice(0,4)))].sort(),from=range.from||years[0]||'',to=range.to||years.at(-1)||'';
 const visible=points.filter(p=>p.date.slice(0,4)>=from&&p.date.slice(0,4)<=to),banks=bankinBalanceHistory(visible);
 return <section aria-label="Historique des soldes Fortuneo" className="min-w-0 rounded-2xl border border-ink-200/50 bg-white/40 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[.025]">
  <h3 className="text-sm font-semibold">Soldes · Fortuneo</h3>
  <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-xs text-ink-400">Gmail<select aria-label="Compte Gmail des relevés Bankin" value={account} disabled={loading} onChange={e=>{setAccount(e.target.value);setPoints([]);setRange({from:'',to:''});setError('');}} className="ml-2 rounded-lg bg-transparent p-2 text-base"><option value="primary">Principal</option><option value="secondary">Secondaire</option></select></label><button type="button" disabled={loading||hydrating||cooldown} onClick={()=>void load()} className="min-h-10 rounded-full border border-ink-200/50 px-3 text-xs disabled:opacity-50 dark:border-white/15">{loading?`${scanned} emails lus…`:cooldown?'Pause quota':hydrating?'Chargement…':pending?'Reprendre la collecte':points.length?'Actualiser':'Collecter l’historique'}</button>{loading?<button type="button" onClick={()=>{request.current?.abort();setLoading(false);setPending(true);setError('Collecte arrêtée. La progression est sauvegardée.');}} className="text-xs underline">Arrêter</button>:null}</div>
  {scanned>0?<p className="mt-2 text-[10px] text-ink-400">{scanned} relevé(s) enregistré(s){pending?" · collecte partielle":""}</p>:null}
  {missed>0?<p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{missed} email(s) sans solde reconnu : historique incomplet.</p>:null}
  {error?<p role="alert" className="mt-2 text-xs text-amber-600 dark:text-amber-300">{error}</p>:null}
  {!loading&&!points.length?<p className="mt-3 text-xs text-ink-400">{scanned?'Aucun solde Fortuneo reconnu dans ces emails.':'Chargez les emails « Balance quotidienne » pour afficher les soldes Fortuneo et la zakat annuelle.'}</p>:null}
  {years.length?<div className="mt-3 flex gap-3 text-xs"><label>De<select aria-label="Année de début des soldes Bankin" value={from} onChange={e=>setRange({from:e.target.value,to:e.target.value>to?e.target.value:to})} className="ml-2 bg-transparent p-1 text-base">{years.map(y=><option key={y}>{y}</option>)}</select></label><label>À<select aria-label="Année de fin des soldes Bankin" value={to} onChange={e=>setRange({from:e.target.value<from?e.target.value:from,to:e.target.value})} className="ml-2 bg-transparent p-1 text-base">{years.map(y=><option key={y}>{y}</option>)}</select></label></div>:null}
  <div className="mt-3 divide-y divide-ink-200/50 dark:divide-white/10">{banks.map(({bank:name,accounts,history,annual})=>{const last=history.at(-1);if(!last)return null;const low=Math.min(0,...history.map(p=>p.balance)),high=Math.max(1,...history.map(p=>p.balance));const start=Date.parse(history[0].date),end=Date.parse(last.date);const x=(p:BankinBalancePoint)=>10+(Date.parse(p.date)-start)/Math.max(1,end-start)*380,y=(v:number)=>90-(v-low)/Math.max(1,high-low)*80;return <details key={name} open className="py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2.5 text-xs"><Image src="/images/banks/fortuneo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain"/><span>{name}<span className="mt-1 block text-[10px] text-ink-400">{accounts.length} compte(s) · {last.date.split('-').reverse().join('/')}</span></span></span><strong className="shrink-0 text-sm tabular-nums">{fmt.euroExact(last.balance)}</strong></summary>{fmt.dummy?<p className="mt-3 text-xs text-ink-400">Graphique masqué.</p>:<svg role="img" aria-label={`Historique du solde de ${name}`} viewBox="0 0 400 110" className="mt-3 w-full"><path d={history.map((p,i)=>`${i?'L':'M'}${x(p)},${y(p.balance)}`).join(' ')} fill="none" stroke="var(--app-accent)" strokeWidth="2"/><circle cx={x(last)} cy={y(last.balance)} r="3" fill="var(--app-accent)"/><text x="10" y="108" fontSize="9" fill="currentColor">{history[0].date}</text><text x="390" y="108" fontSize="9" fill="currentColor" textAnchor="end">{last.date}</text></svg>}<AnnualZakatChart annual={annual}/><p className="mt-3 text-[10px] text-ink-400">Estimation · 2,5 % du minimum observé. Historique échantillonné chaque semaine, puis nouveaux relevés quotidiens. Les jours absents peuvent masquer un minimum plus bas.</p></details>;})}</div>
 </section>;
}

function AnnualZakatChart({annual}:{annual:{year:string;minimum:number;zaka:number;observations:number}[]}){
 const fmt=useDashboardDisplayFormat(),[selectedYear,setSelectedYear]=useState<string|null>(null);
 const selected=annual.find(row=>row.year===selectedYear)??annual.at(-1),max=Math.max(1,...annual.map(row=>row.zaka));
 if(!selected)return null;
 return <figure className="mt-4 border-t border-ink-200/40 pt-4 dark:border-white/10"><figcaption className="flex items-center justify-between gap-3 text-xs"><span><bdi lang="ar" dir="rtl">الزكاة</bdi> · par année</span><span className="text-[10px] text-ink-400">Touchez une année</span></figcaption>{fmt.dummy?<p className="mt-4 text-xs text-ink-400">Graphique masqué.</p>:<div className="mt-4 overflow-x-auto pb-1"><div className="flex h-36 items-stretch gap-2" style={{minWidth:annual.length*42}}>{annual.map(row=><button key={row.year} type="button" onClick={()=>setSelectedYear(row.year)} aria-pressed={selected.year===row.year} aria-label={`${row.year} : الزكاة ${fmt.euroExact(row.zaka)}, minimum observé ${fmt.euroExact(row.minimum)}`} className="group flex min-w-8 flex-1 flex-col items-center justify-end gap-2 rounded-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"><span className={`w-full max-w-8 rounded-t-md transition-opacity ${selected.year===row.year?'bg-emerald-400':'bg-emerald-500/45 group-hover:bg-emerald-400/80'}`} style={{height:Math.max(2,row.zaka/max*110)}}/><span className={`text-[9px] tabular-nums ${selected.year===row.year?'font-semibold':'text-ink-400'}`}>{row.year}</span></button>)}</div></div>}<div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-200/30 pt-3 dark:border-white/10" aria-live="polite"><div><p className="text-xs font-medium">{selected.year}</p><p className="mt-1 text-[10px] text-ink-400">Minimum observé · {fmt.euroExact(selected.minimum)}</p><p className="mt-1 text-[10px] text-ink-400">{selected.observations} relevés</p></div><strong className="text-base tabular-nums text-emerald-500 dark:text-emerald-300">{fmt.euroExact(selected.zaka)}</strong></div></figure>;
}
