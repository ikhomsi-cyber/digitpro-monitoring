import {addPiloteMoroccoRent,buildPiloteMonths,piloteReportingCategories,type BankinPiloteSnapshot,type BankinPiloteRow} from './pilote';
import {LMNP_PROPERTY} from './lmnp-config';
export type InvestmentMonth={month:string;bankRent:number;declaredRent:number;charges:number;gain:number};
export type RentalInvestment={id:'casa'|'argenteuil';name:string;city:string;purchaseAmount:number|null;purchaseDate:string|null;purchaseCount:number;chargeTransactions?:{date:string;amount:number}[];purchaseBreakdown?:{notary:number;works:number;other:number;price?:number;promise?:number;prorata?:number};months:InvestmentMonth[]};
export type PerInvestment={transactions?:{date:string;amount:number;kind:'contribution'|'withdrawal'}[];contributions:number|null;withdrawals:number;netContributions:number|null;count:number;years:{year:string;contributions:number;withdrawals:number}[]};
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
 const perTransactions:NonNullable<PerInvestment['transactions']>=[];
 const perYears=new Map<string,{contributions:number;withdrawals:number;count:number}>();
 for(const row of rows){
  // Sum the original Bankin Charges LMNP category before any investment inference.
  if([row.parentCategory,row.subCategory].some(value=>fold(value)==='charges lmnp')){
   if(row.amount<0&&!row.hidden){
    const property=properties[1];
    (property.chargeTransactions??=[]).push({date:row.date,amount:euro(-cents(row.amount))});
    monthFor('argenteuil',row.date.slice(0,7)).charges-=cents(row.amount);
   }
   continue;
  }
  const categories=piloteReportingCategories(row),sub=fold(categories.sub),category=fold(`${categories.parent} ${categories.sub}`),blob=fold(`${category} ${row.label??''}`);
  if(confirmedPer.has(row)||/\b(per|perin|perco|percol|perp)\b|\bepargne retraite\b/.test(category)){
   if(row.amount!==0)perTransactions.push({date:row.date,amount:Math.abs(row.amount),kind:row.amount<0?'contribution':'withdrawal'});
   const year=row.date.slice(0,4),entry=perYears.get(year)??{contributions:0,withdrawals:0,count:0};
   if(row.amount<0)entry.contributions-=cents(row.amount);else entry.withdrawals+=cents(row.amount);entry.count++;perYears.set(year,entry);continue;
  }
  const parent=fold(categories.parent);
  // Explicit Bankin category confirmed by the owner: capital works, not recurring rental charges.
  if(row.amount<0&&[parent,sub].some(value=>value==='travaux lmnp')){
   const property=properties[1],breakdown=property.purchaseBreakdown??{notary:0,works:0,other:0};
   breakdown.works=euro(cents(breakdown.works)-cents(row.amount));property.purchaseBreakdown=breakdown;continue;
  }
  const property=CASA_PURCHASE.has(sub)||CASA_PURCHASE.has(parent)?properties[0]:ARGENTEUIL_PURCHASE.has(sub)||ARGENTEUIL_PURCHASE.has(parent)?properties[1]:null;
  if(property&&row.amount<0){
   property.purchaseAmount=euro(cents(property.purchaseAmount??0)-cents(row.amount));property.purchaseCount++;
   if(property.id==='argenteuil'){
    const breakdown=property.purchaseBreakdown??{notary:0,works:0,other:0};
    const notary=/\b(notaire|notaires|notarial|notariaux|notarie|etude notariale)\b/.test(blob),works=/\b(travaux|renovation|renovations|artisan|artisans)\b/.test(blob);
    // Ambiguous or unlabelled acquisition movements stay explicitly unclassified.
    const key=notary&&!works?'notary':'other';
    breakdown[key]=euro(cents(breakdown[key])-cents(row.amount));property.purchaseBreakdown=breakdown;
   }
   if(!property.purchaseDate||row.date<property.purchaseDate)property.purchaseDate=row.date;continue;
  }
  // Transfers hidden from the expense budget remain investment contributions when explicitly tagged PER.
  if(row.hidden)continue;
  const rentalCategory=[parent,sub].some(value=>/^(?:entrees? locati(?:f|fs|ve|ves)|loyers? recus?)$/.test(value));
  const casaRental=hasCasa(blob)&&/\bloyers?\b/.test(category);
  if(row.amount>0&&(rentalCategory||casaRental)){const id=casaRental?'casa':'argenteuil';if(id==='argenteuil'&&row.date<LMNP_PROPERTY.purchaseDateIso)continue;monthFor(id,row.date.slice(0,7)).bankRent+=cents(row.amount);continue;}
  if(row.amount>=0)continue;
  if(![parent,sub].some(value=>value==='charges lmnp')&&hasCasa(blob)&&/\b(charges?|travaux|taxe|fonciere|assurance|gestion|entretien|copropriete)\b/.test(blob))monthFor('casa',row.date.slice(0,7)).charges-=cents(row.amount);
 }
 // Acquisition amounts explicitly confirmed by the owner; replace imported acquisition totals, never add both.
 const argenteuil=properties[1];
 if(snapshot?.rows?.length){
  const works=argenteuil.purchaseBreakdown?.works??0;
  argenteuil.purchaseBreakdown={price:126000,promise:450,notary:10700,prorata:1496,works,other:0};
  argenteuil.purchaseAmount=euro(13864600+cents(works));
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
 return {asOf,importedAt:snapshot?.importedAt??null,hasSource:!!snapshot?.rows?.length,years,properties,per:{transactions:perTransactions.sort((a,b)=>b.date.localeCompare(a.date)),contributions:perCount?euro(contributions):null,withdrawals:euro(withdrawals),netContributions:perCount?euro(contributions-withdrawals):null,count:perCount,years:perRows.map(([year,value])=>({year,contributions:euro(value.contributions),withdrawals:euro(value.withdrawals)}))}};
}
export function rentalInvestmentTotals(property:RentalInvestment,year?:string){
 const months=property.months.filter(month=>!year||month.month.startsWith(year));
 const total=(key:'bankRent'|'declaredRent'|'charges'|'gain')=>euro(months.reduce((sum,month)=>sum+cents(month[key]),0));
 return {bankRent:total('bankRent'),declaredRent:total('declaredRent'),income:euro(cents(total('bankRent'))+cents(total('declaredRent'))),charges:total('charges'),gain:total('gain'),hasActivity:months.length>0};
}

/** Bounded investment context for the already-authorized first-party assistant. */
export function investmentAssistantSummary(report:InvestmentsReport){
 const {transactions: _transactions,...per}=report.per;
 return {asOf:report.asOf,hasSource:report.hasSource,properties:report.properties.map(property=>({name:property.name,purchaseAmount:property.purchaseAmount,...rentalInvestmentTotals(property)})),per};
}
export type InvestmentAssistantSummary=ReturnType<typeof investmentAssistantSummary>;
