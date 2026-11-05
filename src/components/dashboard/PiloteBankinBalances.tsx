"use client";
import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {YearRangeFilter} from './YearRangeFilter';
import {type BankinBalancePoint} from '@/lib/gmail/bankin-balance-parser';
import {bankinBalanceHistory,historicalFortuneoPoints} from '@/lib/gmail/bankin-balance-history';
import {useDashboardDisplayFormat} from './DashboardDisplayFormatContext';
export function PiloteBankinBalances(){
 const fmt=useDashboardDisplayFormat(),request=useRef<AbortController|null>(null);
 const [points,setPoints]=useState<BankinBalancePoint[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[scanned,setScanned]=useState(0),[account,setAccount]=useState('primary'),[range,setRange]=useState({from:'',to:''});
 const [selectedBalanceAccount,setSelectedBalanceAccount]=useState('all');
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
 const visible=points.filter(p=>p.date.slice(0,4)>=from&&p.date.slice(0,4)<=to),banks=bankinBalanceHistory(visible.filter(p=>selectedBalanceAccount==='all'||p.account===selectedBalanceAccount));
 const balanceAccounts=[...new Set(points.filter(p=>/\bfortuneo\b/i.test(p.account)).map(p=>p.account))].sort();
 const zakatBanks=bankinBalanceHistory(historicalFortuneoPoints(points).filter(p=>p.date.slice(0,4)>=from&&p.date.slice(0,4)<=to));
 return <section aria-label="Historique des soldes Fortuneo" className="min-w-0 rounded-2xl border border-ink-200/50 bg-white/40 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[.025]">
  <h3 className="text-sm font-semibold">Soldes · Fortuneo</h3>
  {scanned>0?<p className="mt-2 text-[10px] text-ink-400">{scanned} relevé(s) enregistré(s){pending?" · collecte partielle":""}</p>:null}
  {error?<p role="alert" className="mt-2 text-xs text-amber-600 dark:text-amber-300">{error}</p>:null}
  {!loading&&!points.length?<p className="mt-3 text-xs text-ink-400">{scanned?'Aucun solde Fortuneo reconnu dans ces emails.':'Chargez les emails « Balance quotidienne » pour afficher les soldes Fortuneo et la zakat annuelle.'}</p>:null}
  {years.length?<YearRangeFilter years={years} from={from} to={to} onChange={(from,to)=>setRange({from,to})}/>:null}
  <div className="mt-3 divide-y divide-ink-200/50 dark:divide-white/10">{banks.map(({bank:name,accounts,history})=>{const last=history.at(-1);if(!last)return null;const low=Math.min(0,...history.map(p=>p.balance)),high=Math.max(1,...history.map(p=>p.balance));const start=Date.parse(history[0].date),end=Date.parse(last.date);const x=(p:BankinBalancePoint)=>10+(Date.parse(p.date)-start)/Math.max(1,end-start)*380,y=(v:number)=>90-(v-low)/Math.max(1,high-low)*80;return <details key={name} open className="py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2.5 text-xs"><Image src="/images/banks/fortuneo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain"/><span className="min-w-0"><BalanceAccountPicker accounts={balanceAccounts} value={selectedBalanceAccount} onChange={setSelectedBalanceAccount}/><span className="mt-0.5 block text-[10px] text-ink-400">{accounts.length} compte(s) · {last.date.split('-').reverse().join('/')}</span></span></span><strong className="shrink-0 text-sm tabular-nums">{fmt.euroExact(last.balance)}</strong></summary>{fmt.dummy?<p className="mt-3 text-xs text-ink-400">Graphique masqué.</p>:<svg role="img" aria-label={`Historique du solde de ${name}`} viewBox="0 0 400 110" className="mt-3 w-full"><path d={history.map((p,i)=>`${i?'L':'M'}${x(p)},${y(p.balance)}`).join(' ')} fill="none" stroke="var(--app-accent)" strokeWidth="2"/><circle cx={x(last)} cy={y(last.balance)} r="3" fill="var(--app-accent)"/><text x="10" y="108" fontSize="9" fill="currentColor">{history[0].date}</text><text x="390" y="108" fontSize="9" fill="currentColor" textAnchor="end">{last.date}</text></svg>}<AnnualZakatChart annual={zakatBanks.find(row=>row.bank===name)?.annual??[]}/><p className="mt-3 text-[10px] text-ink-400">Compte Fortuneo historique uniquement · 2,5 % du minimum observé. Historique échantillonné chaque semaine, puis nouveaux relevés quotidiens. Les jours absents peuvent masquer un minimum plus bas.</p></details>;})}</div>
 </section>;
}

function AnnualZakatChart({annual}:{annual:{year:string;minimum:number;zaka:number;observations:number}[]}){
 const fmt=useDashboardDisplayFormat(),[selectedYear,setSelectedYear]=useState<string|null>(null);
 const selected=annual.find(row=>row.year===selectedYear)??annual.at(-1),max=Math.max(1,...annual.map(row=>row.zaka));
 if(!selected)return null;
 return <figure className="mt-4 border-t border-ink-200/40 pt-4 dark:border-white/10"><figcaption className="flex items-center justify-between gap-3 text-xs"><span><bdi lang="ar" dir="rtl">الزكاة</bdi> · par année</span><span className="text-[10px] text-ink-400">Touchez une année</span></figcaption>{fmt.dummy?<p className="mt-4 text-xs text-ink-400">Graphique masqué.</p>:<div className="mt-4 overflow-x-auto pb-1"><div className="flex h-36 items-stretch gap-2" style={{minWidth:annual.length*42}}>{annual.map(row=><button key={row.year} type="button" onClick={()=>setSelectedYear(row.year)} aria-pressed={selected.year===row.year} aria-label={`${row.year} : الزكاة ${fmt.euroExact(row.zaka)}, minimum observé ${fmt.euroExact(row.minimum)}`} className="group flex min-w-8 flex-1 flex-col items-center justify-end gap-2 rounded-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"><span className={`w-full max-w-8 rounded-t-md transition-opacity ${selected.year===row.year?'bg-emerald-400':'bg-emerald-500/45 group-hover:bg-emerald-400/80'}`} style={{height:Math.max(2,row.zaka/max*110)}}/><span className={`text-[9px] tabular-nums ${selected.year===row.year?'font-semibold':'text-ink-400'}`}>{row.year}</span></button>)}</div></div>}<div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-200/30 pt-3 dark:border-white/10" aria-live="polite"><div><p className="text-xs font-medium">{selected.year}</p><p className="mt-1 text-[10px] text-ink-400">Minimum observé · {fmt.euroExact(selected.minimum)}</p><p className="mt-1 text-[10px] text-ink-400">{selected.observations} relevés</p></div><strong className="text-base tabular-nums text-emerald-500 dark:text-emerald-300">{fmt.euroExact(selected.zaka)}</strong></div></figure>;
}

function BalanceAccountPicker({accounts,value,onChange}:{accounts:string[];value:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLSpanElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const label=(account:string)=>account==='all'?'Tous les comptes':account.replace(/^Fortuneo\s*·\s*/i,'');
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return ()=>document.removeEventListener('pointerdown',close);},[open]);
 return <span ref={root} className="relative inline-block max-w-full" onClick={event=>event.stopPropagation()} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}}}>
  <button ref={trigger} type="button" aria-label="Compte pour l’évolution du solde" aria-expanded={open} aria-haspopup="true" onClick={()=>setOpen(current=>!current)} className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg py-1 pr-1 text-left text-sm font-semibold transition-colors hover:text-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"><span className="max-w-44 truncate">{label(value)}</span><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`h-3 w-3 shrink-0 text-ink-400 transition-transform ${open?'rotate-180':''}`}><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
  {open?<span role="group" aria-label="Choisir un compte Fortuneo" className="absolute left-0 top-full z-30 mt-2 block w-64 max-w-[calc(100vw-6rem)] overflow-hidden rounded-2xl border border-ink-200/60 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-slate-900"><span className="block px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-400">Vos comptes Fortuneo</span>{['all',...accounts].map(account=><button key={account} type="button" aria-pressed={value===account} onClick={()=>{onChange(account);setOpen(false);trigger.current?.focus();}} className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${value===account?'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300':'hover:bg-black/5 dark:hover:bg-white/5'}`}><Image src="/images/banks/fortuneo.png" alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain"/><span className="min-w-0 flex-1 break-words">{label(account)}</span>{value===account?<span aria-hidden="true" className="text-base">✓</span>:null}</button>)}</span>:null}
 </span>;
}
