import {buildBankinPiloteSnapshot,type BankinPiloteRow} from './pilote';
import {buildInvestments} from './investments';
export function demoInvestments(asOf:string){
 const rows:BankinPiloteRow[]=[];
 const add=(date:string,amount:number,parentCategory:string,subCategory:string)=>rows.push({date,amount,parentCategory,subCategory,hidden:false,sourceRow:rows.length+2});
 add('2023-01-15',-150000,'Immobilier','Appart Argenteuil');add('2024-03-10',-90000,'Immobilier','Appart Casa');
 add('2024-11-10',-30000,'Banque','Epargne');add('2026-09-07',-30000,'Banque','Epargne');
 for(let year=2023;year<=2026;year++)for(let month=1;month<=12;month++){
  const prefix=`${year}-${String(month).padStart(2,'0')}`;if(`${prefix}-15`>asOf)continue;
  add(`${prefix}-15`,750,'Entrée locatif','Loyers Reçus');add(`${prefix}-16`,-85,'Charges LMNP','Charges copropriété');
 }
 const snapshot=buildBankinPiloteSnapshot(rows,'Démonstration synthétique','demo');return buildInvestments(snapshot,asOf);
}
