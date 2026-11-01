import {z} from 'zod';
import {cookies} from 'next/headers';
import {gmailAccount} from '@/lib/gmail/accounts';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getSupabaseRuntimeMode} from '@/lib/supabase/config';
import {getDashboardEffectiveDataMode} from '@/lib/dashboard-demo-preference';
import {requireSameOrigin,privateResponseHeaders} from '@/lib/security/http';
import {withAuthorizedGmailClient} from '@/lib/gmail/tokens';
import {balanceStoreForMailbox,syncBankinBalances} from '@/lib/gmail/balance-sync';
import {balanceSyncView} from '@/lib/gmail/balance-sync-plan';
import {BalanceStorageError,BalanceBusyError} from '@/lib/gmail/balance-store';
import {gmailReadError} from '@/lib/gmail/read-error';
export const maxDuration=60;
const schema=z.object({account:z.enum(['primary','secondary']).default('primary')}).strict();
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateResponseHeaders});
async function session(){if(getDashboardEffectiveDataMode(getSupabaseRuntimeMode(),await cookies())==='DEMO')return null;const client=await createSupabaseServerClient();if(!client)return null;const {data:{user},error}=await client.auth.getUser();return error||!user?null:{client,user};}
function fail(error:unknown){if(error instanceof BalanceStorageError)return json({error:error.message},503);if(error instanceof BalanceBusyError)return json({error:'Synchronisation des soldes déjà en cours.',reason:'busy'},429);const failure=gmailReadError(error);return json({error:failure.error,reason:failure.reason},failure.status);}
export async function GET(request:Request){
 const input=schema.safeParse({account:new URL(request.url).searchParams.get('account')??'primary'});if(!input.success)return json({error:'Compte invalide.'},400);
 const current=await session();if(!current)return json({error:'Connexion requise.'},401);
 try{const store=await balanceStoreForMailbox(current.client,current.user.id,gmailAccount(input.data.account));const saved=await store?.load();return json(balanceSyncView(saved?.state??null));}catch(error){return fail(error);}
}
export async function POST(request:Request){
 const forbidden=requireSameOrigin(request);if(forbidden)return forbidden;
 let input:unknown;try{const reader=request.body?.getReader();if(!reader)return json({error:'Requête vide.'},400);const chunks:Uint8Array[]=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return json({error:'Requête trop longue.'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}input=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'Requête invalide.'},400);}
 const parsed=schema.safeParse(input);if(!parsed.success)return json({error:'Requête invalide.'},400);
 const current=await session();if(!current)return json({error:'Connexion requise.'},401);
 try{const store=await balanceStoreForMailbox(current.client,current.user.id,gmailAccount(parsed.data.account));const saved=await store?.load();if(saved&&saved.state.pauseUntil>Date.now())return json(balanceSyncView(saved.state));
 const result=await withAuthorizedGmailClient(current.client,current.user.id,auth=>syncBankinBalances(current.client,current.user.id,gmailAccount(parsed.data.account),auth,request.signal),gmailAccount(parsed.data.account));return result?json(result):json({error:'Connectez ce compte Gmail dans les paramètres.'},409);}catch(error){return fail(error);}
}
