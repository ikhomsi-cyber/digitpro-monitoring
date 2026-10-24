import type { BankinPiloteSnapshot } from "@/lib/pilote";
import type { PiloteDaily } from "./pilote-daily";
class PiloteAccessError extends Error {}
export type PiloteDashboardData={snapshot:BankinPiloteSnapshot|null;daily:PiloteDaily|null};
/** One loader per mounted dashboard. No storage, shared module cache, or cross-user response cache. */
export function createPiloteLoader(fetcher:typeof fetch=fetch){
 let request:Promise<PiloteDashboardData>|null=null;
 return (refresh=false)=>{
  if(!request||refresh){
   const pending=fetcher("/api/dashboard/pilote",{cache:"no-store"}).then(async response=>{
    if(!response.ok){const ErrorType=response.status===401||response.status===403?PiloteAccessError:Error;throw new ErrorType("Le bilan Bankin est indisponible. Réessayez après l’import.");}
    return await response.json() as PiloteDashboardData;
   });
   request=pending;
   void pending.catch(error=>{if(!(error instanceof PiloteAccessError)&&request===pending)request=null;});
  }
  return request;
 };
}
