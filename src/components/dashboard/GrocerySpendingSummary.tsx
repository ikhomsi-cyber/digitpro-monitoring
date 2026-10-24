"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { groceryOrderSummary } from "@/lib/groceries/stats";
import type { groceryInsights } from "@/lib/groceries/insights";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";

const currency=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"});

export function GrocerySpendingSummary({stats,insights,periodLabel,merchant}:{
 stats:ReturnType<typeof groceryOrderSummary>;
 insights:ReturnType<typeof groceryInsights>;
 periodLabel:string;
 merchant:string;
}){
 const fmt=useDashboardDisplayFormat();
 const money=(cents:number)=>fmt.dummy?fmt.euro(cents/100):currency.format(cents/100);
 const comparison=insights.comparison;
 const average=stats.pricedOrderCount?Math.round(stats.totalCents/stats.pricedOrderCount):null;
 return <section aria-label="Résumé des dépenses alimentaires" className="relative overflow-hidden rounded-2xl border border-ink-200/50 bg-gradient-to-br from-white via-white to-emerald-50/40 px-5 py-5 sm:px-7 sm:py-6 dark:border-white/[.07] dark:from-white/[.035] dark:via-white/[.015] dark:to-emerald-400/[.025]">
  <div className="flex items-center justify-between gap-3"><h3 className="text-[10px] font-medium uppercase tracking-[.18em] text-ink-500 dark:text-white/45">Dépenses alimentaires</h3><span className="truncate text-[11px] capitalize text-ink-500 dark:text-white/45">{periodLabel}</span></div>
  <div className="py-5 text-center sm:py-6">
   <p className="text-[42px] font-medium leading-none tracking-[-.055em] text-ink-900 sm:text-[52px] dark:text-white tabular-nums">{stats.orderCount&&!stats.pricedOrderCount?"—":money(stats.totalCents)}</p>
   <p className="mt-2 text-[11px] text-ink-500 dark:text-white/45">{merchant==="all"?"Toutes les enseignes":merchant}</p>
   {comparison?<div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1"><span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-medium tabular-nums ${comparison.percent>0?"bg-amber-500/[.08] text-amber-700 dark:text-amber-300":"bg-emerald-500/[.08] text-emerald-700 dark:text-emerald-300"}`}>{comparison.percent>0?<ArrowUpRight size={12}/>:<ArrowDownRight size={12}/>} {fmt.dummy?"••":Math.abs(comparison.percent).toLocaleString("fr-FR",{maximumFractionDigits:1})} %</span><span className="text-[10px] text-ink-500 dark:text-white/40">par rapport {comparison.label}{comparison.throughDay?", à date identique":""}</span></div>:null}
  </div>
  <dl className="grid grid-cols-3 divide-x divide-ink-200/40 border-t border-ink-200/40 pt-4 text-center dark:divide-white/[.07] dark:border-white/[.07]">
   {[{label:"Achats",value:fmt.int(stats.orderCount)},{label:"Panier moyen",value:average===null?"—":money(average)},{label:"Entre deux achats",value:insights.averageGapDays===null?"—":`${fmt.dummy?"••":insights.averageGapDays.toLocaleString("fr-FR",{maximumFractionDigits:1})} j`}].map(item=><div key={item.label} className="min-w-0 px-1"><dt className="text-[9px] text-ink-500 sm:text-[10px] dark:text-white/40">{item.label}</dt><dd className="mt-1 text-sm font-medium tabular-nums text-ink-800 sm:text-base dark:text-white/85">{item.value}</dd></div>)}
  </dl>
 </section>;
}
