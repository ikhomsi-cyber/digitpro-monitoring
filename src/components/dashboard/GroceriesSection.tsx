"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { ShoppingBasket,Mail,Loader2,ChevronLeft,ChevronRight,X } from "lucide-react";
import { toast } from "sonner";
import { GroceryMerchantLogo } from "./GroceryMerchantLogo";
import { GrocerySpendingSummary } from "./GrocerySpendingSummary";
import { groceryInsights } from "@/lib/groceries/insights";
import { GroceryOverview } from "./GroceryOverview";
import { GmailAccountPicker } from "./GmailAccountPicker";
import { gmailOAuthErrorMessage } from "@/lib/gmail/oauth-errors";
import { getGmailConnectionStatus,getGmailConnectUrl,type GmailConnectionStatus } from "@/app/dashboard/gmail-actions";
import type { GmailAccount } from "@/lib/gmail/accounts";
import type { StoredGroceryOrder } from "@/lib/groceries/store";
import { groceryOrderSummary } from "@/lib/groceries/stats";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";
import { useDashboardSection } from "./DashboardSectionContext";
import { dashboardPanelTitle,dashboardPanelSub } from "@/lib/dashboard-surfaces";
const groceryEuro = new Intl.NumberFormat("fr-FR", {style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2});
export function GroceriesSection({demoMode}:{demoMode:boolean}){
 const fmt=useDashboardDisplayFormat();const {searchParams}=useDashboardSection();
 const [orders,setOrders]=useState<StoredGroceryOrder[]>([]),[connection,setConnection]=useState<GmailConnectionStatus|null>(null);
 const [account,setAccount]=useState<GmailAccount>(searchParams.get("gmail_account")==="primary"?"primary":"secondary");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(!demoMode),[error,setError]=useState(""),[status,setStatus]=useState("");
 const [period,setPeriod]=useState(""),[merchant,setMerchant]=useState("all");
 const [shownTransactions,setShownTransactions]=useState(20);
 const [periodMode,setPeriodMode]=useState<"month"|"year"|"all">("month");
 const [cursor,setCursor]=useState<{account:GmailAccount;token:string}|null>(null),[truncated,setTruncated]=useState(false);
 const [bankinWarning,setBankinWarning]=useState("");
 useEffect(()=>{if(searchParams.get("gmail_connect")==="error")setError(gmailOAuthErrorMessage(searchParams.get("gmail_error")));if(searchParams.get("gmail_connect")==="ok")setStatus("Compte Gmail connecté. Vous pouvez importer vos commandes alimentaires.");},[searchParams]);
 const refresh=useCallback(async()=>{
  const response=await fetch("/api/gmail/groceries",{cache:"no-store"});const body=await response.json();
  if(!response.ok)throw new Error(body.error??"Suivi des courses indisponible.");
  setOrders(body.orders??[]);setTruncated(Boolean(body.truncated));setError("");
  setBankinWarning(body.warning??(body.bankinTruncated?"Historique Bankin limité aux 25 000 paiements alimentaires les plus récents.":""));
 },[]);
 useEffect(()=>{let alive=true;if(!demoMode){setLoading(true);void refresh().catch(error=>{if(alive)setError(error.message);}).finally(()=>{if(alive)setLoading(false);});void getGmailConnectionStatus().then(value=>{if(alive)setConnection(value);}).catch(()=>{ /* Connection status must not hide already imported orders. */ });}return()=>{alive=false;};},[demoMode,refresh]);
 const connect=async(selected:GmailAccount)=>{if(busy||demoMode)return;setBusy(true);try{const {url}=await getGmailConnectUrl("courses",selected);window.location.assign(url);}catch(error){toast.error(error instanceof Error?error.message:"Connexion impossible.");setBusy(false);}};
 const sync=async(older=false)=>{
  if(busy||demoMode)return;setBusy(true);setError("");setStatus("Recherche des commandes confirmées et de leurs produits…");
  try{
   const fresh=await getGmailConnectionStatus();setConnection(fresh);
   if(!fresh.configured)throw new Error("Gmail n’est pas configuré.");
   if(!fresh.accounts?.find(value=>value.id===account)?.connected){const {url}=await getGmailConnectUrl("courses",account);window.location.assign(url);return;}
   const response=await fetch("/api/gmail/groceries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account,...(older&&cursor?.account===account?{pageToken:cursor.token}:{})})});
   const result=await response.json();if(!response.ok)throw new Error(result.error??"Import impossible.");
   setCursor(result.nextPageToken?{account,token:result.nextPageToken}:null);
   const message=`${result.saved} commande(s) ajoutée(s) ou enrichie(s) · ${result.scanned} email(s) examinés.${result.missingDetails?` ${result.missingDetails} confirmation(s) sans produits reconnus : détail à vérifier.`:""}`;
   setStatus(message);toast.success("Commandes synchronisées");await refresh();
  }catch(error){const message=error instanceof Error?error.message:"Import impossible.";setError(message);setStatus("");toast.error(message);}finally{setBusy(false);}
 };
 const months=useMemo(()=>[...new Set(orders.map(order=>order.date.slice(0,7)))].sort().reverse(),[orders]);const merchants=useMemo(()=>[...new Set(orders.map(order=>order.merchant))].sort(),[orders]);
 const selectedMonth=months.includes(period)?period:months[0]??"";
 const selectedYear=selectedMonth.slice(0,4);
 const years=[...new Set(months.map(month=>month.slice(0,4)))];
 const periods=periodMode==="year"?years:months;
 const periodIndex=periods.indexOf(periodMode==="year"?selectedYear:selectedMonth);
 const periodLabel=selectedMonth?periodMode==="year"?selectedYear:new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${selectedMonth}-01T12:00:00Z`)):"Aucune donnée";
 const movePeriod=(index:number)=>{const next=periods[index];if(!next)return;setPeriod(periodMode==="year"?months.find(month=>month.startsWith(next))!:next);};
 const changePeriodMode=(mode:"month"|"year"|"all")=>{setPeriodMode(mode);};
 const periodOrders=useMemo(()=>orders.filter(order=>periodMode==="all"||order.date.startsWith(periodMode==="year"?selectedYear:selectedMonth)),[orders,periodMode,selectedYear,selectedMonth]);
 const filtered=useMemo(()=>periodOrders.filter(order=>merchant==="all"||order.merchant===merchant),[periodOrders,merchant]);
 useEffect(()=>setShownTransactions(20),[merchant,periodMode,selectedYear,selectedMonth]);
 const stats=useMemo(()=>groceryOrderSummary(filtered),[filtered]);
 const history=useMemo(()=>orders.filter(order=>merchant==="all"||order.merchant===merchant),[orders,merchant]);
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Paris"}).format(new Date());
 const overviewInsights=useMemo(()=>groceryInsights(filtered,history,selectedMonth,periodMode,today,false),[filtered,history,selectedMonth,periodMode,today]);
 const merchantTotals=useMemo(()=>{
  const totals=new Map<string,{name:string;totalCents:number;count:number}>();
  for(const order of periodOrders){const total=totals.get(order.merchant)??{name:order.merchant,totalCents:0,count:0};total.totalCents+=order.totalCents??0;total.count++;totals.set(order.merchant,total);}
  return [...totals.values()].sort((a,b)=>b.totalCents-a.totalCents);
 },[periodOrders]);
 const euro=(cents:number)=>fmt.dummy?fmt.euro(cents/100):groceryEuro.format(cents/100);
 return <section className="space-y-4 pb-28 md:pb-8" aria-label="Courses · achats alimentaires">
  <div className="border-b border-ink-200/50 pb-3 dark:border-white/10"><h2 className={dashboardPanelTitle}>Courses</h2><p className={`mt-0.5 ${dashboardPanelSub}`}>Vos achats alimentaires · Gmail et Bankin</p></div>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div className="inline-flex rounded-full bg-ink-100/70 p-0.5 dark:bg-white/[0.06]" role="group" aria-label="Période des courses">{([{value:"month",label:"Mois"},{value:"year",label:"Année entière"}] as const).map(mode=><button key={mode.value} type="button" aria-pressed={periodMode===mode.value} onClick={()=>changePeriodMode(mode.value)} className={`min-h-9 rounded-full px-3.5 text-[11px] font-medium transition ${periodMode===mode.value?"bg-white text-ink-900 shadow-sm dark:bg-white/15 dark:text-white":"text-ink-500 dark:text-white/55"}`}>{mode.label}</button>)}</div>
   {periodMode!=="all"?<div className="flex items-center gap-1"><button type="button" aria-label={periodMode==="year"?"Année précédente":"Mois précédent"} disabled={periodIndex<0||periodIndex>=periods.length-1} onClick={()=>movePeriod(periodIndex+1)} className="grid h-9 w-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100/80 disabled:opacity-25 dark:text-white/45 dark:hover:bg-white/[0.06]"><ChevronLeft size={16}/></button><span className="text-sm font-medium capitalize text-ink-700 dark:text-white/75" aria-live="polite">{periodLabel}</span><button type="button" aria-label={periodMode==="year"?"Année suivante":"Mois suivant"} disabled={periodIndex<=0} onClick={()=>movePeriod(periodIndex-1)} className="grid h-9 w-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100/80 disabled:opacity-25 dark:text-white/45 dark:hover:bg-white/[0.06]"><ChevronRight size={16}/></button></div>:<span className="text-xs text-ink-500 dark:text-white/60">Tout l’historique importé</span>}
  </div>
  {!loading?<GrocerySpendingSummary stats={stats} insights={overviewInsights} periodLabel={periodMode==="all"?"Tout l’historique":periodLabel} merchant={merchant}/>:null}
  {merchantTotals.length?<section aria-label="Dépenses par enseigne" className="border-y border-ink-200/50 py-4 dark:border-white/[.07]"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xs font-medium text-ink-500 dark:text-white/50">Vos enseignes</h3><label className="flex min-w-0 items-center gap-2 text-[11px] text-ink-500 dark:text-white/50"><GroceryMerchantLogo merchant={merchant}/>Enseigne<select aria-label="Enseigne" value={merchant} onChange={event=>{setMerchant(event.target.value);}} className="min-h-9 min-w-0 rounded-xl border border-ink-200/50 bg-transparent px-2 text-xs text-ink-700 dark:border-white/10 dark:text-white/75 [&>option]:bg-white dark:[&>option]:bg-slate-950"><option value="all">Toutes</option>{merchants.map(value=><option key={value}>{value}</option>)}</select></label><button type="button" aria-pressed={periodMode==="all"} onClick={()=>changePeriodMode(periodMode==="all"?"month":"all")} className={`min-h-9 shrink-0 rounded-full px-3 text-[11px] font-medium transition ${periodMode==="all"?"bg-white/10 text-emerald-500":"text-ink-500 hover:bg-ink-100 dark:text-white/50 dark:hover:bg-white/5"}`}>Tout l’historique</button></div><div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">{merchantTotals.map(total=><button key={total.name} type="button" aria-pressed={merchant===total.name} onClick={()=>{setMerchant(merchant===total.name?"all":total.name);}} className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-3 text-left transition hover:bg-ink-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:bg-white/[.03]"><GroceryMerchantLogo merchant={total.name}/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{total.name}</span><span className="mt-0.5 block text-[10px] text-ink-500 dark:text-white/45">{fmt.int(total.count)} achat(s)</span></span><span className="shrink-0 text-xs font-medium tabular-nums">{euro(total.totalCents)}</span></button>)}</div></section>:null}
  {merchant==="Autre enseigne · Bankin"?<section aria-label="Transactions des autres enseignes" className="rounded-2xl border border-ink-200/50 p-4 dark:border-white/[.07]">
   <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Autres enseignes · transactions</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-white/50">{fmt.int(filtered.length)} transaction(s) · {periodMode==="all"?"Tout l’historique":periodLabel}</p></div><button type="button" onClick={()=>setMerchant("all")} aria-label="Fermer la liste des transactions" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:bg-white/5"><X size={16}/></button></div>
   <ul className="mt-3 divide-y divide-ink-200/40 dark:divide-white/5">{filtered.slice(0,shownTransactions).map(order=><li key={order.id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="break-words text-xs font-medium text-ink-800 dark:text-white/85">{fmt.dummy?"Transaction alimentaire":order.bankLabel??order.orderRef}</p><time dateTime={order.date} className="mt-1 block text-[11px] text-ink-500 dark:text-white/45">{order.date.split("-").reverse().join("/")}</time></div><span className="shrink-0 text-xs font-medium tabular-nums">{order.totalCents===null?"—":euro(order.totalCents)}</span></li>)}</ul>
   {!filtered.length?<p className="py-4 text-xs text-ink-500">Aucune transaction pour cette période.</p>:null}
   {filtered.length>shownTransactions?<button type="button" onClick={()=>setShownTransactions(value=>value+20)} className="mt-3 min-h-9 text-xs font-medium text-emerald-600 dark:text-emerald-400">Voir plus de transactions</button>:null}
  </section>:null}
  {bankinWarning?<p role="alert" className="text-xs text-amber-600">{bankinWarning}</p>:null}

  {loading?<p role="status" className="text-sm text-ink-500">Chargement des commandes…</p>:null}


  {orders.length&&!loading?<GroceryOverview orders={filtered} insights={overviewInsights} month={selectedMonth} mode={periodMode} onSelectMonth={month=>{setPeriod(month);changePeriodMode("month");}}/>:null}
  {stats.pricedOrderCount<stats.orderCount?<p className="text-xs text-ink-500">{stats.orderCount-stats.pricedOrderCount} commande(s) sans total reconnu, exclues du montant et du panier moyen.</p>:null}
  {truncated?<p className="text-xs text-amber-600">Affichage limité aux 500 commandes les plus récentes.</p>:null}
  {!orders.length&&!loading?<div className="rounded-3xl border border-dashed border-emerald-400/30 p-8 text-center"><ShoppingBasket size={32} className="mx-auto mb-4 text-emerald-400"/><h3 className="font-semibold">Votre premier panier commence ici</h3><p className="mx-auto mt-2 max-w-lg text-sm text-ink-500 dark:text-white/55">Connectez le Gmail de vos courses et importez vos confirmations Carrefour, Auchan et autres enseignes compatibles. Les produits reconnus alimenteront votre historique de prix.</p></div>:null}
  <section aria-label="Sources et imports Cours" className="space-y-3 border-t border-ink-200/50 pt-5 dark:border-white/[.07]">
   <div><h3 className="text-sm font-semibold text-ink-900 dark:text-white">Sources et imports</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-white/45">Le compte Gmail qui reçoit vos confirmations de courses.</p></div>
   <GmailAccountPicker compact status={connection} value={account} onChange={value=>{setAccount(value);setCursor(null);}} onConnect={value=>void connect(value)} disabled={busy||demoMode}/>
   <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>void sync()} disabled={busy||demoMode||loading} aria-label="Importer les commandes Gmail" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50">{busy?<Loader2 size={15} className="animate-spin"/>:<Mail size={15}/>}{busy?"Import…":"Importer Gmail"}</button>
  {cursor?.account===account?<button type="button" disabled={busy} onClick={()=>void sync(true)} className="min-h-10 rounded-xl border border-ink-200/60 px-4 text-xs font-semibold disabled:opacity-50 dark:border-white/10">Importer les confirmations plus anciennes</button>:null}
   </div>
  {demoMode?<p className="text-sm text-ink-500">Import désactivé en mode démo.</p>:null}
  {error?<p role="alert" className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-500">{error}</p>:null}
  {status?<p role="status" className="text-xs text-ink-500 dark:text-white/60">{status}</p>:null}
  </section>
 </section>;
}
