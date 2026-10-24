import { CarFront, House, ReceiptText, Utensils, Wallet } from "lucide-react";
import type { BriefActivity } from "@/lib/daily-brief-activity";
import type { PiloteCompensation } from "@/lib/pilote";
const money=(value:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value);
const percent=(value:number)=>Math.min(100,Math.max(0,Number.isFinite(value)?value:0));
const coverage=(cash:number,debt:number)=>debt>0?percent(cash/debt*100):cash>=0?100:0;
const familyIcons={rent:House,transport:CarFront,ndf:ReceiptText,food:Utensils,other:Wallet};

export function ActivityBriefVisual({activity,date}:{activity:BriefActivity;date:string}){
 const year=Number(date.slice(0,4));
 const ceiling=Math.max(activity.yearRevenueHt,activity.previousYearRevenueHt??0,1);
 const worked=activity.workedMonth,planned=activity.plannedMonth??0;
 const days=Math.max((worked??0)+planned,1);
 return <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.3fr]">
  {worked!==null?<figure aria-label={`${worked} jours réalisés et ${planned} jours planifiés sur le mois`} className="min-w-0">
   <figcaption className="text-[10px] text-ink-400 dark:text-white/40">Votre mois de travail</figcaption>
   <p className="mt-2 flex items-baseline gap-1.5"><strong className="text-2xl font-semibold tracking-tight tabular-nums">{worked}</strong><span className="text-xs text-ink-500 dark:text-white/50">jours réalisés</span>{planned>0?<span className="ml-auto text-[10px] text-ink-400 dark:text-white/40">+{planned} prévus</span>:null}</p>
   <div aria-hidden="true" className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/5"><span className="bg-emerald-500" style={{width:`${percent(worked/days*100)}%`}}/><span className="bg-emerald-500/25" style={{width:`${percent(planned/days*100)}%`}}/></div>
  </figure>:null}
  <figure aria-label={`CA HT encaissé à date : ${year}, ${money(activity.yearRevenueHt)} ; ${year-1}, ${activity.previousYearRevenueHt===null?"comparatif indisponible":money(activity.previousYearRevenueHt)}`} className="min-w-0">
   <figcaption className="flex items-center justify-between gap-2 text-[10px] text-ink-400 dark:text-white/40"><span>CA HT · à date comparable</span>{activity.yearChangePercent!==null?<span className={activity.yearChangePercent>=0?"text-emerald-600 dark:text-emerald-300":"text-amber-600 dark:text-amber-300"}>{activity.yearChangePercent>0?"+":""}{activity.yearChangePercent.toLocaleString("fr-FR",{maximumFractionDigits:1})} %</span>:null}</figcaption>
   <div className="mt-2 space-y-2">{[{year,value:activity.yearRevenueHt,current:true},...(activity.previousYearRevenueHt===null?[]:[{year:year-1,value:activity.previousYearRevenueHt,current:false}])].map(row=><div key={row.year}><div className="flex items-baseline justify-between text-[10px]"><span className="text-ink-500 dark:text-white/50">{row.year}</span><span className="font-medium tabular-nums">{money(row.value)}</span></div><div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/5"><div className={`h-full rounded-full ${row.current?"bg-emerald-500":"bg-ink-300 dark:bg-white/25"}`} style={{width:`${percent(row.value/ceiling*100)}%`}}/></div></div>)}</div>
   {activity.previousYearRevenueHt===null?<p className="mt-2 text-[10px] text-ink-400 dark:text-white/40">Historique précédent indisponible</p>:null}
  </figure>
 </div>;
}

export function TreasuryBriefVisual({activity}:{activity:BriefActivity}){
 const treasury=activity.treasury;if(!treasury)return null;
 const current=coverage(treasury.cash,treasury.debt172);
 const next=activity.nextInvoice;
 const projectedCash=next?treasury.cash+next.amountHt*1.2:null;
 const projectedDebt=projectedCash!==null&&treasury.projectedMargin!==null?projectedCash-treasury.projectedMargin:null;
 const projected=projectedCash!==null&&projectedDebt!==null?coverage(projectedCash,projectedDebt):null;
 const rows=[{label:"Aujourd’hui",value:current,projected:false},...(projected===null?[]:[{label:"Après encaissement",value:projected,projected:true}])];
 return <figure className="mt-4" aria-label={`Couverture de la réserve CSG à 17,2 % et TVA : ${Math.round(current)} % aujourd’hui${projected===null?"":`, ${Math.round(projected)} % après encaissement hypothétique`}`}>
  <figcaption className="mb-2 flex items-center justify-between gap-2 text-[10px] text-ink-400 dark:text-white/40"><span>Réserve CSG 17,2 % + TVA</span>{next?<span className="tabular-nums">{next.kind==="estimate"?"Facture estimée":"Facture attendue"} · {money(next.amountHt)} HT</span>:null}</figcaption>
  <div className="space-y-2.5">{rows.map(row=><div key={row.label} className="flex items-center gap-3"><span className="w-28 shrink-0 text-[10px] text-ink-500 dark:text-white/50">{row.label}</span><div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/5"><div className={`h-full rounded-full ${row.value>=100?"bg-emerald-500":row.projected?"bg-sky-400":"bg-amber-400"}`} style={{width:`${row.value}%`}}/></div><span className="w-9 text-right text-[11px] font-medium tabular-nums">{Math.round(row.value)} %</span></div>)}</div>
  {projected!==null?<p className="mt-2 text-[10px] text-ink-400 dark:text-white/35">Simulation après encaissement, TVA et réserve supplémentaire incluses.</p>:null}
 </figure>;
}

export function HouseholdBriefVisual({families}:{families:PiloteCompensation[]}){
 const visible=families.filter(f=>f.id!=="other"&&f.expenses>0);
 if(!visible.length)return null;
 return <figure className="mt-4" aria-label="Part des dépenses couverte par les compensations, famille par famille">
  <figcaption className="mb-3 text-[10px] text-ink-400 dark:text-white/40">Vos dépenses sont-elles compensées ?</figcaption>
  <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{visible.map(family=>{
   const Icon=familyIcons[family.id],value=percent(family.income/family.expenses*100);
   return <div key={family.id} aria-label={`${family.name} : ${Math.round(value)} % couverts ; ${family.balance<0?`${money(-family.balance)} à financer`:`${money(family.balance)} de marge`}`}><div className="flex items-center gap-2"><Icon size={13} strokeWidth={1.6} className="shrink-0 text-ink-400 dark:text-white/45" aria-hidden="true"/><span className="min-w-0 flex-1 text-[11px]">{family.name}</span><span className={`text-[10px] tabular-nums ${family.balance<0?"text-amber-600 dark:text-amber-300":"text-emerald-600 dark:text-emerald-300"}`}>{Math.round(value)} %</span></div><div aria-hidden="true" className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/5"><div className={`h-full rounded-full ${family.balance<0?"bg-amber-400":"bg-emerald-500"}`} style={{width:`${value}%`}}/></div><p className="mt-1 text-[10px] text-ink-400 dark:text-white/40">{family.balance<0?`${money(-family.balance)} à financer`:`${money(family.balance)} de marge`}</p></div>;
  })}</div>
 </figure>;
}
