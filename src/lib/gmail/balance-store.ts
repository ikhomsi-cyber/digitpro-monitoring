import 'server-only';
import {gzipSync,gunzipSync} from 'node:zlib';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import type {createSupabaseServerClient} from '@/lib/supabase/server';
import type {Json} from '@/lib/supabase/types';
import type {GmailAccount} from './accounts';
import {newBalanceSync,type BalanceSyncState} from './balance-sync-plan';
type Client=NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
const point=z.object({account:z.string().max(160),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),balance:z.number().finite(),observedAt:z.number().finite().optional()});
const job=z.object({startedAt:z.number().finite(),cursor:z.string().max(4096).optional(),pending:z.array(z.string().max(256)).max(100),listed:z.boolean()});
const schema=z.object({version:z.literal(2),phase:z.enum(['discover','backfill','incremental']),low:z.number().finite(),high:z.number().finite(),weekEnd:z.number().finite(),checkedAt:z.number().finite(),points:z.array(point).max(200000),messages:z.array(z.string().max(256)).max(200000),weeks:z.number().int().nonnegative(),scanned:z.number().int().nonnegative(),missed:z.number().int().nonnegative(),incremental:job.nullable(),pauseUntil:z.number().finite(),error:z.string().max(600).nullable(),reason:z.string().max(80).nullable()});
export const balanceMailboxKey=(email:string)=>createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export function encodeBalanceState(state:BalanceSyncState):Json{const data=gzipSync(Buffer.from(JSON.stringify(schema.parse(state)))).toString('base64');if(data.length>1900000)throw new Error('Historique des soldes trop volumineux.');return {version:2,data};}
export function decodeBalanceState(value:Json):BalanceSyncState{try{const envelope=z.object({version:z.literal(2),data:z.string().max(1900000)}).parse(value);return schema.parse(JSON.parse(gunzipSync(Buffer.from(envelope.data,'base64'),{maxOutputLength:32000000}).toString('utf8')));}catch{throw new Error('Historique des soldes illisible. Les données sauvegardées sont conservées.');}}
export class BalanceStorageError extends Error{constructor(readonly code?:string){super(code==='42P01'||code==='PGRST205'?'Le stockage des soldes nécessite la migration Bankin Balance History.':'Stockage des soldes indisponible. La progression précédente est conservée.');}}
export class BalanceBusyError extends Error{}
export function balanceStore(client:Client,userId:string,account:GmailAccount,mailbox:string){
 const query=()=>client.from('bankin_balance_sync');
 const where=<T extends {eq:(key:string,value:string)=>T}>(q:T)=>q.eq('user_id',userId).eq('gmail_account',account).eq('mailbox_key',mailbox);
 return {
  async load(){const {data,error}=await where(query().select('snapshot,revision,lease_until,lease_id')).maybeSingle();if(error)throw new BalanceStorageError(error.code);return data?{state:decodeBalanceState(data.snapshot),revision:data.revision,leaseUntil:data.lease_until,lease:data.lease_id}:null;},
  async claim(){let row=await this.load();if(!row){const {error}=await query().insert({user_id:userId,gmail_account:account,mailbox_key:mailbox,snapshot:encodeBalanceState(newBalanceSync())});if(error&&error.code!=='23505')throw new BalanceStorageError(error.code);row=await this.load();}if(!row)throw new BalanceStorageError();if(row.leaseUntil&&Date.parse(row.leaseUntil)>Date.now())throw new BalanceBusyError();const lease=randomUUID();const {data,error}=await where(query().update({lease_id:lease,lease_until:new Date(Date.now()+90000).toISOString(),revision:row.revision+1})).eq('revision',row.revision).select('revision').maybeSingle();if(error)throw new BalanceStorageError(error.code);if(!data)throw new BalanceBusyError();return {state:row.state,lease,revision:data.revision};},
  async save(state:BalanceSyncState,lease:string,revision:number,release=false){const {data,error}=await where(query().update({snapshot:encodeBalanceState(state),revision:revision+1,updated_at:new Date().toISOString(),...(release?{lease_id:null,lease_until:null}:{})})).eq('revision',revision).eq('lease_id',lease).select('revision').maybeSingle();if(error)throw new BalanceStorageError(error.code);if(!data)throw new BalanceBusyError();return data.revision;}
 };
}
