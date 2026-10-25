"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRightLeft, BriefcaseBusiness, Gift, GraduationCap, House, Lightbulb, Loader2, Send, ReceiptText, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useDashboardSection } from "./DashboardSectionContext";
import { useDashboardDummyData } from "./DashboardDisplayFormatContext";
import { Logo } from "@/components/ui/Logo";
import { ActivityBriefVisual, HouseholdBriefVisual, TreasuryBriefVisual } from "./DailyBriefVisuals";
import type { HouseholdYearComparison } from "@/lib/daily-brief-household";
import type { DailyBrief } from "@/lib/daily-financial-brief";
type Brief=DailyBrief & {qontoBalance:number|null;householdHistory:HouseholdYearComparison[]};
const money=(n:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function DailyFinancialAssistant({userId,demoMode}:{userId:string;demoMode:boolean}){
 const {section,piloteExpenseViews}=useDashboardSection();
 const viewsKey=piloteExpenseViews.join(",");
 const masked=useDashboardDummyData();const dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false),[brief,setBrief]=useState<Brief|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 const [question,setQuestion]=useState("");
 const [conversation,setConversation]=useState<{role:"user"|"assistant";content:string}[]>([]);
 const [asking,setAsking]=useState(false),[questionError,setQuestionError]=useState("");
 const conversationScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{conversationScroll.current?.scrollTo({top:0});},[conversation]);
 const questionRequest=useRef<AbortController|null>(null);
 const closingAnimation=useRef<Animation|null>(null);
 const pending=useRef<AbortController|null>(null);const lastDate=useRef("");
 const load=useCallback(async()=>{
  pending.current?.abort();const controller=new AbortController();pending.current=controller;
  setLoading(true);setError("");
  try{const response=await fetch(`/api/dashboard/daily-brief?views=${encodeURIComponent(viewsKey)}`,{cache:"no-store",signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error||"Point quotidien indisponible.");if(!controller.signal.aborted){setBrief(body);lastDate.current=body.date;}}
  catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:"Point quotidien indisponible.");}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[viewsKey]);
 useEffect(()=>{lastDate.current="";questionRequest.current?.abort();setAsking(false);setConversation([]);setQuestionError("");if(open&&!masked)void load();},[viewsKey,load]);
 const show=useCallback(()=>{closingAnimation.current?.cancel();closingAnimation.current=null;setOpen(true);if(lastDate.current!==today())void load();},[load]);
 useEffect(()=>{
  if(demoMode||masked||section==="courses")return;
  const check=()=>{if(document.visibilityState!=="visible"||open)return;try{if(localStorage.getItem(`digitpro:daily-brief:v2:${userId}`)!==today())show();}catch{show();}};
  const timer=window.setTimeout(check,900);document.addEventListener("visibilitychange",check);
  return()=>{clearTimeout(timer);document.removeEventListener("visibilitychange",check);};
 },[demoMode,masked,userId,show,section,open]);
 useEffect(()=>{
  const panel=dialog.current;if(!panel)return;
  if(!open||masked){closingAnimation.current?.cancel();panel.close();return;}
  if(!panel.open)panel.showModal();
  const previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  const animation=!window.matchMedia("(prefers-reduced-motion: reduce)").matches?panel.animate?.([{transform:"translateY(100%)"},{transform:"translateY(0)"}],{duration:300,easing:"cubic-bezier(0.22, 1, 0.36, 1)"}):undefined;
  return()=>{animation?.cancel();document.body.style.overflow=previousOverflow;};
 },[open,masked]);
 useEffect(()=>()=>{pending.current?.abort();questionRequest.current?.abort();closingAnimation.current?.cancel();},[]);
 const ask=async(event:React.FormEvent)=>{
  event.preventDefault();const text=question.trim();if(text.length<2||asking||masked)return;
  const controller=new AbortController();questionRequest.current=controller;
  const history=conversation.slice(-6).map(message=>({...message,content:message.content.slice(0,4000)}));
  setAsking(true);setQuestionError("");setQuestion("");setConversation(previous=>[...previous,{role:"user" as const,content:text}].slice(-7));
  try{
   const response=await fetch("/api/dashboard/daily-brief/question",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:controller.signal,body:JSON.stringify({question:text,history,views:piloteExpenseViews})});
   const body=await response.json();if(!response.ok)throw new Error(body.error??"Analyse indisponible.");
   if(!controller.signal.aborted)setConversation(previous=>[...previous,{role:"assistant" as const,content:String(body.answer)}].slice(-6));
  }catch(error){if(!controller.signal.aborted){setQuestionError(error instanceof Error?error.message:"Analyse indisponible.");setQuestion(text);setConversation(previous=>previous.at(-1)?.content===text?previous.slice(0,-1):previous);}}
  finally{if(!controller.signal.aborted)setAsking(false);}
 };
 const close=()=>{
  const panel=dialog.current;
  if(panel?.open&&panel.animate&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   closingAnimation.current?.cancel();
   const animation=panel.animate([{transform:"translateY(0)"},{transform:"translateY(100%)"}],{duration:250,easing:"ease-in",fill:"forwards"});closingAnimation.current=animation;
   void animation.finished.then(()=>{if(closingAnimation.current===animation){animation.cancel();closingAnimation.current=null;panel.close();setOpen(false);}}).catch(()=>{});
  }else setOpen(false);
  try{localStorage.setItem(`digitpro:daily-brief:v2:${userId}`,today());}catch{ /* Dismissal is optional; financial data is never persisted. */ }};
 if(demoMode)return null;
 const actions=brief?.items.filter(item=>item.priority!=="info")??[];
 const activity=brief?.activity;
 const pocket=brief?.householdHistory?.[0],previousPocket=brief?.householdHistory?.[1];
 const selectedActions=[actions.find(item=>item.scope==="pro"),actions.find(item=>item.scope==="foyer"),...actions].filter((item,index,all)=>item&&all.findIndex(other=>other?.id===item.id)===index).slice(0,3);
 return <>
  <button data-pull-refresh-ignore type="button" onClick={show} disabled={masked} aria-label="Ouvrir mon point quotidien" aria-haspopup="dialog" aria-expanded={open} title="Mon point quotidien" className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.6rem)] z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-200/80 bg-white/85 text-ink-700 shadow-sm backdrop-blur-xl transition hover:bg-white active:scale-95 disabled:opacity-40 dark:border-white/15 dark:bg-ink-950/85 dark:text-white md:right-5"><Sparkles size={19} strokeWidth={1.7}/></button>
  <dialog data-pull-refresh-ignore ref={dialog} onClick={event=>{if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientY<bounds.top||event.clientY>bounds.bottom||event.clientX<bounds.left||event.clientX>bounds.right)close();}} onCancel={event=>{event.preventDefault();close();}} aria-labelledby="daily-brief-title" className="daily-assistant-sheet fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[2rem] rounded-b-none border border-ink-200 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-950/55 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-ink-950 dark:text-white">
   {!masked?<div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-7"><div aria-hidden="true" className="mx-auto mb-5 h-1.5 w-11 rounded-full bg-ink-300/80 dark:bg-white/20"/>
    <header className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2.5"><Logo size={24} withWordmark={false}/><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[var(--app-accent-deep)] dark:text-[var(--app-accent)]">Votre point quotidien</p></div><h2 id="daily-brief-title" className="mt-2 text-xl font-semibold tracking-tight">Voici l’essentiel.</h2><p className="mt-1 text-xs text-ink-400 dark:text-white/40">{new Intl.DateTimeFormat("fr-FR",{dateStyle:"full",timeZone:"Europe/Paris"}).format(new Date())}</p></div><button autoFocus type="button" onClick={close} aria-label="Fermer le point quotidien" className="rounded-full p-2 hover:bg-ink-100 dark:hover:bg-white/10"><X size={18}/></button></header>
    <section className="mt-5" aria-label="Poser une question à votre assistant">
     <form onSubmit={event=>void ask(event)} className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-ink-50/70 p-2 focus-within:border-[var(--app-accent)] dark:border-white/15 dark:bg-white/5">
      <label htmlFor="daily-assistant-question" className="sr-only">Votre question</label><textarea id="daily-assistant-question" value={question} onChange={event=>setQuestion(event.target.value)} rows={2} maxLength={2000} placeholder="Posez votre question : ma trésorerie est-elle suffisante ?" disabled={asking} className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-ink-400 dark:placeholder:text-white/35"/>
      <button type="submit" disabled={asking||loading||question.trim().length<2} aria-label="Analyser ma question" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--app-accent)] text-white disabled:opacity-40">{asking?<Loader2 size={15} className="animate-spin"/>:<Send size={15}/>}</button>
     </form><p className="mt-1.5 text-[10px] text-ink-400 dark:text-white/40">Analyse par OpenAI · question, indicateurs et transactions catégorisées transmis, sans libellés bancaires ni identifiants.</p>
     <div className="mt-3 overflow-hidden rounded-2xl border border-ink-200/70 bg-white/50 dark:border-white/10 dark:bg-white/[0.025]">
      <div className="flex items-center justify-between gap-3 border-b border-ink-200/50 px-3 py-2 dark:border-white/10"><h3 className="text-xs font-medium">Vos échanges</h3><span className="text-[10px] text-ink-400">Plus récent en premier</span>{conversation.length?<button type="button" disabled={asking} onClick={()=>{setConversation([]);setQuestionError("");}} className="text-[10px] text-ink-400 underline disabled:opacity-40">Effacer</button>:null}</div>
      <div ref={conversationScroll} tabIndex={0} role="region" aria-label="Historique des questions et réponses" className="assistant-conversation-scroll h-56 overflow-y-scroll overscroll-contain p-3 sm:h-64">
       {!conversation.length?<p className="py-8 text-center text-xs leading-relaxed text-ink-400 dark:text-white/40">Posez votre question ci-dessus.<br/>Vos réponses apparaîtront dans cet espace.</p>:null}
       <div className="space-y-4">{conversation.map((message,index)=>({message,index})).filter(({message})=>message.role==="user").reverse().map(({message,index})=><article key={index} className="space-y-2 border-b border-ink-200/50 pb-4 last:border-0 last:pb-0 dark:border-white/10">
        <div className="rounded-xl bg-[var(--app-accent-soft)] px-3 py-2 text-xs"><p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-ink-400">Votre question</p><p className="whitespace-pre-wrap break-words">{message.content}</p></div>
        {conversation[index+1]?.role==="assistant"?<div className="px-1 py-1 text-sm leading-relaxed"><p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-[var(--app-accent)]">Assistant</p><p className="whitespace-pre-wrap break-words">{conversation[index+1].content}</p></div>:asking?<p role="status" className="flex items-center gap-2 px-1 py-2 text-xs text-ink-500 dark:text-white/50"><Loader2 size={13} className="animate-spin"/>J’analyse votre question…</p>:null}
       </article>)}</div>
      </div>
     </div>
     {questionError?<p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{questionError}</p>:null}
    </section>
    {loading?<div role="status" className="flex items-center gap-3 py-12 text-sm text-ink-500"><Loader2 size={17} className="animate-spin"/>Je fais le point sur votre activité…</div>:null}
    {error?<div role="alert" className="py-6 text-sm text-amber-700 dark:text-amber-300">{error}</div>:null}
    {brief&&!loading&&!error?<>
     <div className="mt-5 divide-y divide-ink-200/50 dark:divide-white/10">
      <section className="flex items-start gap-3 py-3"><BriefcaseBusiness size={17} className="mt-0.5 shrink-0 text-[var(--app-accent)]" aria-hidden="true"/><div className="min-w-0"><h3 className="text-xs font-semibold">Activité</h3><p className="mt-1 text-sm">{activity?.workedMonth==null?"Jours à compléter":`${activity.workedMonth} j réalisés${activity.plannedMonth?` · ${activity.plannedMonth} j planifiés`:""}`}</p><p className="mt-1 text-xs text-ink-500 dark:text-white/50">CA à ce jour{activity?.history[0]?.invoiceCount?" (factures Gmail + calendrier)":" généré"} : <strong className="font-semibold text-ink-900 dark:text-white">{activity?.generatedRevenueHt==null?"À compléter":`${money(activity.generatedRevenueHt)} HT`}</strong>{activity?.generatedChangePercent!=null?` · ${activity.generatedChangePercent>0?"+":""}${activity.generatedChangePercent.toLocaleString("fr-FR",{maximumFractionDigits:1})} % vs N−1`:""}</p>{activity?.history.slice(1,2).map(previous=><p key={previous.year} className="mt-1 text-xs text-ink-500 dark:text-white/50">À la même date en {previous.year} : {previous.generatedHt==null?"historique des jours / TJM à compléter":`${money(previous.generatedHt)} HT${previous.workedDays==null?"":` · ${previous.workedDays.toLocaleString("fr-FR")} j`}${previous.invoiceCount?` · factures Gmail${previous.invoiceEstimatedDays?" (jours estimés)":""}`:""}${activity.generatedRevenueHt!=null&&previous.generatedHt>0?` · ${activity.generatedRevenueHt>=previous.generatedHt?"+":""}${((activity.generatedRevenueHt-previous.generatedHt)/previous.generatedHt*100).toLocaleString("fr-FR",{maximumFractionDigits:1})} % en ${brief.date.slice(0,4)}`:""}`}</p>)}<p className="mt-1 text-xs text-ink-500 dark:text-white/50">Réellement encaissé : {activity?`${money(activity.yearRevenueHt)} HT cette année${activity.yearChangePercent==null?"":` · ${activity.yearChangePercent>0?"+":""}${activity.yearChangePercent.toLocaleString("fr-FR",{maximumFractionDigits:1})} % vs N−1`}`:"Indisponible"}</p><p className="mt-1 text-xs text-ink-500 dark:text-white/50">Dépenses pro à date : <strong className="font-semibold text-ink-900 dark:text-white">{activity?`${money(activity.yearExpensesHt)} HT`:"Indisponibles"}</strong>{activity?.previousYearExpensesHt!=null?` · ${activity.expenseChangePercent==null?"":`${activity.expenseChangePercent>0?"+":""}${activity.expenseChangePercent.toLocaleString("fr-FR",{maximumFractionDigits:1})} % · `}${money(activity.previousYearExpensesHt)} à la même date en ${Number(brief.date.slice(0,4))-1}`:" · comparatif à compléter"}</p></div></section>
      <section className="flex items-start gap-3 py-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-sky-500" aria-hidden="true"/><div className="min-w-0"><h3 className="text-xs font-semibold">Trésorerie · CSG 17,2 % + TVA</h3><p className="mt-1 text-sm">{activity?.treasury?activity.treasury.shortfall>0?`${money(activity.treasury.shortfall)} restent à sécuriser`:"Réserve couverte aujourd’hui":"Couverture à vérifier : données incomplètes"}</p>{activity?.nextInvoice?<p className="mt-0.5 text-xs text-ink-500 dark:text-white/50">Facture Gmail{activity.nextInvoice.reference?` ${activity.nextInvoice.reference}`:""} : {money(activity.nextInvoice.invoiceAmountHt)} HT · {money(activity.nextInvoice.invoiceAmountHt*1.2)} TTC{activity.nextInvoice.dueDate?` · échéance ${activity.nextInvoice.dueDate.split("-").reverse().join("/")}`:""}{activity.treasury?.projectedShortfall===0?` · encaissement intégral : réserve couverte, ${money(Math.max(0,activity.treasury?.projectedMargin??0))} de marge`:activity.treasury?.projectedShortfall!=null?` · encaissement intégral : encore ${money(activity.treasury.projectedShortfall)} à sécuriser`:""}</p>:null}</div></section>
      <section className="flex items-start gap-3 py-3"><ArrowRightLeft size={17} className="mt-0.5 shrink-0 text-ink-500 dark:text-white/60" aria-hidden="true"/><div className="min-w-0"><h3 className="text-xs font-semibold">Pro → Perso</h3><p className="mt-1 text-sm">{activity?.treasury?activity.treasury.availableTransferNow>0?`Tu peux envisager de te verser jusqu’à ${money(activity.treasury.availableTransferNow)} aujourd’hui`:`${money(0)} disponibles à verser après réserve` : "Montant à calculer : trésorerie complète manquante"}</p>{activity?.treasury?.availableTransferAfterInvoice!=null?<p className="mt-1 text-xs text-ink-500 dark:text-white/50">Après encaissement intégral de la facture Gmail : {money(activity.treasury.availableTransferAfterInvoice)} théoriquement disponibles.</p>:null}<p className="mt-1 text-[10px] leading-relaxed text-ink-400 dark:text-white/40">Après réserve CSG 17,2 % + TVA, hors IR, autres échéances et dépenses pro à venir. À vérifier avant un virement.</p></div></section>
      <section className="flex items-start gap-3 py-3"><House size={17} className="mt-0.5 shrink-0 text-[var(--app-accent)]" aria-hidden="true"/><div className="min-w-0"><h3 className="text-xs font-semibold">Foyer</h3><p className="mt-1 text-sm">{pocket?.monthOutOfPocket==null?"Reste à charge du mois à compléter":`${money(pocket.monthOutOfPocket)} de votre poche ce mois`}</p><p className="mt-0.5 text-xs text-ink-500 dark:text-white/50">{`Du 1er au ${Number(brief.date.slice(8,10))} · ${piloteExpenseViews.map(view=>({essential:"Essentiel",secondary:"Presque essentiel",travel:"Voyages"}[view])).join(" + ")||"Aucune vue"}`}{previousPocket?.monthOutOfPocket!=null?` · ${money(previousPocket.monthOutOfPocket)} sur les mêmes jours du mois en ${previousPocket.year}`:" · comparatif précédent indisponible"}</p></div></section>
     </div>
     {selectedActions.length?<section className="mt-4 border-t border-ink-200/50 pt-4 dark:border-white/10"><h3 className="text-[10px] font-medium uppercase tracking-wider text-ink-400 dark:text-white/40">À faire en priorité</h3><div className="mt-2 space-y-1">{selectedActions.map((item,index)=>item?<details key={item.id} className="py-1.5"><summary className="cursor-pointer text-xs font-medium"><span className="mr-1.5 text-ink-400">{index+1}.</span>{item.title}</summary><p className="mt-2 text-xs leading-relaxed text-ink-500 dark:text-white/55">{item.detail}</p><a href={item.href} onClick={close} className="mt-2 inline-flex items-center gap-1 text-[10px] text-[var(--app-accent-deep)] dark:text-[var(--app-accent)]">{item.when} · Ouvrir<ArrowUpRight size={11}/></a></details>:null)}</div></section>:null}
     <details className="group/insights mt-5 rounded-3xl border border-ink-200/60 bg-ink-50/50 p-4 dark:border-white/10 dark:bg-white/[.025]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span>Votre tableau de bord</span><span className="grid h-7 w-7 place-items-center rounded-full bg-white text-ink-400 transition-transform group-open/insights:rotate-90 dark:bg-white/5"><ArrowUpRight size={14}/></span></summary><p className="mt-1 text-[11px] text-ink-400 dark:text-white/40">Activité, réserve et équilibre du foyer</p><div className="mt-4 space-y-3">{activity?<><ActivityBriefVisual activity={activity} date={brief.date}/><TreasuryBriefVisual activity={activity}/></>:null}<HouseholdBriefVisual families={brief.compensations}/>{brief.householdHistory?.length?<div className="rounded-2xl border border-ink-200/50 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[.03]"><p className="mb-3 text-xs font-medium">De votre poche · comparaison à date</p>{brief.householdHistory.map(row=><p key={row.year} className="flex justify-between text-xs text-ink-500 dark:text-white/50"><span>{row.year}</span><span>{row.monthOutOfPocket==null?"Historique insuffisant":money(row.monthOutOfPocket)}</span></p>)}</div>:null}{pocket?.outOfPocket!=null?<p className="text-[10px] text-ink-400 dark:text-white/40">Pour mémoire, depuis janvier : {money(pocket.outOfPocket)} de reste à charge.</p>:null}</div></details>
     {brief.opportunities.length?<details className="mt-4 border-t border-ink-200/60 pt-4 dark:border-white/10"><summary className="cursor-pointer text-xs font-medium"><Lightbulb size={14} className="mr-2 inline-block text-amber-500" aria-hidden="true"/>Idées pour mieux gérer DigitPro</summary><div className="mt-4 space-y-4">{brief.opportunities.map(idea=><article key={idea.id}><a href={idea.href} onClick={close} className="inline-flex items-center gap-2 text-sm font-medium">{idea.id==="client-gifts"?<Gift size={14} className="text-ink-400" aria-hidden="true"/>:idea.id==="tools-training"?<GraduationCap size={14} className="text-ink-400" aria-hidden="true"/>:<ReceiptText size={14} className="text-ink-400" aria-hidden="true"/>}{idea.title}</a><p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-white/55">{idea.detail}</p></article>)}<p className="text-[11px] leading-relaxed text-ink-400 dark:text-white/40">Priorité aux frais réels déjà engagés et aux besoins utiles. Une dépense consomme de la trésorerie ; son traitement fiscal et la TVA sont à vérifier avec Hiway.</p><a href="https://www.impots.gouv.fr/professionnel/questions/que-puis-je-deduire-de-mes-resultats-professionnels" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-ink-400 underline">Conditions de déduction · impots.gouv.fr<ArrowUpRight size={10}/></a></div></details>:null}
    </>:null}
    <footer className="mt-5 flex items-center justify-between border-t border-ink-200/50 pt-4 dark:border-white/10"><button type="button" disabled={loading} onClick={()=>void load()} className="inline-flex items-center gap-1.5 text-xs text-ink-500 disabled:opacity-40 dark:text-white/50"><RefreshCw size={12}/>Actualiser</button><button type="button" onClick={close} className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink-900">C’est noté</button></footer>
   </div>:null}
  </dialog>
 </>;
}
