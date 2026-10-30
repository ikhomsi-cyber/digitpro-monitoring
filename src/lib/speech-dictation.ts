export type SpeechResult = {isFinal:boolean;[index:number]:{transcript:string}};
export type SpeechRecognizer = {
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onresult:((event:{results:ArrayLike<SpeechResult>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
 start():void;stop():void;abort():void;
};
export type SpeechConstructor = new()=>SpeechRecognizer;
export function speechErrorMessage(code:string){
 if(code==='not-allowed'||code==='service-not-allowed')return 'Micro non autorisé. Vérifiez les autorisations du navigateur.';
 if(code==='audio-capture')return 'Aucun microphone disponible.';
 if(code==='no-speech')return 'Aucune voix détectée. Vous pouvez réessayer.';
 if(code==='network')return 'La dictée est indisponible. Vérifiez votre connexion.';
 return 'La dictée n’a pas pu démarrer. Vous pouvez saisir votre question.';
}
/** Browser-owned dictation only; never sends a question or stores audio. */
export function createSpeechDictation(Constructor:SpeechConstructor,base:string,callbacks:{onText:(text:string)=>void;onListening:(active:boolean)=>void;onError:(message:string)=>void}){
 const recognition=new Constructor();let cancelled=false;
 recognition.lang='fr-FR';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
 recognition.onresult=event=>{
  if(cancelled)return;
  const words=Array.from(event.results).filter(result=>result.isFinal).map(result=>result[0]?.transcript??'').join(' ').trim();
  if(words)callbacks.onText(`${base.trimEnd()}${base.trim()?' ':''}${words}`.slice(0,2000));
 };
 recognition.onerror=event=>{if(!cancelled){cancelled=true;try{recognition.abort();}catch{/* Already stopped. */}callbacks.onListening(false);callbacks.onError(speechErrorMessage(event.error));}};
 recognition.onend=()=>{if(!cancelled)callbacks.onListening(false);};
 return {
  start(){try{callbacks.onListening(true);recognition.start();}catch{callbacks.onListening(false);callbacks.onError(speechErrorMessage('start'));}},
  stop(){try{recognition.stop();}catch{callbacks.onListening(false);}},
  abort(){cancelled=true;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{/* Already stopped. */}},
 };
}
