import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { z } from "zod";
import type { GroceryOrder } from "./parser";
import type { GmailAccount } from "@/lib/gmail/accounts";
const itemSchema=z.object({name:z.string().min(1).max(300),productKey:z.string().min(1).max(600),quantity:z.number().positive().max(1000),unitPriceCents:z.number().int().nonnegative().max(10000000),totalCents:z.number().int().nonnegative().max(10000000)});
export type StoredGroceryOrder=GroceryOrder & {id:string; account:GmailAccount | "bankin"; source?:"gmail"|"bankin"; bankLabel?:string};
export async function loadGroceryOrders(client:SupabaseClient<Database>,userId:string){
 const {data,error}=await client.from("grocery_orders").select("*").eq("user_id",userId).order("ordered_at",{ascending:false}).limit(501);
 if(error)throw new Error("Le suivi des courses est indisponible. Vérifiez sa migration.");
 const orders:StoredGroceryOrder[]=(data??[]).slice(0,500).map(row=>{
  const parsed=z.array(itemSchema).max(500).safeParse(row.items);
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
