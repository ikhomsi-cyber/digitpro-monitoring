import {gmailReadError} from '@/lib/gmail/read-error';
import {z} from 'zod';
import {gmailAccount} from '@/lib/gmail/accounts';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {requireSameOrigin,privateResponseHeaders} from '@/lib/security/http';
import {withAuthorizedGmailClient} from '@/lib/gmail/tokens';
import {fetchBankinBalancePage} from '@/lib/gmail/fetch-bankin-balances';
export const maxDuration=60;
const schema=z.object({account:z.enum(['primary','secondary']).default('primary'),cursor:z.string().max(4096).optional()}).strict();
export async function POST(request:Request){
 const forbidden=requireSameOrigin(request);if(forbidden)return forbidden;
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateResponseHeaders});
 if(Number(request.headers.get('content-length')??0)>8192)return json({error:'Requête trop longue.'},413);
 let input:unknown;
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:'Requête vide.'},400);
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return json({error:'Requête trop longue.'},413);}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  input=JSON.parse(new TextDecoder().decode(data));
 }catch{return json({error:'Requête invalide.'},400);}
 const parsed=schema.safeParse(input);if(!parsed.success)return json({error:'Requête invalide.'},400);
 const client=await createSupabaseServerClient();if(!client)return json({error:'Connexion requise.'},401);
 const {data:{user},error}=await client.auth.getUser();if(error||!user)return json({error:'Connexion requise.'},401);
 try{
  const result=await withAuthorizedGmailClient(client,user.id,auth=>fetchBankinBalancePage(auth,parsed.data.cursor,request.signal),gmailAccount(parsed.data.account));
  return result?json(result):json({error:'Connectez ce compte Gmail dans les paramètres.'},409);
 }catch(error){
  const failure=gmailReadError(error);
  return json({error:failure.error,reason:failure.reason},failure.status);
 }
}
