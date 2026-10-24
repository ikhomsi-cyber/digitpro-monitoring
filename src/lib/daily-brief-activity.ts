import type { DashboardTx } from "@/lib/dashboard-metrics";
import { isRevenueCategory } from "@/lib/revenue-category";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { withOutstandingInvoiceCsg } from "@/lib/dashboard-invoice-stats";
import { outstandingHiwayInvoices } from "@/lib/hiway-invoice-aggregate";
import { resolveBillableTjmForMonth, type BillableRatePeriod } from "@/lib/billable-client-days";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
export type BriefWorkSettings={days:string[];tjm:number|null;rates:BillableRatePeriod[]};
export type BriefActivity={workedMonth:number|null;plannedMonth:number|null;workedYear:number|null;yearRevenueHt:number;previousYearRevenueHt:number|null;yearChangePercent:number|null;nextInvoice:{kind:"issued"|"estimate";amountHt:number;dueDate:string|null;days:number|null}|null;treasury:{cash:number;debt172:number;shortfall:number;projectedShortfall:number|null;projectedMargin:number|null}|null};
const round=(n:number)=>Math.round(n*100)/100;
export function previousYearCutoff(date:string){const year=Number(date.slice(0,4))-1;const month=Number(date.slice(5,7));const day=Math.min(Number(date.slice(8)),new Date(Date.UTC(year,month,0)).getUTCDate());return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;}
export function buildBriefActivity({date,transactions,settings,invoices,cash}:{date:string;transactions:DashboardTx[];settings:BriefWorkSettings|null;invoices:HiwayInvoice[]|null;cash:number|null}):BriefActivity{
 const now=new Date(`${date}T12:00:00Z`),year=date.slice(0,4),month=date.slice(0,7),previousEnd=previousYearCutoff(date),previousYear=previousEnd.slice(0,4);
 const rows=transactions.filter(t=>(t.scope??"pro")==="pro"&&t.date<=date&&Number.isFinite(t.amount));
 const revenues=rows.filter(t=>t.amount>0&&isRevenueCategory(t.category));
 const annual=(prefix:string,end:string)=>round(revenues.filter(t=>t.date.startsWith(prefix)&&t.date<=end).reduce((n,t)=>n+t.amount/1.2,0));
 const annualCurrent=annual(year,date),previous=annual(previousYear,previousEnd);
 const hasPrevious=revenues.some(t=>t.date.startsWith(previousYear)&&t.date<=previousEnd);
 const days=settings?[...new Set(settings.days)].filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&day.startsWith(year)):null;
 const monthDays=days?.filter(day=>day.startsWith(month));
 const workedMonth=monthDays?.filter(day=>day<=date).length??null,plannedMonth=monthDays?.filter(day=>day>date).length??null;
 const knownInvoices=invoices?.filter(i=>i.amountKind!=="inconnu"&&i.date<=date)??null;
 const outstanding=outstandingHiwayInvoices(knownInvoices,rows,now).sort((a,b)=>(a.dueDate??a.date).localeCompare(b.dueDate??b.date));
 const first=outstanding[0];
 let nextInvoice:BriefActivity["nextInvoice"]=first?{kind:"issued",amountHt:round(first.amountHt),dueDate:first.dueDate??null,days:null}:null;
 if(!nextInvoice&&invoices!==null&&monthDays?.length&&settings?.tjm&&settings.tjm>0&&!invoices.some(i=>i.date.startsWith(month))){
  const rate=resolveBillableTjmForMonth(settings.rates,month,settings.tjm);
  nextInvoice={kind:"estimate",amountHt:round(monthDays.length*rate),dueDate:null,days:monthDays.length};
 }
 let treasury:BriefActivity["treasury"]=null;
 // A complete transaction history and a known invoice source are required for debt coverage.
 const uncertainInvoices=invoices?.some(i=>i.date<=date&&(i.amountKind==="inconnu"||i.amountEur===null||!Number.isFinite(i.amountEur)))??true;
 if(cash!==null&&Number.isFinite(cash)&&invoices!==null&&!uncertainInvoices){
  const base=computeDashboardHeroStats(rows,now,{qontoLiveBalanceEur:cash});
  const stats=withOutstandingInvoiceCsg(base,knownInvoices,rows,now);
  const debt172=round(stats.csgComparaison172Eur+stats.detteTvaDepuisDebutEur);
  const extraTax=nextInvoice?nextInvoice.amountHt*(.2+(nextInvoice.kind==="estimate"?.172:0)):0;
  const projectedMargin=nextInvoice?round(cash+nextInvoice.amountHt*1.2-debt172-extraTax):null;
  treasury={cash,debt172,shortfall:round(Math.max(0,debt172-cash)),projectedShortfall:projectedMargin===null?null:round(Math.max(0,-projectedMargin)),projectedMargin};
 }
 return {workedMonth,plannedMonth,workedYear:days?.filter(day=>day<=date).length??null,yearRevenueHt:annualCurrent,previousYearRevenueHt:hasPrevious?previous:null,yearChangePercent:hasPrevious&&previous>0?round((annualCurrent-previous)/previous*100):null,nextInvoice,treasury};
}
