import {mergeBankinBalancePoints,type BankinBalancePoint} from './bankin-balance-parser';
export const BALANCE_QUERY='from:(bankin.com) {subject:"Balance quotidienne" subject:"Vos soldes quotidiens"} -subject:cashback -subject:conversation';
const DAY=86400000,WEEK=7*DAY;
export type BalanceSyncState={version:2;phase:'discover'|'backfill'|'incremental';low:number;high:number;weekEnd:number;checkedAt:number;points:BankinBalancePoint[];messages:string[];weeks:number;scanned:number;missed:number;incremental:null|{startedAt:number;cursor?:string;pending:string[];listed:boolean};pauseUntil:number;error:string|null;reason:string|null};
export type BalanceMailSource={list:(query:string,limit:number,cursor?:string)=>Promise<{ids:string[];next?:string}>;read:(id:string)=>Promise<BankinBalancePoint[]>};
export function newBalanceSync(now=Date.now()):BalanceSyncState{
 const day=Math.floor(now/DAY)*DAY;const weekday=new Date(day).getUTCDay();
 return {version:2,phase:'discover',low:Date.UTC(2004,3,1),high:day+DAY,weekEnd:day-((weekday+6)%7)*DAY+WEEK,checkedAt:now,points:[],messages:[],weeks:0,scanned:0,missed:0,incremental:null,pauseUntil:0,error:null,reason:null};
}
function period(start:number,end:number){return `${BALANCE_QUERY} after:${Math.floor(start/1000)-1} before:${Math.floor(end/1000)}`;}
/** Each step does at most one Gmail request and is committed before the next. */
export async function balanceSyncStep(input:BalanceSyncState,source:BalanceMailSource,now=Date.now()):Promise<BalanceSyncState>{
 const state=structuredClone(input);
 if(state.pauseUntil>now)throw new Error('Synchronisation en pause.');
 if(state.phase==='discover'){
  if(state.high-state.low<=DAY){state.phase='backfill';return state;}
  const mid=Math.floor((state.low+state.high)/2/DAY)*DAY;
  const found=await source.list(`${BALANCE_QUERY} before:${Math.floor(mid/1000)}`,1);
  if(found.ids.length)state.high=mid;else state.low=mid;
  return state;
 }
 if(state.phase==='backfill'){
  if(state.weekEnd<=state.low){state.phase='incremental';return state;}
  // A persisted pending id splits listing and reading into independent checkpoints.
  if(!state.incremental){const listed=await source.list(period(Math.max(state.low,state.weekEnd-WEEK),state.weekEnd),1);state.incremental={startedAt:now,pending:listed.ids,listed:true};return state;}
  const id=state.incremental.pending[0];
  if(id&&!state.messages.includes(id)){const points=await source.read(id);if(!points.length)state.missed++;state.points=mergeBankinBalancePoints([...state.points,...points]);state.messages.push(id);state.scanned++;}
  state.incremental=null;state.weekEnd-=WEEK;state.weeks++;return state;
 }
 if(!state.incremental)state.incremental={startedAt:now,pending:[],listed:false};
 const job=state.incremental;
 if(job.pending.length){
  const id=job.pending[0];if(!state.messages.includes(id)){const points=await source.read(id);if(!points.length)state.missed++;state.points=mergeBankinBalancePoints([...state.points,...points]);state.messages.push(id);state.scanned++;}job.pending.shift();return state;
 }
 if(job.listed){state.checkedAt=job.startedAt;state.incremental=null;return state;}
 const listed=await source.list(period(Math.max(0,state.checkedAt-2*DAY),job.startedAt+1000),100,job.cursor);
 if(listed.next&&listed.next===job.cursor)throw new Error('Pagination Gmail interrompue.');
 job.pending=listed.ids.filter(id=>!state.messages.includes(id));job.cursor=listed.next;job.listed=!listed.next;
 return state;
}
export function balanceSyncView(state:BalanceSyncState|null){return {points:state?.points.filter(p=>/\bfortuneo\b/i.test(p.account))??[],scanned:state?.scanned??0,missed:state?.missed??0,weeks:state?.weeks??0,backfillComplete:state?.phase==='incremental',pending:!!state&&(state.phase!=='incremental'||!!state.incremental),checkedAt:state?.checkedAt??null,pauseUntil:state?.pauseUntil??0,error:state?.error??null,reason:state?.reason??null,sampling:'weekly' as const};}
