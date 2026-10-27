"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import { ChevronRight,Loader2,Plus,X } from "lucide-react";
import type { GroceryOrder } from "@/lib/groceries/parser";
import { groceryShoppingSuggestions,parisGroceryDay,type ShoppingSuggestion } from "@/lib/groceries/shopping-suggestions";
import { GroceryProductPresentation } from "./GroceryProductPresentation";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";
const currency=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"});
const dateLabel=(date:string)=>date.split("-").reverse().join("/");
export function GroceryShoppingList({demoMode,historyVersion}:{demoMode:boolean;historyVersion:number}){
 const fmt=useDashboardDisplayFormat();
 const [opened,setOpened]=useState(false),[orders,setOrders]=useState<GroceryOrder[]|null>(null),[truncated,setTruncated]=useState(false);
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[denied,setDenied]=useState(false),[reload,setReload]=useState(0);
 const [choices,setChoices]=useState<Record<string,"selected"|"stock"|"skip">>({});
 const [quantities,setQuantities]=useState<Record<string,string>>({});
 const [shown,setShown]=useState(5);
 const [today,setToday]=useState(parisGroceryDay);
 const deniedRef=useRef(false);
 useEffect(()=>{const update=()=>setToday(parisGroceryDay());const timer=window.setInterval(update,60000);document.addEventListener("visibilitychange",update);return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",update);};},[]);
 useEffect(()=>{
  if(!opened||demoMode||fmt.dummy||deniedRef.current)return;
  const controller=new AbortController();setLoading(true);setError("");setOrders(null);setChoices({});setQuantities({});
  void fetch("/api/gmail/groceries?view=products&period=all",{cache:"no-store",signal:controller.signal}).then(async response=>{
   if(response.status===401||response.status===403){deniedRef.current=true;setDenied(true);throw new Error("Accès refusé. Reconnectez-vous puis rouvrez Courses ; aucun nouvel essai automatique.");}
   if(!response.ok)throw new Error("L’historique détaillé est indisponible. Réessayez plus tard.");
   const body=await response.json();if(controller.signal.aborted)return;
   setOrders(body.orders??[]);setTruncated(Boolean(body.truncated));
  }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Historique indisponible.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[opened,demoMode,fmt.dummy,historyVersion,reload]);
 const report=useMemo(()=>orders?groceryShoppingSuggestions(orders,today):null,[orders,today]);
 const selected=report?.suggestions.filter(item=>choices[item.key]==="selected")??[];
 const available=report?.suggestions.filter(item=>!choices[item.key])??[];
 const hidden=Object.values(choices).filter(value=>value!=="selected").length;
 const quantity=(item:ShoppingSuggestion)=>{const value=Number(quantities[item.key]??item.quantity);return Number.isFinite(value)&&value>0&&value<=1000?value:null;};
 const budget=selected.length&&selected.every(item=>quantity(item)!==null&&item.historicalUnitPriceCents!==null)?Math.round(selected.reduce((sum,item)=>sum+quantity(item)!*item.historicalUnitPriceCents!,0)):null;
 return <details aria-label="À prévoir aujourd’hui" onToggle={event=>{if(event.currentTarget.open)setOpened(true);}} className="group/shopping min-w-0 rounded-2xl border border-ink-200/50 bg-white/40 p-4 sm:p-5 dark:border-white/[.07] dark:bg-white/[.02]">
  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden"><div className="flex min-w-0 items-center gap-2.5"><ChevronRight size={16} aria-hidden="true" className="shrink-0 text-ink-400 transition-transform group-open/shopping:rotate-90"/><div><h3 className="text-sm font-semibold text-ink-900 dark:text-white">À prévoir aujourd’hui</h3><p className="mt-0.5 text-[10px] font-normal text-ink-500 dark:text-white/45">Carrefour · selon vos habitudes</p></div></div>{report&&!fmt.dummy&&!demoMode?<span className="shrink-0 text-[11px] text-ink-500 dark:text-white/50">{selected.length?`${selected.length} choisi(s)`:report.suggestions.length?`${report.suggestions.length} suggestion(s)`:"Aucune suggestion"}</span>:null}</summary>
  {demoMode||fmt.dummy?<p className="mt-4 text-xs text-ink-500">Suggestions indisponibles en mode démo ou masqué.</p>:null}
  {opened?<div className="mt-4 border-t border-ink-200/40 pt-3 dark:border-white/5">
   {loading?<p role="status" className="flex items-center gap-2 py-3 text-xs text-ink-500"><Loader2 size={14} className="animate-spin"/>Chargement des suggestions…</p>:null}
   {error?<p role="alert" className="py-3 text-xs text-amber-700 dark:text-amber-300">{error}{!denied?<button type="button" onClick={()=>setReload(value=>value+1)} className="ml-2 min-h-9 underline">Réessayer</button>:null}</p>:null}
   {report&&!loading&&!fmt.dummy&&!demoMode?<>
    {selected.length?<div className="mb-4 border-b border-ink-200/40 pb-3 dark:border-white/5"><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold">Ma liste · {selected.length}</h4>{budget!==null?<span className="text-[11px] tabular-nums">≈ {currency.format(budget/100)} <span className="text-ink-400">· prix historiques</span></span>:null}</div><ul className="divide-y divide-ink-200/30 dark:divide-white/5">{selected.map(item=><li key={item.key} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><GroceryProductPresentation name={item.name}/></div><button type="button" aria-label={`Retirer ${item.name}`} onClick={()=>setChoices(previous=>({...previous,[item.key]:"skip"}))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-white/5"><X size={14}/></button></div><label className="mt-2 flex items-center justify-end gap-2 text-[11px] text-ink-500 dark:text-white/55">Quantité à confirmer<input type="number" min="0.01" max="1000" step="any" inputMode="decimal" aria-label={`Quantité : ${item.name}`} value={quantities[item.key]??String(item.quantity)} onChange={event=>setQuantities(previous=>({...previous,[item.key]:event.target.value}))} className="min-h-9 w-16 rounded-lg border border-ink-200/50 bg-transparent px-2 tabular-nums dark:border-white/10"/></label>{quantity(item)===null?<p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">Quantité positive requise (maximum 1 000).</p>:null}</li>)}</ul></div>:null}
    {!report.recurringProducts?<p className="py-3 text-xs text-ink-500 dark:text-white/55">Pas encore assez d’achats répétés pour proposer une liste.</p>:!available.length?<p className="py-3 text-xs text-ink-500 dark:text-white/55">{report.suggestions.length?"Tout est examiné pour aujourd’hui.":"Aucun rachat suggéré aujourd’hui."}</p>:null}
    <ul className="divide-y divide-ink-200/30 dark:divide-white/5">{available.slice(0,shown).map(item=><li key={item.key} className="py-3 first:pt-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><GroceryProductPresentation name={item.name}/></div><div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`Ajouter ${item.name}`} onClick={()=>setChoices(previous=>({...previous,[item.key]:"selected"}))} className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"><Plus size={16}/></button><button type="button" aria-label={`Pas cette fois : ${item.name}`} onClick={()=>setChoices(previous=>({...previous,[item.key]:"skip"}))} className="grid h-9 w-9 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-white/5"><X size={14}/></button></div></div><details className="mt-2 text-[10px] leading-relaxed text-ink-500 dark:text-white/45"><summary className="min-h-7 cursor-pointer">Dernier achat {dateLabel(item.lastPurchase)} · rythme ≈ {item.intervalDays} j</summary><p className="mt-1">{item.purchaseDates} dates d’achat · dernier achat il y a {item.daysSincePurchase} jours.{item.confidence==="limited"?" Repère encore fragile.":""} {item.historicalUnitPriceCents===null?"Prix historique inconnu.":`${currency.format(item.historicalUnitPriceCents/100)} / unité au dernier achat.`} Quantité observée : {item.quantity.toLocaleString("fr-FR")}.</p><button type="button" onClick={()=>setChoices(previous=>({...previous,[item.key]:"stock"}))} className="mt-1 min-h-8 underline">Déjà en stock</button></details></li>)}</ul>
    {available.length>shown?<button type="button" onClick={()=>setShown(value=>value+5)} className="min-h-9 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Voir plus ({available.length-shown})</button>:null}
    <div className="mt-2 flex flex-wrap items-start justify-between gap-2 border-t border-ink-200/30 pt-2 dark:border-white/5"><details className="min-w-0 flex-1 text-[10px] leading-relaxed text-ink-400 dark:text-white/40"><summary className="min-h-8 cursor-pointer">Comment ça marche ?</summary><p>Suggestions à confirmer selon vos stocks, sans commande envoyée. Au {dateLabel(today)}, heure de Paris : {report.detailedOrders} commandes Carrefour détaillées des 180 derniers jours, parmi les 500 dernières importées, indépendamment des filtres. Rythme médian sur au moins deux dates d’achat ; achats trop récents ou devenus anciens écartés. Prix historiques indicatifs, sans garantie de prix ou de disponibilité aujourd’hui. Choix gardés pendant cette consultation uniquement.{report.from?` Données du ${dateLabel(report.from)} au ${dateLabel(report.to!)}.`:""}{truncated?" Historique tronqué : des commandes plus anciennes ne sont pas analysées.":""}{report.totalSuggestions>30?` 30 suggestions prioritaires affichées sur ${report.totalSuggestions}.`:""} Des achats absents peuvent rendre la liste incomplète.</p></details>{Object.keys(choices).length?<button type="button" onClick={()=>{setChoices({});setQuantities({});setShown(5);}} className="min-h-8 text-[10px] text-ink-400 underline">Réinitialiser{hidden?` (${hidden})`:""}</button>:null}</div>
   </>:null}
  </div>:null}
 </details>;
}
