import type {BankinPiloteRow} from '../pilote';
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const candidate=(row:BankinPiloteRow,date:string)=>row.date===date&&Math.round(row.amount*100)===-20000&&norm(row.subCategory)==='carrefour'&&!!row.label&&/\bbankin\b/.test(norm(row.label))&&/\bcb\b/.test(norm(row.label));
/** Owner-reported 03/11 payment: the identical 04/11 description is the booked version.
 * Narrow confirmation only. Equal amounts or nearby dates alone never establish a duplicate.
 */
export function confirmedCarrefourPair(oldRows:readonly BankinPiloteRow[],currentRows:readonly BankinPiloteRow[]){
 const old=oldRows.filter(row=>candidate(row,'2026-11-03')),current=currentRows.filter(row=>candidate(row,'2026-11-04'));
 return old.length===1&&current.length===1&&norm(old[0].label!)===norm(current[0].label!)?{old:old[0],current:current[0]}:null;
}

/** Owner-confirmed November IK total of 986 euros counted twice.
 * Apply only to exactly two 493-euro IK credits; keep source records intact.
 */
export function confirmedNovemberIkDuplicate(rows:readonly BankinPiloteRow[]){
 const candidates=rows.filter(row=>row.date.startsWith('2026-11-')&&Math.round(row.amount*100)===49300&&/\bdigitpro\b/.test(norm(`${row.parentCategory} ${row.subCategory}`))&&/\bik\b/.test(norm(`${row.parentCategory} ${row.subCategory}`)));
 if(candidates.length!==2)return null;
 return [...candidates].sort((a,b)=>a.date.localeCompare(b.date)||a.sourceRow-b.sourceRow)[0];
}

/** Owner-confirmed November NDF total of 820.06 euros counted twice. */
export function confirmedNovemberNdfDuplicate(rows:readonly BankinPiloteRow[]){
 const candidates=rows.filter(row=>row.date.startsWith('2026-11-')&&Math.round(row.amount*100)===41003&&/\bdigitpro\b/.test(norm(`${row.parentCategory} ${row.subCategory}`))&&/\bndf\b/.test(norm(`${row.parentCategory} ${row.subCategory}`)));
 if(candidates.length!==2)return null;
 return [...candidates].sort((a,b)=>a.date.localeCompare(b.date)||a.sourceRow-b.sourceRow)[0];
}
