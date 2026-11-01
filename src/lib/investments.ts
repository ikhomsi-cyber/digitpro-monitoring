import {addPiloteMoroccoRent,buildPiloteMonths,piloteReportingCategories,type BankinPiloteSnapshot,type BankinPiloteRow} from './pilote';
import {LMNP_PROPERTY} from './lmnp-config';
import {isLmnpExpense} from './lmnp-analyze';
export type InvestmentMonth={month:string;bankRent:number;declaredRent:number;charges:number;gain:number};
export type RentalInvestment={id:'casa'|'argenteuil';name:string;city:string;purchaseAmount:number|null;purchaseDate:string|null;purchaseCount:number;months:InvestmentMonth[]};
export type PerInvestment={contributions:number|null;withdrawals:number;netContributions:number|null;count:number;years:{year:string;contributions:number;withdrawals:number}[]};
export type InvestmentsReport={asOf:string;importedAt:string|null;hasSource:boolean;years:string[];properties:RentalInvestment[];per:PerInvestment};
const fold=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const cents=(value:number)=>Math.round(value*100),euro=(value:number)=>value/100;
const CASA_PURCHASE=new Set(['appart casa','appart casablanca']);
const ARGENTEUIL_PURCHASE=new Set(['appart argenteuil','appart argneteuil','achat argenteuil','achat appartement argenteuil']);
function valid(row:BankinPiloteRow,asOf:string){const date=new Date(`${row.date}T00:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===row.date&&row.date<=asOf&&Number.isFinite(row.amount);}
function hasCasa(text:string){return /\b(casa|casablanca|maroc)\b/.test(text);}
/** Original Bankin rows are the only transaction source. No app/Qonto duplicates or market valuations. */
export function buildInvestments(snapshot:BankinPiloteSnapshot|null,asOf:string):InvestmentsReport{
 const excluded=new Set(snapshot?.excludedRowIdentities??[]);
 const rows=(snapshot?.rows??[]).filter(row=>valid(row,asOf)&&(!row.identity||!excluded.has(row.identity)));
 // Explicit user confirmations. Ambiguous equal-amount transfers are never guessed.
 const confirmedPer=new Set<BankinPiloteRow>();
 for(const rule of [{month:'2025-11',amount:-3000000,recipient:false},{month:'2026-09',amount:-1700000,recipient:true}]){
  const candidates=rows.filter(row=>row.date.startsWith(rule.month)&&cents(row.amount)===rule.amount);
  const named=rule.recipient?candidates.filter(row=>/\bmeryeme?\b/.test(fold(`${row.label??''} ${row.parentCategory} ${row.subCategory}`))):candidates;
  const match=named.length===1?named[0]:candidates.length===1?candidates[0]:null;
  if(match)confirmedPer.add(match);
 }
 const properties:RentalInvestment[]=[{id:'casa',name:'Maison Casa',city:'Casablanca',purchaseAmount:null,purchaseDate:null,purchaseCount:0,months:[]},{id:'argenteuil',name:'Argenteuil',city:'Argenteuil · LMNP',purchaseAmount:null,purchaseDate:null,purchaseCount:0,months:[]}];
 const propertyMonths=new Map<string,Map<string,{bankRent:number;declaredRent:number;charges:number}>>();
 const monthFor=(id:string,month:string)=>{const map=propertyMonths.get(id)??new Map();propertyMonths.set(id,map);const value=map.get(month)??{bankRent:0,declaredRent:0,charges:0};map.set(month,value);return value;};
 const perYears=new Map<string,{contributions:number;withdrawals:number;count:number}>();
 for(const row of rows){
  const categories=piloteReportingCategories(row),sub=fold(categories.sub),category=fold(`${categories.parent} ${categories.sub}`),blob=fold(`${category} ${row.label??''}`);
  if(confirmedPer.has(row)||/\b(per|perin|perco|percol|perp)\b|\bepargne retraite\b/.test(category)){
   const year=row.date.slice(0,4),entry=perYears.get(year)??{contributions:0,withdrawals:0,count:0};
   if(row.amount<0)entry.contributions-=cents(row.amount);else entry.withdrawals+=cents(row.amount);entry.count++;perYears.set(year,entry);continue;
  }
  const parent=fold(categories.parent);
  const property=CASA_PURCHASE.has(sub)||CASA_PURCHASE.has(parent)?properties[0]:ARGENTEUIL_PURCHASE.has(sub)||ARGENTEUIL_PURCHASE.has(parent)?properties[1]:null;
  if(property&&row.amount<0){property.purchaseAmount=euro(cents(property.purchaseAmount??0)-cents(row.amount));property.purchaseCount++;if(!property.purchaseDate||row.date<property.purchaseDate)property.purchaseDate=row.date;continue;}
  // Transfers hidden from the expense budget remain investment contributions when explicitly tagged PER.
  if(row.hidden)continue;
  const rentalCategory=[parent,sub].some(value=>/^entrees? locati(?:f|fs|ve|ves)$/.test(value));
  const casaRental=hasCasa(blob)&&/\bloyers?\b/.test(category);
  if(row.amount>0&&(rentalCategory||casaRental)){const id=casaRental?'casa':'argenteuil';if(id==='argenteuil'&&row.date<LMNP_PROPERTY.purchaseDateIso)continue;monthFor(id,row.date.slice(0,7)).bankRent+=cents(row.amount);continue;}
  if(row.amount>=0)continue;
  const tx={id:String(row.sourceRow),date:row.date,label:row.label??'',company:'',category:`${row.parentCategory} › ${row.subCategory}`,amount:row.amount,scope:'personal' as const};
  if(hasCasa(blob)&&/\b(charges?|travaux|taxe|fonciere|assurance|gestion|entretien|copropriete)\b/.test(blob))monthFor('casa',row.date.slice(0,7)).charges-=cents(row.amount);
  else if(!hasCasa(blob)&&row.date>=LMNP_PROPERTY.purchaseDateIso&&([parent,sub].some(value=>value==='charges lmnp')||isLmnpExpense(tx)))monthFor('argenteuil',row.date.slice(0,7)).charges-=cents(row.amount);
 }
 // Reuse Pilote's declared Morocco rent only for months actually covered by imported reporting data.
 // An identified Casa bank receipt replaces the declaration for that month, never doubles it.
 for(const month of buildPiloteMonths(rows).filter(month=>month.month<=asOf.slice(0,7))){
  const augmented=addPiloteMoroccoRent(month),declared=cents(augmented.income)-cents(month.income);
  if(declared>0){const value=monthFor('casa',month.month);if(!value.bankRent)value.declaredRent=declared;}
 }
 for(const property of properties){property.months=[...(propertyMonths.get(property.id)??[])].sort(([a],[b])=>a.localeCompare(b)).map(([month,value])=>({month,bankRent:euro(value.bankRent),declaredRent:euro(value.declaredRent),charges:euro(value.charges),gain:euro(value.bankRent+value.declaredRent-value.charges)}));}
 const perRows=[...perYears].sort(([a],[b])=>a.localeCompare(b));const perCount=perRows.reduce((sum,[,value])=>sum+value.count,0);
 const contributions=perRows.reduce((sum,[,value])=>sum+value.contributions,0),withdrawals=perRows.reduce((sum,[,value])=>sum+value.withdrawals,0);
 const years=[...new Set([...rows.map(row=>row.date.slice(0,4)),...properties.flatMap(property=>property.months.map(month=>month.month.slice(0,4)))])].sort().reverse();
 return {asOf,importedAt:snapshot?.importedAt??null,hasSource:!!snapshot?.rows?.length,years,properties,per:{contributions:perCount?euro(contributions):null,withdrawals:euro(withdrawals),netContributions:perCount?euro(contributions-withdrawals):null,count:perCount,years:perRows.map(([year,value])=>({year,contributions:euro(value.contributions),withdrawals:euro(value.withdrawals)}))}};
}
export function rentalInvestmentTotals(property:RentalInvestment,year?:string){
 const months=property.months.filter(month=>!year||month.month.startsWith(year));
 const total=(key:'bankRent'|'declaredRent'|'charges'|'gain')=>euro(months.reduce((sum,month)=>sum+cents(month[key]),0));
 return {bankRent:total('bankRent'),declaredRent:total('declaredRent'),income:euro(cents(total('bankRent'))+cents(total('declaredRent'))),charges:total('charges'),gain:total('gain'),hasActivity:months.length>0};
}

/** Bounded investment context for the already-authorized first-party assistant. */
export function investmentAssistantSummary(report:InvestmentsReport){
 return {asOf:report.asOf,hasSource:report.hasSource,properties:report.properties.map(property=>({name:property.name,purchaseAmount:property.purchaseAmount,...rentalInvestmentTotals(property)})),per:report.per};
}
export type InvestmentAssistantSummary=ReturnType<typeof investmentAssistantSummary>;
