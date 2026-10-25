"use client";
import { Wallet } from "lucide-react";
import { pilotePocketTotals } from "@/lib/pilote-pocket";
import type { PiloteCompensation } from "@/lib/pilote";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";
export function PilotePocketSummary({families,hero=false,periodLabel}:{families:PiloteCompensation[];hero?:boolean;periodLabel?:string}){
 const fmt=useDashboardDisplayFormat();
 const {expenseCents,coveredCents,remainingCents}=pilotePocketTotals(families);
 const remaining=families.filter(f=>Math.round(f.expenses*100)>Math.round(f.income*100));
 const percent=expenseCents?coveredCents/expenseCents*100:100;
 return <section className={hero?"border-b border-ink-200/50 pb-4 dark:border-white/10":"py-2"} aria-label="Dépenses non compensées à votre charge">
  {hero?<div className="flex flex-col items-center pb-4 pt-2 text-center sm:pb-5 sm:pt-3"><p className="text-sm font-medium text-ink-500 dark:text-white/55">De votre poche · non compensé</p><p className={`mt-2 font-display text-4xl font-bold tabular-nums tracking-apple-tight sm:text-5xl ${remainingCents?"text-red-600 dark:text-red-400":"text-ink-900 dark:text-white"}`}>{fmt.euro(-remainingCents/100)}</p>{periodLabel?<p className="mt-2 text-xs capitalize text-ink-400 dark:text-white/45">{periodLabel}</p>:null}</div>:(
  <div className="flex items-center gap-4 sm:gap-6">
   <div aria-hidden="true" className="grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{background:`conic-gradient(#0071e3 ${fmt.dummy?60:percent}%, #f59e0b ${fmt.dummy?60:percent}% 100%)`}}><div className="grid h-16 w-16 place-items-center rounded-full bg-white dark:bg-ink-950"><Wallet size={23} strokeWidth={1.5} className="text-brand-500"/></div></div>
   <div className="min-w-0"><p className="text-xs font-medium text-ink-500 dark:text-white/55">De votre poche · non compensé</p><p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${remainingCents?"text-red-600 dark:text-red-400":"text-brand-600 dark:text-brand-300"}`}>{fmt.euro(-remainingCents/100)}</p><p className="mt-1.5 text-[11px] leading-relaxed text-ink-500 dark:text-white/50">{fmt.euro(expenseCents/100)} de dépenses − {fmt.euro(coveredCents/100)} compensés</p></div>
  </div>
  )}
  {remaining.length?<details className="mt-3 text-xs"><summary className="cursor-pointer text-ink-500 dark:text-white/55">Ce qui reste à financer</summary><dl className="mt-2 space-y-1.5">{remaining.map(f=><div key={f.id} className="flex justify-between gap-4"><dt>{f.name}</dt><dd className="tabular-nums">{fmt.euro((Math.round(f.expenses*100)-Math.round(f.income*100))/100)}</dd></div>)}</dl></details>:null}
  <p className="mt-3 text-[10px] leading-relaxed text-ink-400 dark:text-white/40">Selon les compensations suivies dans Pilote. Un excédent dans une famille ne réduit pas le reste à financer d’une autre. Ce montant n’est pas le solde bancaire.</p>
 </section>;
}
