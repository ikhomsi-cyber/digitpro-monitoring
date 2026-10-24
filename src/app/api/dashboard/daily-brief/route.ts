import { loadDailyBriefWork } from "@/lib/supabase/daily-brief-work";
import { loadStoredHiwayInvoices } from "@/lib/gmail/hiway-invoice-store";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardEffectiveDataMode } from "@/lib/dashboard-demo-preference";
import { privateResponseHeaders } from "@/lib/security/http";
import { decodePiloteReport } from "@/lib/bankin/pilote-report";
import { buildDailyBrief, parisDay } from "@/lib/daily-financial-brief";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { loadQontoLiveBalanceEur } from "@/lib/qonto/live-balance";
export async function GET() {
 const client=await createSupabaseServerClient();
 if(!client)return Response.json({error:"Connexion requise."},{status:401,headers:privateResponseHeaders});
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return Response.json({error:"Connexion requise."},{status:401,headers:privateResponseHeaders});
 if(getDashboardEffectiveDataMode(getSupabaseRuntimeMode(), await cookies())==="DEMO")return Response.json({error:"Le point quotidien est disponible avec vos données réelles."},{status:409,headers:privateResponseHeaders});
 const date=parisDay();const warnings:string[]=[];
 const [txResult,snapshotResult,balanceResult,workResult,invoicesResult]=await Promise.allSettled([
  (async()=>{
   const rows:DashboardTx[]=[];
   for(let page=0;page<10;page++){
    const {data,error}=await client.from("transactions").select("id,date,label,category,amount,company,scope,category_manual,bank_name").eq("user_id",user.id).eq("scope","pro").lte("date",date).order("date",{ascending:false}).order("id",{ascending:false}).range(page*1000,page*1000+999);
    if(error)throw new Error("transactions unavailable");
    const chunk=data??[];
    rows.push(...chunk.map(row=>({id:row.id,date:row.date,label:row.label??"",category:row.category??"",amount:Number(row.amount),company:row.company??"",scope:row.scope,categoryManual:row.category_manual,bankName:row.bank_name})));
    if(chunk.length<1000)return rows;
   }
   throw new Error("incomplete history");
  })(),
  (async()=>{
   const {data,error}=await client.from("bankin_pilote_snapshots").select("snapshot").eq("user_id",user.id).maybeSingle();
   if(error)throw new Error("snapshot unavailable");return data?.snapshot?decodePiloteReport(data.snapshot):null;
  })(),
  loadQontoLiveBalanceEur(user.id),
  loadDailyBriefWork(client,user.id,date),
  loadStoredHiwayInvoices(client,user.id)
 ]);
 if(txResult.status==="rejected")warnings.push("Dépenses pro indisponibles ou historique trop volumineux pour une analyse complète.");
 if(snapshotResult.status==="rejected")warnings.push("Le bilan Bankin n’a pas pu être lu.");
 if(txResult.status==="rejected"&&snapshotResult.status==="rejected")return Response.json({error:"Le point quotidien est temporairement indisponible. Réessayez."},{status:503,headers:privateResponseHeaders});
 if(workResult.status==="rejected")warnings.push("Calendrier de travail indisponible.");
 if(invoicesResult.status==="rejected")warnings.push("Factures Hiway indisponibles : couverture de trésorerie non calculée.");
 const brief=buildDailyBrief({date,transactions:txResult.status==="fulfilled"?txResult.value:null,snapshot:snapshotResult.status==="fulfilled"?snapshotResult.value:null,warnings,work:workResult.status==="fulfilled"?workResult.value:null,invoices:invoicesResult.status==="fulfilled"?invoicesResult.value:null,cash:balanceResult.status==="fulfilled"?balanceResult.value:null});
 return Response.json({...brief,qontoBalance:balanceResult.status==="fulfilled"?balanceResult.value:null},{headers:privateResponseHeaders});
}
