import { buildBankinPiloteSnapshot, type BankinPiloteSnapshot } from "@/lib/pilote";
const cents=(value:number)=>Math.round(value*100);
const isNdf=(name:string)=>name.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().trim().replace(/\.$/,"")==="ndf digitpro";
/** Owner-confirmed October reconciliation. No general amount/date deduplication. */
export function repairConfirmedNdfDuplicates(snapshot:BankinPiloteSnapshot):BankinPiloteSnapshot|null{
 if(!snapshot.rows)throw new Error("Détail Bankin manquant.");
 const active=snapshot.rows.filter(r=>!r.hidden&&r.amount<0&&r.date.startsWith("2026-10-")&&isNdf(r.subCategory));
 const total=active.reduce((sum,r)=>sum-cents(r.amount),0);
 if(active.length===5&&total===35379)return null;
 if(active.length!==8||total!==51968)throw new Error("Les lignes NDF ne correspondent pas au rapprochement confirmé.");
 const pairs=[{amount:-7240,old:"2026-10-21",current:"2026-10-22"},{amount:-7850,old:"2026-10-24",current:"2026-10-26"},{amount:-1499,old:"2026-10-24",current:"2026-10-26"}];
 const removed=pairs.map(pair=>{
  const old=active.filter(r=>r.date===pair.old&&cents(r.amount)===pair.amount);
  const current=active.filter(r=>r.date===pair.current&&cents(r.amount)===pair.amount);
  if(old.length!==1||current.length!==1||!old[0].identity||!current[0].identity||old[0].identity===current[0].identity)throw new Error("Rapprochement NDF ambigu.");
  return old[0];
 });
 const removedSet=new Set(removed);
 const rows=snapshot.rows.map(r=>removedSet.has(r)?{...r,hidden:true}:r);
 return {...snapshot,...buildBankinPiloteSnapshot(rows,snapshot.sourceFilename,snapshot.fileHash),importedAt:snapshot.importedAt,
  excludedRowIdentities:[...new Set([...(snapshot.excludedRowIdentities??[]),...removed.map(r=>r.identity!)])]};
}
