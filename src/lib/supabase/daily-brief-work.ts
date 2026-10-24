import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type { BriefWorkSettings } from "@/lib/daily-brief-activity";
export async function loadDailyBriefWork(client:SupabaseClient<Database>,userId:string,date:string):Promise<BriefWorkSettings>{
 const [days,settings,rates]=await Promise.all([
  client.from("billable_work_days").select("work_date").eq("user_id",userId).gte("work_date",`${date.slice(0,4)}-01-01`).lte("work_date",`${date.slice(0,4)}-12-31`).order("work_date").limit(1000),
  client.from("user_billable_settings").select("tjm_ht").eq("user_id",userId).maybeSingle(),
  client.from("billable_rate_periods").select("client_name,start_date,end_date,tjm_ht").eq("user_id",userId).order("start_date",{ascending:false}).limit(1000)
 ]);
 if(days.error||settings.error||rates.error||(rates.data?.length??0)>=1000)throw new Error("Activity unavailable");
 const tjm=Number(settings.data?.tjm_ht);
 return {days:(days.data??[]).map(d=>d.work_date),tjm:Number.isFinite(tjm)&&tjm>0?tjm:null,rates:(rates.data??[]).map(r=>({clientName:r.client_name??"",startDate:r.start_date,endDate:r.end_date,tjmHt:Number(r.tjm_ht)}))};
}
