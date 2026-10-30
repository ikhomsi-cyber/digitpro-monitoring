import { createSupabaseServerClient } from "@/lib/supabase/server";
import { privateResponseHeaders, requireSameOrigin } from "@/lib/security/http";
import { decodePiloteStorage, encodePiloteStorage } from "@/lib/bankin/pilote-storage";
import { repairConfirmedOctober } from "@/lib/bankin/repair-confirmed-october";
import type { BankinPiloteSnapshot } from "@/lib/pilote";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request); if (denied) return denied;
  const client = await createSupabaseServerClient();
  if (!client) return Response.json({error:"Connexion requise."},{status:401,headers:privateResponseHeaders});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return Response.json({error:"Connexion requise."},{status:401,headers:privateResponseHeaders});
  const {data,error}=await client.from("bankin_pilote_snapshots").select("snapshot, updated_at").eq("user_id",user.id).maybeSingle();
  if(error||!data)return Response.json({error:"Bilan indisponible."},{status:503,headers:privateResponseHeaders});
  try {
    const original=decodePiloteStorage(data.snapshot as unknown as BankinPiloteSnapshot);
    const input=await request.json();
    if(!input||typeof input!=="object"||Object.keys(input).some(k=>k!=="excludeJojo")||(input.excludeJojo!==undefined&&typeof input.excludeJojo!=="boolean"))return Response.json({error:"Choix de rapprochement invalide."},{status:400,headers:privateResponseHeaders});
    const corrected=repairConfirmedOctober(original,input.excludeJojo===true);
    if(!corrected)return Response.json({corrected:false,amount:(corrected??original).months.find(m=>m.month==="2026-10")?.expenses},{headers:privateResponseHeaders});
    const updatedAt=new Date(Math.max(Date.now(),Date.parse(data.updated_at)+1)).toISOString();
    const {data:saved,error:writeError}=await client.from("bankin_pilote_snapshots")
      .update({snapshot:encodePiloteStorage(corrected) as unknown as import("@/lib/supabase/types").Json,updated_at:updatedAt})
      .eq("user_id",user.id).eq("updated_at",data.updated_at).select("user_id").maybeSingle();
    if(writeError||!saved)return Response.json({error:"Le bilan a changé ou la sauvegarde a échoué. Aucune correction confirmée."},{status:409,headers:privateResponseHeaders});
    return Response.json({corrected:true,removed:corrected.excludedHidden-original.excludedHidden,amount:(corrected??original).months.find(m=>m.month==="2026-10")?.expenses},{headers:privateResponseHeaders});
  } catch {
    return Response.json({error:"Le bilan ne correspond pas à la correction attendue. Aucune modification effectuée."},{status:409,headers:privateResponseHeaders});
  }
}
