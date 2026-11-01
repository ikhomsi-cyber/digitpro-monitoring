import {cookies} from 'next/headers';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getSupabaseRuntimeMode} from '@/lib/supabase/config';
import {getDashboardEffectiveDataMode} from '@/lib/dashboard-demo-preference';
import {privateResponseHeaders} from '@/lib/security/http';
import {decodePiloteStorage,type StoredPiloteSnapshot} from '@/lib/bankin/pilote-storage';
import type {BankinPiloteSnapshot} from '@/lib/pilote';
import {buildInvestments} from '@/lib/investments';
export async function GET(){
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateResponseHeaders});
 if(getDashboardEffectiveDataMode(getSupabaseRuntimeMode(),await cookies())==='DEMO')return json({error:'Investissements indisponibles en mode démo.'},403);
 const client=await createSupabaseServerClient();if(!client)return json({error:'Connexion requise.'},401);
 const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return json({error:'Connexion requise.'},401);
 const {data,error}=await client.from('bankin_pilote_snapshots').select('snapshot').eq('user_id',user.id).maybeSingle();
 if(error)return json({error:'Les investissements Bankin sont indisponibles.'},error.code==='42501'?403:503);
 try{const snapshot=data?.snapshot?decodePiloteStorage(data.snapshot as unknown as BankinPiloteSnapshot|StoredPiloteSnapshot):null;const asOf=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());return json(buildInvestments(snapshot,asOf));}
 catch{return json({error:'L’historique Bankin est illisible. Les données enregistrées sont conservées.'},503);}
}
