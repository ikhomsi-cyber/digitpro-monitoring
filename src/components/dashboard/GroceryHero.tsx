"use client";
import {useDashboardDisplayFormat} from './DashboardDisplayFormatContext';
export function GroceryHero({totalCents,periodLabel,merchant,loading=false,unpriced=false}:{totalCents:number;periodLabel:string;merchant:string;loading?:boolean;unpriced?:boolean}){
 const fmt=useDashboardDisplayFormat();
 return <header className="border-b border-ink-200/50 pb-4 dark:border-white/10" aria-label="Bilan des courses">
  <div className="flex flex-col items-center pb-4 pt-2 text-center sm:pb-5 sm:pt-3">
   <h2 className="text-sm font-medium text-ink-500 dark:text-white/55">Vos courses</h2>
   <p aria-busy={loading} className="mt-2 font-display text-4xl font-bold tabular-nums tracking-apple-tight text-ink-900 sm:text-5xl dark:text-white">{loading||unpriced?'—':fmt.euro(totalCents/100)}</p>
   <p className="mt-2 text-xs capitalize text-ink-400 dark:text-white/45">{periodLabel}{merchant!=='all'?` · ${merchant}`:''}</p>
  </div>
 </header>;
}
