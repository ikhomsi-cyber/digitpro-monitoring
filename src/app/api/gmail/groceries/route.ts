import { cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSameOrigin,privateResponseHeaders } from "@/lib/security/http";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { getDashboardEffectiveDataMode } from "@/lib/dashboard-demo-preference";
import { loadGroceryOrders,saveGroceryOrder } from "@/lib/groceries/store";
import { loadBankinGroceryTransactions } from "@/lib/groceries/bankin-store";
import { mergeBankinGroceries } from "@/lib/groceries/bankin";
export const maxDuration=300;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateResponseHeaders});
async function owner(){const client=await createSupabaseServerClient();if(!client)return null;const {data,error}=await client.auth.getUser();return !error&&data.user?{client,userId:data.user.id}:null;}
export async function GET(){
 const started=performance.now();
 const user=await owner();if(!user)return json({error:"Connexion requise."},401);
 const authenticated=performance.now();
 if(getDashboardEffectiveDataMode(getSupabaseRuntimeMode(),await cookies())==="DEMO")return json({orders:[],truncated:false});
 try{
  const [stored,bankin]=await Promise.all([loadGroceryOrders(user.client,user.userId),loadBankinGroceryTransactions(user.client,user.userId).catch(()=>null)]);
  const loaded=performance.now();
  const response=json({...stored,...mergeBankinGroceries(stored.orders,bankin?.transactions??[]),bankinTruncated:bankin?.truncated??false,warning:bankin?null:"Les dépenses Alimentation Bankin ne sont pas disponibles : seuls les achats Gmail sont affichés."});
  response.headers.set("Server-Timing",`auth;dur=${Math.round(authenticated-started)}, database;dur=${Math.round(loaded-authenticated)}, merge;dur=${Math.round(performance.now()-loaded)}`);
  return response;
 }catch{return json({error:"Le suivi des courses est indisponible. Vérifiez sa migration."},503);}
}
export async function POST(request:Request){
 const forbidden=requireSameOrigin(request);if(forbidden)return forbidden;
 if(getDashboardEffectiveDataMode(getSupabaseRuntimeMode(),await cookies())==="DEMO")return json({error:"Import désactivé en mode démo."},403);
 const user=await owner();if(!user)return json({error:"Connexion requise."},401);
 const parsed=z.object({account:z.enum(["primary","secondary"]),pageToken:z.string().max(2000).optional()}).strict().safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return json({error:"Sélectionnez un compte Gmail valide."},400);
 const [{withSyncJob,SyncBusyError},{withAuthorizedGmailClient},{fetchGroceryOrders}]=await Promise.all([
  import("@/lib/security/sync-job"),import("@/lib/gmail/tokens"),import("@/lib/groceries/fetch-orders")
 ]);
 try{
  const result=await withSyncJob(user.client,user.userId,"gmail",()=>withAuthorizedGmailClient(user.client,user.userId,async auth=>{
   const fetched=await fetchGroceryOrders(auth,parsed.data.pageToken);let saved=0;
   for(const entry of fetched.orders)if(await saveGroceryOrder(user.client,user.userId,parsed.data.account,entry.messageId,entry.order))saved++;
   return {saved,scanned:fetched.scanned,ignored:fetched.ignored,missingDetails:fetched.orders.filter(entry=>!entry.order.items.length).length,nextPageToken:fetched.nextPageToken};
  },parsed.data.account));
  return result?json(result):json({error:"Connectez le compte Gmail des commandes alimentaires."},409);
 }catch(error){
  if(error instanceof SyncBusyError)return json({error:error.message},429);
  const status=(error as {response?:{status?:number};code?:unknown})?.response?.status;
  if(status===401||status===403)return json({error:"L’accès Gmail a été refusé. Reconnectez ce compte avant de réessayer."},status);
  return json({error:"Import des commandes interrompu. Les commandes déjà enregistrées sont conservées."},502);
 }
}
