"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {Loader2,Mic,Send,Square} from "lucide-react";
import {createSpeechDictation,type SpeechConstructor} from "@/lib/speech-dictation";
type SpeechWindow=Window&{SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor};
const speechConstructor=()=>{const browser=window as SpeechWindow;return browser.SpeechRecognition??browser.webkitSpeechRecognition;};
export function AssistantQuestionComposer({question,onChange,onSubmit,busy,loading,active}:{question:string;onChange:(value:string)=>void;onSubmit:(event:FormEvent<HTMLFormElement>)=>void;busy:boolean;loading:boolean;active:boolean}){
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[voiceError,setVoiceError]=useState('');
 const dictation=useRef<ReturnType<typeof createSpeechDictation>|null>(null);
 const cancel=()=>{dictation.current?.abort();dictation.current=null;setListening(false);};
 useEffect(()=>{setSupported(!!speechConstructor());return()=>dictation.current?.abort();},[]);
 useEffect(()=>{if(!active||busy){dictation.current?.abort();dictation.current=null;setListening(false);}},[active,busy]);
 useEffect(()=>{const hidden=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 const toggleDictation=()=>{
  if(listening){dictation.current?.stop();return;}
  const Constructor=speechConstructor();if(!Constructor)return;
  cancel();setVoiceError('');
  try{dictation.current=createSpeechDictation(Constructor,question,{onText:onChange,onListening:setListening,onError:setVoiceError});dictation.current.start();}
  catch{setVoiceError('La dictée est indisponible dans ce navigateur.');}
 };
 return <form onSubmit={event=>{cancel();onSubmit(event);}} className="min-w-0 rounded-2xl border border-ink-200 bg-ink-50/70 p-3 focus-within:border-[var(--app-accent)] focus-within:ring-1 focus-within:ring-[var(--app-accent)] dark:border-white/15 dark:bg-white/5">
  <label htmlFor="daily-assistant-question" className="sr-only">Votre question</label>
  <textarea id="daily-assistant-question" value={question} onChange={event=>{cancel();setVoiceError('');onChange(event.target.value);}} rows={3} maxLength={2000} placeholder="Que souhaitez-vous savoir ?" disabled={busy} autoCapitalize="sentences" enterKeyHint="enter" className="block h-20 w-full min-w-0 resize-none overflow-y-auto bg-transparent px-1 py-1 text-base leading-6 outline-none placeholder:text-ink-400 dark:placeholder:text-white/35"/>
  <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-ink-200/50 pt-2 dark:border-white/10">
   <button type="button" onClick={toggleDictation} disabled={busy||!active||!supported} aria-label={listening?'Arrêter la dictée':'Dicter ma question'} aria-pressed={listening} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium transition disabled:opacity-40 ${listening?'bg-rose-500/10 text-rose-600 dark:text-rose-300':'text-ink-600 hover:bg-ink-100 dark:text-white/70 dark:hover:bg-white/10'}`}>{listening?<Square size={16} fill="currentColor"/>:<Mic size={18}/>}<span>{listening?'Arrêter':'Dicter'}</span></button>
   <button type="submit" disabled={busy||loading||listening||question.trim().length<2} aria-label="Analyser ma question" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 text-xs font-semibold text-white disabled:opacity-40">{busy?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>}<span>{busy?'Analyse…':'Envoyer'}</span></button>
  </div>
  <p role="status" aria-live="polite" className={`mt-2 h-9 overflow-y-auto text-[10px] leading-4 ${voiceError?'text-amber-700 dark:text-amber-300':'text-ink-400 dark:text-white/45'}`}>{voiceError|| (listening?'Je vous écoute… La question restera modifiable avant l’envoi.':supported?'Votre navigateur peut traiter la voix en ligne. Relisez le texte avant l’envoi.':'Dictée indisponible ici. Vous pouvez utiliser le micro de votre clavier.')}</p>
 </form>;
}
