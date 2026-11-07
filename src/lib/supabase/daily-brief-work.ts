import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type { BriefWorkSettings } from "@/lib/daily-brief-activity";
export async function loadDailyBriefWork(client:SupabaseClient<Database>,userId:string,date:string):Promise<BriefWorkSettings>{
 const loadDays=async()=>{const rows:{work_date:string}[]=[];for(let offset=0;;offset+=500){const page=await client.from('billable_work_days').select('work_date').eq('user_id',userId).lte('work_date',`${date.slice(0,4)}-12-31`).order('work_date').range(offset,offset+499);if(page.error)throw new Error('Activity unavailable');rows.push(...(page.data??[]));if((page.data?.length??0)<500)return rows;}};
 const loadRates=async()=>{const rows:BriefWorkSettings['rates']=[];for(let offset=0;;offset+=500){const page=await client.from('billable_rate_periods').select('client_name,start_date,end_date,tjm_ht').eq('user_id',userId).order('start_date',{ascending:false}).order('id').range(offset,offset+499);if(page.error)throw new Error('Activity unavailable');rows.push(...(page.data??[]).map(r=>({clientName:r.client_name??'',startDate:r.start_date,endDate:r.end_date,tjmHt:Number(r.tjm_ht)})));if((page.data?.length??0)<500)return rows;}};
 const [days,settings,rates]=await Promise.all([loadDays(),client.from('user_billable_settings').select('tjm_ht').eq('user_id',userId).maybeSingle(),loadRates()]);
 if(settings.error)throw new Error('Activity unavailable');
 const tjm=Number(settings.data?.tjm_ht);
 return {days:days.map(d=>d.work_date),tjm:Number.isFinite(tjm)&&tjm>0?tjm:null,rates};
}
