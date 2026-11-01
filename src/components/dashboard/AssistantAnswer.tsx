import {Fragment} from 'react';
/** Small safe renderer: model text remains React text, never HTML or executable links. */
function Inline({text}:{text:string}){return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index} className="font-semibold">{part.slice(2,-2)}</strong>:<Fragment key={index}>{part}</Fragment>)}</>;}
export function AssistantAnswer({text}:{text:string}){
 const lines=text.split('\n');
 return <div className="space-y-3 text-[14px] leading-7 sm:text-[15px]">{lines.map((line,index)=>{
  if(!line.trim())return null;
  if(/^#{1,3}\s/.test(line))return <h3 key={index} className="pt-2 text-base font-semibold tracking-tight"><Inline text={line.replace(/^#{1,3}\s+/, '')}/></h3>;
  if(/^\s*[-*]\s+/.test(line))return <p key={index} className="flex gap-2 text-ink-600 dark:text-white/65"><span aria-hidden="true">•</span><span><Inline text={line.replace(/^\s*[-*]\s+/, '')}/></span></p>;
  return <p key={index} className="whitespace-pre-wrap text-ink-600 dark:text-white/70"><Inline text={line}/></p>;
 })}</div>;
}
