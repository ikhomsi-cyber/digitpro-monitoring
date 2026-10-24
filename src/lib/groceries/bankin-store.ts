import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { GroceryBankTransaction } from "./bankin";

/** Fetch only the authenticated owner's Bankin food debits, not their bank history. */
export async function loadBankinGroceryTransactions(client:SupabaseClient<Database>,userId:string){
 const transactions:GroceryBankTransaction[]=[];
 const pageSize=1000,maxRows=25000;
 for(let from=0;from<maxRows;from+=pageSize){
  const {data,error}=await client.from("transactions")
   .select("id,date,label,amount,category,import_sessions!inner(format)")
   .eq("user_id",userId).eq("scope","personal").eq("import_sessions.format","bankin")
   .ilike("category","%alimentation%").lt("amount",0)
   .order("date",{ascending:false}).order("id",{ascending:false}).range(from,from+pageSize-1);
  if(error)throw new Error("Dépenses alimentaires Bankin indisponibles.");
  const rows=(data??[]) as unknown as GroceryBankTransaction[];
  transactions.push(...rows);
  if(rows.length<pageSize)return {transactions,truncated:false};
 }
 return {transactions,truncated:true};
}
