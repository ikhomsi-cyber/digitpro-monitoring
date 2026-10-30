import type { HouseholdYearComparison } from "@/lib/daily-brief-household";
import { ArrowUpRight, CalendarDays, CarFront, House, ReceiptText, ShieldCheck, TrendingUp, Utensils, Wallet } from "lucide-react";
import type { BriefActivity } from "@/lib/daily-brief-activity";
import type { PiloteCompensation } from "@/lib/pilote";
const money=(value:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value);
const percent=(value:number)=>Math.min(100,Math.max(0,Number.isFinite(value)?value:0));
const coverage=(cash:number,debt:number)=>debt>0?percent(cash/debt*100):cash>=0?100:0;
const familyIcons={rent:House,transport:CarFront,ndf:ReceiptText,food:Utensils,other:Wallet};
const card="min-w-0 py-5";
const eyebrow="text-[10px] font-medium uppercase tracking-[.14em] text-ink-400 dark:text-white/45";

export function ActivityBriefVisual({activity,date}:{activity:BriefActivity;date:string}){
 const worked=activity.workedMonth,planned=activity.plannedMonth??0,days=Math.max((worked??0)+planned,1);
 const ceiling=Math.max(...activity.history.slice(0,2).flatMap(row=>[row.generatedHt??0,row.cashedHt??0]),1);
 return <div className="divide-y divide-ink-200/50 dark:divide-white/10">
  {worked!==null?<figure aria-label={`${worked} jours réalisés et ${planned} jours planifiés sur le mois`} className={`${card} flex items-center justify-between gap-4`}>
   <div><figcaption className={`${eyebrow} flex items-center gap-2`}><CalendarDays size={14}/>Votre rythme</figcaption><p className="mt-3 flex items-baseline gap-2"><strong className="text-4xl font-semibold tracking-tight tabular-nums">{worked}</strong><span className="text-xs text-ink-500 dark:text-white/55">jours réalisés</span></p><p className="mt-2 text-[11px] text-ink-400">{planned?`${planned} jours encore planifiés`:"Aucun jour à venir planifié"} · {date.slice(5,7)}/{date.slice(0,4)}</p></div>
   <div className="relative grid h-20 w-20 shrink-0 place-items-center"><svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true"><circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="5" className="text-ink-100 dark:text-white/10"/><circle cx="40" cy="40" r="32" fill="none" stroke="var(--app-accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${percent(worked/days*100)*2.0106} 201.06`}/></svg><span className="text-sm font-semibold tabular-nums">{Math.round(percent(worked/days*100))}<span className="ml-0.5 text-[9px] font-normal text-ink-400">%</span></span></div>
  </figure>:null}
  <figure aria-label="CA généré et encaissé, du 1er janvier à la même date pour chaque année" className={card}>
   <figcaption className={`${eyebrow} flex items-center gap-2`}><TrendingUp size={14}/>Chiffre d’affaires · HT à date</figcaption>
   <div className="mt-4 grid grid-cols-2 gap-3">{activity.history.slice(0,2).map((row,index)=><div key={row.year} className={`min-w-0 ${index===0?"":"border-l border-ink-200/50 pl-4 dark:border-white/10"}`}><p className="flex items-center justify-between text-[11px] font-medium text-ink-500 dark:text-white/55">{row.year}{index===0?<ArrowUpRight size={13} className="text-[var(--app-accent)]"/>:null}</p><p className="mt-3 text-[10px] text-ink-400">Généré / facturé</p><p className="mt-1 break-words text-lg font-semibold tracking-tight tabular-nums sm:text-xl">{row.generatedHt===null?"—":money(row.generatedHt)}</p><div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-ink-200/60 dark:bg-white/10"><div className="h-full rounded-full bg-[var(--app-accent)]" style={{width:`${percent((row.generatedHt??0)/ceiling*100)}%`}}/></div><div className="mt-4 border-t border-ink-200/50 pt-3 dark:border-white/10"><p className="text-[10px] text-ink-400">Encaissé</p><p className="mt-1 text-sm font-medium tabular-nums">{row.cashedHt===null?"Non renseigné":money(row.cashedHt)}</p></div></div>)}</div>
   <p className="mt-3 text-[10px] text-ink-400 dark:text-white/35">Du 1er janvier au même jour de chaque année.</p>
  </figure>
 </div>;
}
export function TreasuryBriefVisual({activity}:{activity:BriefActivity}){
 const treasury=activity.treasury;if(!treasury)return null;
 const current=coverage(treasury.cash,treasury.debt172),next=activity.nextInvoice;
 const projectedCash=next?treasury.cash+next.invoiceAmountHt*1.2:null;
 const projectedDebt=projectedCash!==null&&treasury.projectedMargin!==null?projectedCash-treasury.projectedMargin:null;
 const projected=projectedCash!==null&&projectedDebt!==null?coverage(projectedCash,projectedDebt):null;
 return <figure className={card} aria-label={`Couverture de la réserve : ${Math.round(current)} % aujourd’hui`}>
  <figcaption className={`${eyebrow} flex items-center gap-2`}><ShieldCheck size={14}/>Votre réserve · CSG 17,2 % + TVA</figcaption>
  <div className="mt-4 flex items-end justify-between gap-3"><p className="text-3xl font-semibold tracking-tight tabular-nums">{Math.round(current)}<span className="ml-1 text-sm font-normal text-ink-400">%</span></p><span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${current>=100?"bg-emerald-500/10 text-emerald-600 dark:text-emerald-300":"bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{current>=100?"Réserve couverte":"À sécuriser"}</span></div>
  <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[.07]"><div className={`h-full rounded-full ${current>=100?"bg-emerald-400":"bg-gradient-to-r from-amber-300 to-amber-500"}`} style={{width:`${current}%`}}/></div>
  {projected!==null?<div className="mt-4 flex items-center justify-between gap-3 border-l-2 border-[var(--app-accent)] py-1 pl-3"><div className="min-w-0"><p className="text-[11px] font-medium">Après encaissement intégral</p><p className="mt-1 text-[10px] text-ink-400">Facture · {money(next!.invoiceAmountHt)} HT</p></div><span className="shrink-0 text-lg font-semibold tabular-nums text-[var(--app-accent)]">{Math.round(projected)} %</span></div>:null}
  <p className="mt-3 text-[10px] leading-relaxed text-ink-400 dark:text-white/35">Simulation selon les règles de l’application, TVA incluse. L’encaissement reste à confirmer.</p>
 </figure>;
}
export function HouseholdBriefVisual({families}:{families:PiloteCompensation[]}){
 const visible=families.filter(f=>f.expenses>0);if(!visible.length)return null;
 return <figure className={card} aria-label="Détail de la couverture des dépenses par famille">
  <figcaption className={`${eyebrow} flex items-center gap-2`}><House size={14}/>Les compensations du foyer</figcaption>
  <p className="mt-1 text-[10px] text-ink-400 dark:text-white/45">Essentiel + Presque essentiel · toutes compensations réunies</p>
  <div className="mt-4 space-y-4">{visible.map(family=>{const Icon=familyIcons[family.id],value=percent(family.income/family.expenses*100);return <div key={family.id}>
   <div className="flex items-center gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center text-ink-500 dark:text-white/55"><Icon size={16} strokeWidth={1.5}/></span><div className="min-w-0 flex-1"><p className="text-xs font-medium">{family.name}</p><p className="mt-0.5 text-[10px] text-ink-400">{money(family.income)} reçus · {money(family.expenses)} dépensés</p></div><span className={`shrink-0 text-xs font-semibold tabular-nums ${family.balance<0?"text-amber-600 dark:text-amber-300":"text-emerald-600 dark:text-emerald-300"}`}>{family.balance<0?"−":"+"}{money(Math.abs(family.balance))}</span></div>
   <div aria-hidden="true" className="ml-9 mt-2 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[.07]"><div className={`h-full rounded-full ${family.balance<0?"bg-amber-400":"bg-emerald-400"}`} style={{width:`${value}%`}}/></div>
  </div>;})}</div>
  <p className="mt-4 border-t border-ink-200/50 pt-3 text-[10px] leading-relaxed text-ink-400 dark:border-white/10 dark:text-white/40">Les excédents couvrent les déficits des autres familles dans le total de votre poche.</p>
 </figure>;
}

export function HouseholdHistoryVisual({history}:{history:HouseholdYearComparison[]}){
 const current=history[0],previous=history[1];if(!current)return null;
 const maximum=Math.max(1,...history.map(row=>row.monthOutOfPocket??0));
 const delta=current.monthOutOfPocket!=null&&previous?.monthOutOfPocket!=null?current.monthOutOfPocket-previous.monthOutOfPocket:null;
 const change=delta!==null&&previous!.monthOutOfPocket!>0?delta/previous!.monthOutOfPocket!*100:null;
 return <figure className={card} aria-label="Comparaison annuelle du reste payé de votre poche à date">
  <figcaption className={`${eyebrow} flex items-center gap-2`}><Wallet size={14}/>De votre poche · à date comparable</figcaption>
  <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] text-ink-400">{current.year} · même période</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{current.monthOutOfPocket==null?"À compléter":money(current.monthOutOfPocket)}</p></div>{change!==null?<span className={`mb-1 text-xs font-medium tabular-nums ${delta!<=0?"text-emerald-600 dark:text-emerald-300":"text-amber-700 dark:text-amber-300"}`}>{change>0?"+":""}{change.toLocaleString("fr-FR",{maximumFractionDigits:1})} % <span className="text-[10px] font-normal text-ink-400">vs {previous.year}</span></span>:null}</div>
  <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[.07]"><div className="h-full rounded-full bg-[var(--app-accent)]" style={{width:`${percent((current.monthOutOfPocket??0)/maximum*100)}%`}}/></div>
  <dl className="mt-5 space-y-4">{history.slice(1).map(row=><div key={row.year}><div className="flex items-baseline justify-between gap-4"><dt className="text-xs text-ink-500 dark:text-white/55">{row.year}</dt><dd className="text-sm font-medium tabular-nums text-ink-700 dark:text-white/80">{row.monthOutOfPocket==null?"Non renseigné":money(row.monthOutOfPocket)}</dd></div>{row.monthOutOfPocket!=null?<div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[.05]"><div className="h-full rounded-full bg-ink-300 dark:bg-white/25" style={{width:`${percent(row.monthOutOfPocket/maximum*100)}%`}}/></div>:null}</div>)}</dl>
 </figure>;
}
