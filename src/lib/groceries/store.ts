import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { z } from "zod";
import type { GroceryOrder } from "./parser";
import type { GmailAccount } from "@/lib/gmail/accounts";
const itemSchema=z.object({name:z.string().min(1).max(300),productKey:z.string().min(1).max(600),quantity:z.number().positive().max(1000),unitPriceCents:z.number().int().nonnegative().max(10000000),totalCents:z.number().int().nonnegative().max(10000000)});
export type StoredGroceryOrder=GroceryOrder & {id:string; account:GmailAccount | "bankin"; source?:"gmail"|"bankin"; bankLabel?:string};
export async function loadGroceryOrders(client:SupabaseClient<Database>,userId:string,options:{summaryOnly?:boolean;period?:string}={}){
 const columns=options.summaryOnly?"id,merchant,order_ref,ordered_at,total_cents,gmail_account":"id,merchant,order_ref,ordered_at,total_cents,gmail_account,items";
 let query=client.from("grocery_orders").select(columns).eq("user_id",userId);
 if(options.period&&options.period!=="all"){
  const year=Number(options.period.slice(0,4)),month=options.period.length===7?Number(options.period.slice(5,7)):1;
  const from=`${year}-${String(month).padStart(2,"0")}-01`;
  const end=options.period.length===7?new Date(Date.UTC(year,month,1)):new Date(Date.UTC(year+1,0,1));
  query=query.gte("ordered_at",from).lt("ordered_at",end.toISOString().slice(0,10));
 }
 const {data,error}=await query.order("ordered_at",{ascending:false}).limit(501);
 if(error)throw new Error("Le suivi des courses est indisponible. Vérifiez sa migration.");
 const orders:StoredGroceryOrder[]=((data??[]) as unknown as Database["public"]["Tables"]["grocery_orders"]["Row"][]).slice(0,500).map(row=>{
  const parsed=options.summaryOnly?{success:true as const,data:[]}:z.array(itemSchema).max(500).safeParse(row.items);
  if(!parsed.success)throw new Error("Une commande sauvegardée est illisible.");
  return {id:row.id,merchant:row.merchant,orderRef:row.order_ref,date:row.ordered_at,totalCents:row.total_cents,items:parsed.data,account:row.gmail_account as GmailAccount};
 });
 return {orders,truncated:(data?.length??0)>500};
}
export async function saveGroceryOrder(client:SupabaseClient<Database>,userId:string,account:GmailAccount,messageId:string,order:GroceryOrder){
 const {data:existing,error:readError}=await client.from("grocery_orders").select("id,items,total_cents").eq("user_id",userId).eq("merchant",order.merchant).eq("order_ref",order.orderRef).maybeSingle();
 if(readError)throw new Error("Vérification des doublons de courses impossible.");
 // Keep the first detailed confirmation: later reminders must not erase purchased products.
 const hasMoreProducts = !existing || !Array.isArray(existing.items) || order.items.length > existing.items.length;
 const hasNewTotal = existing?.total_cents == null && order.totalCents !== null;
 if(existing && !hasMoreProducts && !hasNewTotal)return false;
 const row={user_id:userId,merchant:order.merchant,order_ref:order.orderRef,ordered_at:order.date,total_cents:order.totalCents ?? existing?.total_cents ?? null,items:(hasMoreProducts ? order.items : existing!.items) as unknown as Json,gmail_account:account,gmail_message_id:messageId};
 const {error}=existing?await client.from("grocery_orders").update(row).eq("user_id",userId).eq("id",existing.id):await client.from("grocery_orders").insert(row);
 if(error){if(error.code==="23505")return false;throw new Error("La commande ne peut pas être enregistrée.");}
 return true;
}
