import {buildBankinPiloteSnapshot,isPiloteReportRow,type BankinPiloteSnapshot,type BankinPiloteRow} from "@/lib/pilote";
const cents=(value:number)=>Math.round(value*100);
const norm=(name:string)=>name.trim().replace(/\.$/,"");
type Rule={old:number;current?:number;date:string;currentDate?:string;expense:number;parent:string;category:string;reason:string};
/** Exact source occurrences established during the owner-requested Bankin reconciliation. */
export const OCTOBER_RULES:Rule[]=[
 {old:12,current:11879,date:"2026-10-16",currentDate:"2026-10-19",expense:3.58,parent:"Alimentation & Restau",category:"Supermarché / Epicerie",reason:"date updated"},
 {old:13,current:11880,date:"2026-10-16",currentDate:"2026-10-16",expense:5.6,parent:"Alimentation & Restau",category:"Café",reason:"second imported identity"},
 {old:11901,current:11910,date:"2026-10-25",currentDate:"2026-10-26",expense:6.02,parent:"Alimentation & Restau",category:"Supermarché / Epicerie",reason:"date updated"},
 {old:11873,current:11894,date:"2026-10-21",currentDate:"2026-10-22",expense:30.02,parent:"Auto & Transports",category:"Carburant",reason:"date and description updated"},
 {old:11874,current:11895,date:"2026-10-21",currentDate:"2026-10-21",expense:44.88,parent:"Auto & Transports",category:"Transports en commun",reason:"second imported identity"},
 {old:11872,current:11893,date:"2026-10-21",currentDate:"2026-10-22",expense:72.4,parent:"Loisirs & Sorties",category:"NDF DigitPro",reason:"date updated"},
 {old:11902,current:11909,date:"2026-10-24",currentDate:"2026-10-26",expense:78.5,parent:"Loisirs & Sorties",category:"NDF DigitPro",reason:"date updated"},
 {old:11905,current:11915,date:"2026-10-24",currentDate:"2026-10-26",expense:14.99,parent:"Loisirs & Sorties",category:"NDF DigitPro",reason:"date updated"},
 {old:11903,current:11911,date:"2026-10-24",currentDate:"2026-10-26",expense:20,parent:"Scolarité & Enfants",category:"Jouets",reason:"date updated"},
 {old:11904,current:11914,date:"2026-10-24",currentDate:"2026-10-26",expense:10,parent:"Scolarité & Enfants",category:"Jouets",reason:"date updated"},
 {old:11871,current:11876,date:"2026-10-16",currentDate:"2026-10-19",expense:10,parent:"Divers",category:"Dons",reason:"date updated"},
 {old:11906,current:11920,date:"2026-10-29",currentDate:"2026-10-30",expense:20,parent:"Dépenses pro",category:"Dépenses pro - Autres",reason:"date updated"},
 {old:11891,date:"2026-10-20",expense:41.97,parent:"Achats & Shopping",category:"Achats & Shopping - Autres",reason:"Utilisation Avantages absent from Bankin analysis"},
 {old:11889,date:"2026-10-20",expense:3.76,parent:"Alimentation & Restau",category:"Carrefour",reason:"Utilisation Avantages absent from Bankin analysis"},
];
export const OCTOBER_BANKIN_TARGETS=[
 {parent:"Impôts & Taxes",expense:5760,count:1},{parent:"Logement",expense:1507.21,count:3},
 {parent:"Alimentation & Restau",expense:630.01,count:27},{parent:"Auto & Transports",expense:462.7,count:5},
 {parent:"Loisirs & Sorties",expense:353.79,count:5},{parent:"Voyage Minorque 26",expense:301.46,count:1},
 {parent:"Scolarité & Enfants",expense:177.97,count:4},{parent:"Charges LMNP",expense:196.99,count:2},
 {parent:"Divers",expense:57,count:3},{parent:"Dépenses pro",expense:20,count:1},
 {parent:"Achats & Shopping",expense:9.99,count:1},{parent:"Banque",expense:4.5,count:3},
];
export function repairConfirmedOctober(snapshot:BankinPiloteSnapshot,excludeJojo=false):BankinPiloteSnapshot|null{
 if(!snapshot.rows)throw new Error("Détail source manquant.");
 const jojoAlreadyExcluded=snapshot.rows.some(r=>r.sourceRow===11907&&r.hidden&&r.identity&&snapshot.excludedRowIdentities?.includes(r.identity));
 excludeJojo=excludeJojo||jojoAlreadyExcluded;
 const rules=[...OCTOBER_RULES,...(excludeJojo?[{old:11907,date:"2026-10-29",expense:5.78,parent:"Alimentation & Restau",category:"Supermarché / Epicerie",reason:"Owner confirmed absent from Bankin analysis"}]:[])];
 const remove=new Set<BankinPiloteRow>();
 for(const rule of rules){
  const old=snapshot.rows.find(r=>r.sourceRow===rule.old);
  const matches=(r:BankinPiloteRow|undefined,date:string)=>r&&r.date===date&&cents(r.amount)===-cents(rule.expense)&&norm(r.parentCategory)===rule.parent&&r.subCategory===rule.category&&!!r.identity;
  if(!matches(old,rule.date))throw new Error("La source a changé : rapprochement à refaire.");
  if(rule.current){const current=snapshot.rows.find(r=>r.sourceRow===rule.current);if(!matches(current,rule.currentDate!)||current!.hidden||current!.identity===old!.identity)throw new Error("Contrepartie source ambiguë.");}
  if(!old!.hidden)remove.add(old!);
 }
 const rows=snapshot.rows.map(r=>remove.has(r)?{...r,hidden:true}:r);
 const eligible=rows.filter(r=>r.date.startsWith("2026-10-")&&r.amount<0&&isPiloteReportRow(r));
 const groups=new Map<string,{amount:number;count:number}>();
 for(const row of eligible){const k=norm(row.parentCategory),g=groups.get(k)??{amount:0,count:0};g.amount-=cents(row.amount);g.count++;groups.set(k,g);}
 if(groups.size!==OCTOBER_BANKIN_TARGETS.length)throw new Error("Catégories sources inattendues.");
 for(const target of OCTOBER_BANKIN_TARGETS){const g=groups.get(target.parent);const unresolved=!excludeJojo&&target.parent==="Alimentation & Restau";
  if(g?.amount!==cents(target.expense)+(unresolved?578:0)||g?.count!==target.count+(unresolved?1:0))throw new Error("Les lignes rapprochées ne correspondent pas aux catégories Bankin confirmées.");
 }
 if(!remove.size)return null;
 return {...snapshot,...buildBankinPiloteSnapshot(rows,snapshot.sourceFilename,snapshot.fileHash),importedAt:snapshot.importedAt,
  excludedRowIdentities:[...new Set([...(snapshot.excludedRowIdentities??[]),...Array.from(remove,r=>r.identity!)])]};
}
