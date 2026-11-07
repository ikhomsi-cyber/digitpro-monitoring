"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent,type PointerEvent as ReactPointerEvent} from 'react';
import {ArrowDown,Check,Copy,Maximize2,Menu,Minimize2,Plus,RefreshCw,Sparkles,ThumbsDown,ThumbsUp,X} from 'lucide-react';
import {AssistantQuestionComposer} from './AssistantQuestionComposer';
import {AssistantAnswer} from './AssistantAnswer';
import {ASSISTANT_HOUSEHOLD_VIEWS} from '@/lib/assistant-household-views';
import type {DailyBrief} from '@/lib/daily-financial-brief';
import {useDashboardDummyData} from './DashboardDisplayFormatContext';
import {useOptionalDashboardSection} from './DashboardSectionContext';
type Message={id:string;role:'user'|'assistant';content:string};
const uid=()=>`${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const views=ASSISTANT_HOUSEHOLD_VIEWS.join(',');
export function AssistantChatSection({demoMode=false,initialMessages=[]}:{demoMode?:boolean;initialMessages?:Message[]}){
 const masked=useDashboardDummyData();
 const navigation=useOptionalDashboardSection();
 const drag=useRef<{id:number;y:number;offset:number}|null>(null);
 const [dragOffset,setDragOffset]=useState(0);
 const closeChat=()=>{setFull(false);setMenu(false);setDragOffset(0);navigation?.navigateWithinDashboard("/dashboard?section=pilote");};
 const dragStart=(event:ReactPointerEvent<HTMLElement>)=>{if(!event.isPrimary||event.button!==0||(event.target instanceof Element&&event.target.closest("button")))return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,y:event.clientY,offset:0};};
 const dragMove=(event:ReactPointerEvent<HTMLElement>)=>{if(drag.current?.id!==event.pointerId)return;drag.current.offset=Math.max(0,event.clientY-drag.current.y);setDragOffset(drag.current.offset);};
 const dragEnd=(event:ReactPointerEvent<HTMLElement>)=>{if(drag.current?.id!==event.pointerId)return;const dismiss=event.type!=="pointercancel"&&drag.current.offset>86;drag.current=null;setDragOffset(0);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(dismiss)closeChat();};
 const [messages,setMessages]=useState<Message[]>(initialMessages),[brief,setBrief]=useState<DailyBrief|null>(null),[loading,setLoading]=useState(false),[question,setQuestion]=useState(''),[asking,setAsking]=useState(false),[error,setError]=useState(''),[full,setFull]=useState(false),[menu,setMenu]=useState(false),[height,setHeight]=useState<number>(),[feedback,setFeedback]=useState<Record<string,'up'|'down'>>({}),[copied,setCopied]=useState<string|null>(null);
 const root=useRef<HTMLElement>(null),scroll=useRef<HTMLDivElement>(null),header=useRef<HTMLElement>(null),request=useRef<AbortController|null>(null),summaryRequest=useRef<AbortController|null>(null),followBottom=useRef(true);
 const [atBottom,setAtBottom]=useState(true);
 useEffect(()=>{
  const panel=scroll.current;if(!panel)return;
  let gesture:{start:number;x:number;offset:number;time:number}|null=null;
  const start=(event:TouchEvent)=>{
   if(event.touches.length!==1||panel.scrollTop>0||!(event.target instanceof Element)||event.target.closest('button,a,input,textarea,select,summary'))return;
   const touch=event.touches[0];gesture={start:touch.clientY,x:touch.clientX,offset:0,time:event.timeStamp};
  };
  const move=(event:TouchEvent)=>{
   if(!gesture||event.touches.length!==1)return;
   const touch=event.touches[0],dy=touch.clientY-gesture.start;
   if(dy<0||Math.abs(touch.clientX-gesture.x)>Math.max(10,dy)){gesture=null;setDragOffset(0);return;}
   if(dy>8){event.preventDefault();gesture.offset=dy;setDragOffset(dy);}
  };
  const end=(event:TouchEvent)=>{
   if(!gesture)return;const current=gesture;gesture=null;setDragOffset(0);
   if(event.type!=='touchcancel'&&(current.offset>86||(current.offset>20&&current.offset/Math.max(1,event.timeStamp-current.time)>.45)))closeChat();
  };
  panel.addEventListener('touchstart',start,{passive:true});panel.addEventListener('touchmove',move,{passive:false});panel.addEventListener('touchend',end);panel.addEventListener('touchcancel',end);
  return()=>{panel.removeEventListener('touchstart',start);panel.removeEventListener('touchmove',move);panel.removeEventListener('touchend',end);panel.removeEventListener('touchcancel',end);};
 },[navigation]);

 const loadBrief=useCallback(async()=>{
  if(demoMode||masked)return;
  summaryRequest.current?.abort();const controller=new AbortController();summaryRequest.current=controller;setLoading(true);setError('');
  try{const response=await fetch(`/api/dashboard/daily-brief?views=${encodeURIComponent(views)}`,{cache:'no-store',signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error??'Le récapitulatif est indisponible.');if(!controller.signal.aborted)setBrief(body);}
  catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Le récapitulatif est indisponible.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[demoMode,masked]);
 useEffect(()=>{void loadBrief();return ()=>{request.current?.abort();summaryRequest.current?.abort();};},[loadBrief]);
 useEffect(()=>{
  const measure=()=>{const viewport=window.visualViewport;const available=viewport?.height??window.innerHeight;const keyboard=window.innerHeight-available>120;const top=full?0:Math.max(0,root.current?.getBoundingClientRect().top??0);setHeight(Math.max(160,available-top-(full?0:keyboard?8:80)));};
  measure();window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);return ()=>{window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
 },[full]);
 useEffect(()=>{if(!full)return;const prior=document.body.style.overflow;document.body.style.overflow='hidden';const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setFull(false);};window.addEventListener('keydown',escape);return ()=>{document.body.style.overflow=prior;window.removeEventListener('keydown',escape);};},[full]);
 useEffect(()=>{if(!menu)return;const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!header.current?.contains(event.target))setMenu(false);};document.addEventListener('pointerdown',outside);return ()=>document.removeEventListener('pointerdown',outside);},[menu]);
 useEffect(()=>{if(followBottom.current)scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'auto'});},[messages,asking,brief,error]);
 const send=async(text:string,previousMessages=messages)=>{
  text=text.trim();if(text.length<2||asking||request.current||demoMode||masked)return;
  const controller=new AbortController();request.current=controller;const history=previousMessages.slice(-6).map(({role,content})=>({role,content:content.slice(0,4000)}));
  followBottom.current=true;setAsking(true);setError('');setQuestion('');setMessages([...previousMessages,{id:uid(),role:'user',content:text}]);
  try{const response=await fetch('/api/dashboard/daily-brief/question',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({question:text,history,views:ASSISTANT_HOUSEHOLD_VIEWS})});const body=await response.json();if(!response.ok)throw new Error(body.error??'L’analyse est indisponible.');if(!controller.signal.aborted)setMessages(previous=>[...previous,{id:uid(),role:'assistant',content:String(body.answer)}]);}
  catch(error){if(!controller.signal.aborted){setError(error instanceof Error?error.message:'L’analyse est indisponible.');setQuestion(text);setMessages(previous=>previous.at(-1)?.role==='user'&&previous.at(-1)?.content===text?previous.slice(0,-1):previous);}}
  finally{if(request.current===controller){request.current=null;setAsking(false);}}
 };
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void send(question);};
 const reset=()=>{request.current?.abort();request.current=null;setAsking(false);setMessages([]);setQuestion('');setError('');setFeedback({});setMenu(false);followBottom.current=true;};
 const copy=async(message:Message)=>{try{await navigator.clipboard.writeText(message.content);setCopied(message.id);window.setTimeout(()=>setCopied(null),2000);}catch{setError('Copie indisponible dans ce navigateur.');}};
 const recap=brief?`### Votre point du ${new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(new Date(`${brief.date}T12:00:00Z`))}\n\n${brief.summary.activity}\n\n### Trésorerie\n${brief.summary.treasury}\n\n### Votre foyer\n${brief.summary.household}`:null;
 return <section ref={root} data-pull-refresh-ignore aria-label="Assistant Chat pro et perso" style={{height,transform:dragOffset?`translateY(${dragOffset}px)`:undefined,transition:dragOffset?"none":"transform 200ms ease"}} className={`${full?'fixed inset-0 z-[110]':'relative h-[calc(100dvh-9rem)] min-h-0'} flex min-w-0 flex-col overflow-hidden rounded-[2rem] bg-[#f8f8fc] text-[#202a2d] dark:bg-[#092f38] dark:text-white`}>
  <header ref={header} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} className="touch-none select-none relative z-10 flex shrink-0 items-center gap-3 rounded-b-[2rem] bg-white px-4 py-4 shadow-[0_14px_35px_-24px_rgba(20,30,40,.35)] dark:bg-white/[.04]">
   <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-ink-300/60 dark:bg-white/20"/><button type="button" onClick={()=>setMenu(value=>!value)} aria-label="Options de la conversation" aria-expanded={menu} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-50 dark:bg-white/5">{menu?<X size={18}/>:<Menu size={18}/>}</button><div><h2 className="text-base font-semibold tracking-tight">Assistant</h2><p className="text-[10px] text-ink-400 dark:text-white/45">Pro & perso</p></div><button type="button" onClick={()=>setFull(value=>!value)} aria-label={full?'Réduire le chat':'Agrandir le chat'} className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-ink-50 dark:bg-white/5">{full?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
   {menu?<div className="absolute left-4 top-full mt-2 min-w-56 rounded-2xl border border-ink-200/70 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#103c45]"><button type="button" onClick={reset} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-xs hover:bg-ink-50 dark:hover:bg-white/5"><Plus size={15}/>Nouvelle conversation</button><button type="button" onClick={()=>{setMenu(false);void loadBrief();}} disabled={loading} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-xs hover:bg-ink-50 disabled:opacity-50 dark:hover:bg-white/5"><RefreshCw size={15}/>Actualiser le récapitulatif</button></div>:null}
  </header>
  <div ref={scroll} onPointerDown={event=>{if(event.pointerType==='mouse'&&event.currentTarget.scrollTop<=0&&event.target instanceof Element&&!event.target.closest('button,a,input,textarea,select,summary'))dragStart(event);}} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} onScroll={()=>{const element=scroll.current;if(element){const bottom=element.scrollHeight-element.scrollTop-element.clientHeight<70;followBottom.current=bottom;setAtBottom(bottom);}}} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-6 sm:px-6" aria-label="Messages de la conversation" role="log" aria-live="polite" aria-relevant="additions">
   {masked?<p className="text-sm text-ink-500 dark:text-white/55">Désactivez le masquage des montants pour utiliser le chat financier.</p>:<>
    <article className="pb-6"><div className="mb-5 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm dark:bg-white/10"><Sparkles size={17}/></span><span className="rounded-full bg-white px-4 py-2 text-xs font-semibold shadow-sm dark:bg-white/10">Récapitulatif</span></div>{loading&&!brief?<p role="status" className="text-sm text-ink-400">Préparation de votre point…</p>:recap?<AssistantAnswer text={recap}/>:<><h3 className="text-xl font-semibold tracking-tight">Parlons de vos finances.</h3><p className="mt-3 text-sm leading-7 text-ink-500 dark:text-white/60">Activité, trésorerie, dépenses du foyer ou investissements : posez votre question, simplement.</p>{demoMode?<p className="mt-3 text-xs text-ink-400">Mode démonstration · aucun appel d’analyse</p>:null}</>}</article>
    {!messages.length&&!asking?<div className="flex flex-wrap gap-2 pb-4">{['Comment va ma trésorerie ?','Que reste-t-il de ma poche ?','Fais le point sur mes investissements'].map(text=><button key={text} type="button" disabled={demoMode} onClick={()=>setQuestion(text)} className="rounded-2xl border border-ink-200/50 bg-white/60 px-3 py-2 text-left text-xs text-ink-600 transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">{text}</button>)}</div>:null}
    {messages.map(message=>message.role==='user'?<div key={message.id} className="mb-6 ml-auto max-w-[90%] rounded-[1.6rem] rounded-br-md bg-[#292731] px-5 py-3 text-sm leading-6 text-white dark:bg-white/15"><p className="whitespace-pre-wrap break-words">{message.content}</p></div>:<article key={message.id} className="mb-7"><div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm dark:bg-white/10"><Sparkles size={17}/></span><span className="text-xs font-semibold">DigitPro</span></div><AssistantAnswer text={message.content}/><div className="mt-4 flex gap-1 text-ink-400 dark:text-white/40">{([{value:'up',Icon:ThumbsUp,label:'Cette réponse m’aide'},{value:'down',Icon:ThumbsDown,label:'Cette réponse est à améliorer'}] as const).map(({value,Icon,label})=><button key={value} type="button" aria-label={label} aria-pressed={feedback[message.id]===value} onClick={()=>setFeedback(previous=>({...previous,[message.id]:value}))} className={`grid h-9 w-9 place-items-center rounded-full hover:bg-white dark:hover:bg-white/5 ${feedback[message.id]===value?'text-emerald-600 dark:text-emerald-300':''}`}><Icon size={16}/></button>)}{message===messages.at(-1)?<button type="button" disabled={asking||demoMode} onClick={()=>{const index=messages.findLastIndex(row=>row.role==='user');if(index>=0)void send(messages[index].content,messages.slice(0,index));}} aria-label="Reformuler la dernière réponse" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white disabled:opacity-30 dark:hover:bg-white/5"><RefreshCw size={16}/></button>:null}<button type="button" onClick={()=>void copy(message)} aria-label={copied===message.id?'Réponse copiée':'Copier la réponse'} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white dark:hover:bg-white/5">{copied===message.id?<Check size={16}/>:<Copy size={16}/>}</button></div></article>)}
    {asking?<div role="status" className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-3 text-xs font-medium shadow-sm dark:bg-white/10"><Sparkles size={16}/>Réflexion en cours<span className="flex gap-1" aria-hidden="true">{[0,1,2].map(index=><span key={index} className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" style={{animationDelay:`${index*150}ms`}}/>)}</span></div>:null}
   </>}
   {error?<p role="alert" className="mt-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-xs leading-6 text-amber-800 dark:text-amber-200">{error}</p>:null}
  </div>
  {!atBottom?<button type="button" onClick={()=>{followBottom.current=true;scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});}} aria-label="Aller au dernier message" className="absolute bottom-28 right-5 grid h-9 w-9 place-items-center rounded-full bg-white shadow-lg dark:bg-[#174852]"><ArrowDown size={16}/></button>:null}
  <div className="shrink-0 bg-gradient-to-t from-[#f8f8fc] via-[#f8f8fc] to-transparent px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 dark:from-[#092f38] dark:via-[#092f38]"><AssistantQuestionComposer variant="chat" question={masked?'':question} onChange={setQuestion} onSubmit={submit} busy={asking} loading={false} active={!demoMode&&!masked}/></div>
 </section>;
}
