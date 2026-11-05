import {createSupabaseServerClient} from "@/lib/supabase/server";
import {privateResponseHeaders} from "@/lib/security/http";
import {decodePiloteStorage} from "@/lib/bankin/pilote-storage";
import {isPiloteReportRow,type BankinPiloteSnapshot} from "@/lib/pilote";
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,month=params.get("month"),date=params.get("date"),expense=params.get("expense");
 if((date!==null||expense!==null)&&(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!expense||!/^\d+(?:\.\d{1,2})?$/.test(expense)||Number(expense)<=0||date.slice(0,7)!==month))return Response.json({error:"Rapprochement invalide."},{status:400,headers:privateResponseHeaders});
 if(!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return Response.json({error:"Mois invalide."},{status:400,headers:privateResponseHeaders});
 const client=await createSupabaseServerClient();if(!client)return Response.json({error:"Connexion requise."},{status:401,headers:privateResponseHeaders});
 const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return Response.json({error:"Connexion requise."},{status:401,headers:privateResponseHeaders});
 const {data,error}=await client.from("bankin_pilote_snapshots").select("snapshot").eq("user_id",user.id).maybeSingle();
 if(error||!data)return Response.json({error:"Bilan indisponible."},{status:503,headers:privateResponseHeaders});
 try{
  const source=decodePiloteStorage(data.snapshot as unknown as BankinPiloteSnapshot);
  if(!source.rows)return Response.json({error:"Détail de l’export manquant."},{status:409,headers:privateResponseHeaders});
  const rows=source.rows.filter(r=>r.date.startsWith(`${month}-`)&&r.amount<0&&isPiloteReportRow(r));
  if(rows.length>2000)return Response.json({error:"Période trop volumineuse."},{status:413,headers:privateResponseHeaders});
  if(date&&expense){
   const candidates=rows.filter(row=>Math.round(-row.amount*100)===Math.round(Number(expense)*100));
   const targets=candidates.filter(row=>row.date===date),target=targets.length===1?targets[0]:null;
   const normal=(label:string)=>label.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
   return Response.json({month,date,expense:Number(expense),targetCount:targets.length,rows:candidates.map(row=>({sourceRow:row.sourceRow,date:row.date,expense:-row.amount,parent:row.parentCategory,category:row.subCategory,sameDescription:target?.label&&row.label?normal(target.label)===normal(row.label):null,bankinCard:!!row.label&&/\bbankin\b/.test(normal(row.label))&&/\bcb\b/.test(normal(row.label))}))},{headers:privateResponseHeaders});
  }
  return Response.json({month,rows:rows.map(r=>({sourceRow:r.sourceRow,date:r.date,expense:-r.amount,parent:r.parentCategory,category:r.subCategory}))},{headers:privateResponseHeaders});
 }catch{return Response.json({error:"Bilan illisible."},{status:503,headers:privateResponseHeaders})}
}
