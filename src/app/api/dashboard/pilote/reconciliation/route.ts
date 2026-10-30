import {createSupabaseServerClient} from "@/lib/supabase/server";
import {privateResponseHeaders} from "@/lib/security/http";
import {decodePiloteStorage} from "@/lib/bankin/pilote-storage";
import {isPiloteReportRow,type BankinPiloteSnapshot} from "@/lib/pilote";
export async function GET(request:Request){
 const month=new URL(request.url).searchParams.get("month");
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
  return Response.json({month,rows:rows.map(r=>({sourceRow:r.sourceRow,date:r.date,expense:-r.amount,parent:r.parentCategory,category:r.subCategory}))},{headers:privateResponseHeaders});
 }catch{return Response.json({error:"Bilan illisible."},{status:503,headers:privateResponseHeaders})}
}
