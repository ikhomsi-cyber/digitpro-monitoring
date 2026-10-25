"use client";

import { useMemo, useState } from "react";
import { ChevronRight, TrendingUp } from "lucide-react";
import type { GroceryOrder } from "@/lib/groceries/parser";
import { groceryInsights, groceryCategoryTotals, groceryCategoryProducts } from "@/lib/groceries/insights";
import { GroceryMerchantLogo } from "./GroceryMerchantLogo";
import { GroceryProductPresentation } from "./GroceryProductPresentation";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";

const panel="min-w-0 rounded-2xl border border-ink-200/50 bg-white/40 p-4 sm:p-5 dark:border-white/[.07] dark:bg-white/[.02]";
const muted="text-ink-500 dark:text-white/45";
const currency=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2});
const monthLabel=(month:string,long=false)=>new Intl.DateTimeFormat("fr-FR",{month:long?"long":"short",...(long?{year:"numeric"}:{}),timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`));

export function GroceryOverview({orders,insights,month,mode,onSelectMonth,productsLoading=false}:{productsLoading?:boolean;orders:GroceryOrder[];insights:ReturnType<typeof groceryInsights>;month:string;mode:"month"|"year"|"all";onSelectMonth:(month:string)=>void}){
 const fmt=useDashboardDisplayFormat();
 const carrefourOrders=useMemo(()=>orders.filter(order=>order.merchant.toLowerCase()==="carrefour"),[orders]);
 const carrefourInsights=useMemo(()=>groceryCategoryTotals(carrefourOrders),[carrefourOrders]);
 const money=(cents:number)=>fmt.dummy?fmt.euro(cents/100):currency.format(cents/100);
 const max=Math.max(...insights.series.map(point=>point.totalCents),1);
 const gradient=carrefourInsights.categories.map((category,index,list)=>{const start=list.slice(0,index).reduce((sum,item)=>sum+item.totalCents,0)/carrefourInsights.itemTotalCents*100;return `${category.color} ${start}% ${start+category.totalCents/carrefourInsights.itemTotalCents*100}%`;}).join(",");
 return <div className="space-y-4" aria-label="Vue d’ensemble des achats alimentaires">
  <section className={panel} aria-label="Évolution des dépenses de courses">
   <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-ink-900 dark:text-white">Évolution des dépenses</h3><p className={`mt-1 text-[11px] ${muted}`}>{mode==="year"?`Les 12 mois de ${month.slice(0,4)}`:"Évolution sur 12 mois"} · touchez un mois</p></div><span className="text-ink-400 dark:text-white/40"><TrendingUp size={16}/></span></div>
   <div className="mt-6 grid grid-cols-12 items-end gap-1.5 sm:gap-3" role="group" aria-label="Choisir un mois depuis le graphique">{insights.series.map((point,index)=>{const active=mode==="month"&&point.month===month;return <button key={point.month} type="button" onClick={()=>onSelectMonth(point.month)} disabled={!point.count} aria-pressed={active} aria-label={`${monthLabel(point.month,true)} : ${money(point.totalCents)}, ${fmt.int(point.count)} commande(s) importée(s)`} title={`${monthLabel(point.month,true)} · ${money(point.totalCents)} · ${fmt.int(point.count)} commande(s)`} className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-default"><div className="relative flex h-28 items-end justify-center border-b border-ink-200/50 dark:border-white/10"><div className={`w-full max-w-9 rounded-t-md transition-all duration-500 ${active?"bg-emerald-500":"bg-gradient-to-t from-emerald-700/20 to-emerald-400/50 group-hover:to-emerald-300/80 dark:from-emerald-500/10 dark:to-emerald-300/40"}`} style={{height:point.totalCents?`${Math.max(4,point.totalCents/max*100)}%`:"2px"}}/>{active?<span className="absolute -top-3 h-1 w-1 rounded-full bg-emerald-400"/>:null}</div><span className={`mt-2 block truncate text-[9px] ${active?"font-semibold text-emerald-600 dark:text-emerald-300":muted}`}>{index%2===0||active||index===11?monthLabel(point.month).replace(".",""):"·"}</span></button>;})}</div>
   <p className={`mt-3 text-[10px] ${muted}`}>Les mois vides n’ont aucune commande importée.</p>
  </section>

  <div className="space-y-4">
   <section className={panel}>
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><GroceryMerchantLogo merchant="Carrefour"/><div><h3 className="text-sm font-semibold text-ink-900 dark:text-white">Analyse des commandes Carrefour</h3><p className={`mt-1 text-[11px] ${muted}`}>Répartition par rayon · produits des commandes Gmail</p></div></div><div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{background:gradient?`conic-gradient(${gradient})`:"#64748b20"}} role="img" aria-label="Répartition par rayon, détaillée ci-dessous"><span className="grid h-12 w-12 place-items-center rounded-full bg-white text-xs font-semibold text-ink-700 dark:bg-[#0e3031] dark:text-white">{fmt.dummy?"••":productsLoading?"…":carrefourInsights.categories.length}</span></div></div>
    <div className="mt-5 divide-y divide-ink-200/40 dark:divide-white/5">{carrefourInsights.categories.map(category=><GroceryCategoryRow key={category.name} category={category} orders={carrefourOrders} totalCents={carrefourInsights.itemTotalCents}/>)}</div>
    {productsLoading?<p role="status" className={`mt-5 text-xs ${muted}`}>Chargement des produits de cette période…</p>:null}
    {!productsLoading&&!carrefourInsights.categories.length?<p className={`mt-5 text-xs ${muted}`}>Aucune commande Carrefour avec détail produit pour cette période.</p>:null}
    <p className={`mt-5 border-t border-ink-200/50 pt-3 text-[10px] leading-relaxed dark:border-white/10 ${muted}`}>Rayons estimés à partir des libellés. Prix des lignes avant frais et remises globales ; le total payé peut différer.</p>
   </section>

  </div>

 </div>;
}

function GroceryCategoryRow({category,orders,totalCents}:{category:{name:string;color:string;totalCents:number};orders:GroceryOrder[];totalCents:number}){
 const [open,setOpen]=useState(false);
 const fmt=useDashboardDisplayFormat();
 const products=useMemo(()=>open?groceryCategoryProducts(orders,category.name):[],[open,orders,category.name]);
 const money=(cents:number)=>fmt.dummy?fmt.euro(cents/100):currency.format(cents/100);
 return <details className="group/rayon py-3 first:pt-0 last:pb-0" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
   <div className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-ink-600 dark:text-white/75"><ChevronRight size={14} aria-hidden="true" className="shrink-0 text-ink-400 transition-transform group-open/rayon:rotate-90"/><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:category.color}}/>{category.name}</span><span className="shrink-0 font-medium tabular-nums text-ink-800 dark:text-white/85">{money(category.totalCents)}</span></div>
   <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/5"><div className="h-full rounded-full" style={{width:`${totalCents?category.totalCents/totalCents*100:0}%`,backgroundColor:category.color}}/></div>
  </summary>
  {open?<ul aria-label={`Produits : ${category.name}`} className="mt-3 divide-y divide-ink-200/30 rounded-xl bg-ink-50/60 px-3 dark:divide-white/5 dark:bg-white/[.025]">{products.map(product=><li key={product.key} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><GroceryProductPresentation name={product.name}/><p className="mt-1 text-[10px] text-ink-500 dark:text-white/45">{fmt.dummy?"••":product.quantity.toLocaleString("fr-FR",{maximumFractionDigits:3})} unité(s) commandée(s)</p></div><span className="shrink-0 text-xs font-medium tabular-nums text-ink-700 dark:text-white/75">{money(product.totalCents)}</span></li>)}</ul>:null}
 </details>;
}
