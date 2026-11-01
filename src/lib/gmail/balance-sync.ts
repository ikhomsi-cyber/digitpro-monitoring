import 'server-only';
import type {Auth} from 'googleapis';
import type {createSupabaseServerClient} from '@/lib/supabase/server';
import type {GmailAccount} from './accounts';
import {loadGmailTokenRow} from './tokens';
import {balanceMailboxKey,balanceStore} from './balance-store';
import {balanceSyncStep,balanceSyncView} from './balance-sync-plan';
import {bankinBalanceSource} from './balance-source';
import {gmailReadError} from './read-error';
type Client=NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export async function balanceStoreForMailbox(client:Client,userId:string,account:GmailAccount){
 const token=await loadGmailTokenRow(client,userId,account);if(!token?.email)return null;
 return balanceStore(client,userId,account,balanceMailboxKey(token.email));
}
export async function syncBankinBalances(client:Client,userId:string,account:GmailAccount,auth:Auth.OAuth2Client,signal?:AbortSignal){
 const store=await balanceStoreForMailbox(client,userId,account);if(!store)throw new Error('Connectez ce compte Gmail dans les paramètres.');
 const {state:initial,lease,revision:version}=await store.claim();let state=initial,revision=version;
 if(state.pauseUntil>Date.now()){await store.save(state,lease,revision,true);return balanceSyncView(state);}
 const stop=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(35000)]),source=bankinBalanceSource(auth,stop),started=Date.now();
 try{
  state={...state,error:null,reason:null,pauseUntil:0};
  for(let step=0;step<12&&Date.now()-started<25000;step++){
   if(stop.aborted)break;
   const wasIncremental=state.phase==='incremental';
   state=await balanceSyncStep(state,source);revision=await store.save(state,lease,revision);
   if(wasIncremental&&state.phase==='incremental'&&!state.incremental)break;
  }
  await store.save(state,lease,revision,true);return balanceSyncView(state);
 }catch(error){
  const failure=gmailReadError(error);state={...state,error:failure.error,reason:failure.reason,pauseUntil:failure.reason==='quota'?Date.now()+60000:0};
  await store.save(state,lease,revision,true);
  // A refusal terminates this run immediately; no fallback mailbox or retries.
  throw error;
 }
}
