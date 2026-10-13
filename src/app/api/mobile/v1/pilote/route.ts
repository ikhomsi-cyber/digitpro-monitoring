import { z } from "zod";
import { mobileAuth, mobileJSON, mobileFailure, MobileError } from "@/lib/mobile/auth";
import { buildMobilePilote } from "@/lib/mobile/pilote";
import type { BankinPiloteSnapshot } from "@/lib/pilote";
export const dynamic="force-dynamic";
const schema=z.object({period:z.string().regex(/^\d{4}(-(?:0[1-9]|1[0-2]))?$/).optional(),views:z.string().default("essential"),travelScope:z.enum(["history","year","period"]).default("year"),travelYear:z.string().regex(/^\d{4}$/).optional()});
export async function GET(request:Request){
  try{
    const {client,userId}=await mobileAuth(request);
    const parsed=schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if(!parsed.success)throw new MobileError(400,"Période ou filtre invalide.");
    const views=parsed.data.views?parsed.data.views.split(","):[];
    if(views.some(v=>!["essential","secondary","travel"].includes(v)))throw new MobileError(400,"Type de dépenses invalide.");
    const {data,error}=await client.from("bankin_pilote_snapshots").select("snapshot").eq("user_id",userId).maybeSingle();
    if(error)throw new MobileError(503,"Le bilan Bankin est indisponible.");
    return mobileJSON(buildMobilePilote(data?.snapshot as unknown as BankinPiloteSnapshot|null,{...parsed.data,views:[...new Set(views)] as ("essential"|"secondary"|"travel")[]}));
  }catch(error){return mobileFailure(error);}
}
