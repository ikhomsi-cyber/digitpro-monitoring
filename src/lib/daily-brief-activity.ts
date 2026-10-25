import { amountNetOfRecoverableVat } from "@/lib/recoverable-expense-vat";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { countsTowardDashboardExpenseTotal, type DashboardTx } from "@/lib/dashboard-metrics";
import { isRevenueCategory } from "@/lib/revenue-category";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { withOutstandingInvoiceCsg } from "@/lib/dashboard-invoice-stats";
import { hiwayInvoiceHtEur, outstandingHiwayInvoices } from "@/lib/hiway-invoice-aggregate";
import { type BillableRatePeriod } from "@/lib/billable-client-days";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
export type BriefWorkSettings={days:string[];tjm:number|null;rates:BillableRatePeriod[]};
export type ActivityYearComparison={year:number;cutoff:string;generatedHt:number|null;cashedHt:number|null;workedDays:number|null;expensesHt:number|null;invoiceDays?:number|null;invoiceEstimatedDays?:number;invoiceCount?:number;historySource?:"calendar"|"gmail"|"mixed";historyBasis?:string};
export type BriefActivity={yearExpensesHt:number;previousYearExpensesHt:number|null;expenseChangePercent:number|null;generatedRevenueHt:number|null;generatedChangePercent:number|null;history:ActivityYearComparison[];workedMonth:number|null;plannedMonth:number|null;workedYear:number|null;yearRevenueHt:number;previousYearRevenueHt:number|null;yearChangePercent:number|null;nextInvoice:{kind:"issued"|"estimate";amountHt:number;invoiceAmountHt:number;reference:string|null;issuedDate:string;dueDate:string|null;days:number|null}|null;treasury:{availableTransferNow:number;availableTransferAfterInvoice:number|null;cash:number;debt172:number;shortfall:number;projectedShortfall:number|null;projectedMargin:number|null}|null};
const round=(n:number)=>Math.round(n*100)/100;
export function previousYearCutoff(date:string){const year=Number(date.slice(0,4))-1;const month=Number(date.slice(5,7));const day=Math.min(Number(date.slice(8)),new Date(Date.UTC(year,month,0)).getUTCDate());return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;}
export function buildBriefActivity({date,transactions,settings,invoices,cash}:{date:string;transactions:DashboardTx[];settings:BriefWorkSettings|null;invoices:HiwayInvoice[]|null;cash:number|null}):BriefActivity{
 const now=new Date(`${date}T12:00:00Z`),year=date.slice(0,4),month=date.slice(0,7),previousEnd=previousYearCutoff(date),previousYear=previousEnd.slice(0,4);
 const rows=transactions.filter(t=>(t.scope??"pro")==="pro"&&t.date<=date&&Number.isFinite(t.amount));
 const revenues=rows.filter(t=>t.amount>0&&isRevenueCategory(t.category));
 const annual=(prefix:string,end:string)=>round(revenues.filter(t=>t.date.startsWith(prefix)&&t.date<=end).reduce((n,t)=>n+t.amount/1.2,0));
 const annualCurrent=annual(year,date),previous=annual(previousYear,previousEnd);
 const hasPrevious=revenues.some(t=>t.date.startsWith(previousYear)&&t.date<=previousEnd);
 const expenses=rows.filter(countsTowardDashboardExpenseTotal);
 const annualExpenses=(prefix:string,end:string)=>round(expenses.filter(t=>t.date.startsWith(prefix)&&t.date<=end).reduce((sum,t)=>sum+amountNetOfRecoverableVat(t,deriveExpenseBucket(t),Math.abs(t.amount)),0));
 const yearExpensesHt=annualExpenses(year,date);
 const previousYearExpensesHt=rows.some(t=>t.date.startsWith(previousYear)&&t.date<=previousEnd)?annualExpenses(previousYear,previousEnd):null;
 const expenseChangePercent=previousYearExpensesHt!==null&&previousYearExpensesHt>0?round((yearExpensesHt-previousYearExpensesHt)/previousYearExpensesHt*100):null;
 const currentYear=Number(year);
 const history:ActivityYearComparison[]=Array.from({length:4},(_,offset)=>{
  const target=currentYear-offset;
  const cutoff=`${target}-${date.slice(5,7)}-${String(Math.min(Number(date.slice(8)),new Date(Date.UTC(target,Number(date.slice(5,7)),0)).getUTCDate())).padStart(2,"0")}`;
  const actualDays=settings?[...new Set(settings.days)].filter(d=>d.startsWith(`${target}-`)&&d<=cutoff):[];
  // Invoice month follows the existing Hiway activity convention (email issue date).
  // A billed month replaces calendar days for that month; never add both sources.
  const billedMonths=new Map<string,{amount:number;days:number|null;estimated:number;count:number}>();
  const seen=new Set<string>();
  for(const invoice of invoices??[]){
   if(!invoice.date.startsWith(`${target}-`)||invoice.date>cutoff||invoice.date>date||seen.has(invoice.id)||invoice.amountKind==="inconnu")continue;
   seen.add(invoice.id);
   const amount=hiwayInvoiceHtEur(invoice);if(!Number.isFinite(amount)||amount<=0)continue;
   const explicit=invoice.billedDays!==null&&Number.isFinite(invoice.billedDays)&&invoice.billedDays>0?invoice.billedDays:null;
   const rate=invoice.tjmHtEur;
   const inferred=explicit===null&&rate!==null&&Number.isFinite(rate)&&rate>0?amount/rate:null;
   const days=explicit??inferred;
   const key=invoice.date.slice(0,7),entry=billedMonths.get(key)??{amount:0,days:0,estimated:0,count:0};
   entry.amount+=amount;entry.days=entry.days===null||days===null?null:entry.days+days;
   entry.estimated+=inferred??0;entry.count++;billedMonths.set(key,entry);
  }
  const calendarDays=actualDays.filter(day=>!billedMonths.has(day.slice(0,7)));
  const hasHistory=billedMonths.size>0||actualDays.length>0||target===currentYear&&settings!==null;
  let generatedHt:number|null=hasHistory?[...billedMonths.values()].reduce((sum,m)=>sum+m.amount,0):null;
  if(generatedHt!==null)for(const day of calendarDays){
   const matches=(settings?.rates??[]).filter(rate=>rate.startDate<=day&&(!rate.endDate||rate.endDate>=day)&&rate.tjmHt>0).sort((a,b)=>b.startDate.localeCompare(a.startDate));
   const rate=matches[0]?.tjmHt??(target===currentYear&&!settings!.rates.length?settings!.tjm:null);
   if(!rate||!Number.isFinite(rate)){generatedHt=null;break;}
   generatedHt+=rate;
  }
  const billed=[...billedMonths.values()];
  const invoiceDays=billed.length&&billed.every(m=>m.days!==null)?round(billed.reduce((sum,m)=>sum+m.days!,0)):null;
  const hasReceipts=revenues.some(t=>t.date.startsWith(`${target}-`)&&t.date<=cutoff);
  return {year:target,cutoff,expensesHt:target===currentYear||rows.some(t=>t.date.startsWith(`${target}-`)&&t.date<=cutoff)?annualExpenses(`${target}`,cutoff):null,generatedHt:generatedHt===null?null:round(generatedHt),cashedHt:hasReceipts||target===currentYear?annual(`${target}`,cutoff):null,workedDays:hasHistory&&(!billed.length||invoiceDays!==null)?round(calendarDays.length+(invoiceDays??0)):null,invoiceDays,invoiceEstimatedDays:round(billed.reduce((sum,m)=>sum+m.estimated,0)),invoiceCount:billed.reduce((sum,m)=>sum+m.count,0),historySource:billed.length?(calendarDays.length?"mixed":"gmail"):"calendar",historyBasis:billed.length?"Factures Gmail émises au plus tard à la date de comparaison, rattachées au mois d’émission ; jours facturés, pas dates exactes de travail.":undefined};
 });
 const generatedRevenueHt=history[0].generatedHt,previousGenerated=history[1].generatedHt;
 const generatedChangePercent=generatedRevenueHt!==null&&previousGenerated!==null&&previousGenerated>0?round((generatedRevenueHt-previousGenerated)/previousGenerated*100):null;
 const days=settings?[...new Set(settings.days)].filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&day.startsWith(year)):null;
 const monthDays=days?.filter(day=>day.startsWith(month));
 const workedMonth=monthDays?.filter(day=>day<=date).length??null,plannedMonth=monthDays?.filter(day=>day>date).length??null;
 const knownInvoices=invoices?.filter(i=>i.amountKind!=="inconnu"&&i.date<=date)??null;
 const outstanding=outstandingHiwayInvoices(knownInvoices,rows,now).sort((a,b)=>(a.dueDate??a.date).localeCompare(b.dueDate??b.date));
 // The next scheduled receipt must not be replaced by an old, unmatched overdue balance.
 const first=outstanding.find(invoice=>invoice.dueDate&&invoice.dueDate>=date)??outstanding[0];
 const original=first?knownInvoices?.find(invoice=>invoice.date===first.date&&invoice.subject===first.subject):undefined;
 const reference=first?.subject?.match(/\bF\d+\b/i)?.[0]??null;
 const nextInvoice:BriefActivity["nextInvoice"]=first?{kind:"issued",amountHt:round(first.amountHt),invoiceAmountHt:round(original?hiwayInvoiceHtEur(original):first.amountHt),reference,issuedDate:first.date,dueDate:first.dueDate??null,days:original?.billedDays??null}:null;
 let treasury:BriefActivity["treasury"]=null;
 // A complete transaction history and a known invoice source are required for debt coverage.
 const uncertainInvoices=invoices?.some(i=>i.date<=date&&(i.amountKind==="inconnu"||i.amountEur===null||!Number.isFinite(i.amountEur)))??true;
 if(cash!==null&&Number.isFinite(cash)&&invoices!==null&&!uncertainInvoices){
  const base=computeDashboardHeroStats(rows,now,{qontoLiveBalanceEur:cash});
  const stats=withOutstandingInvoiceCsg(base,knownInvoices,rows,now);
  const debt172=round(stats.csgComparaison172Eur+stats.detteTvaDepuisDebutEur);
  const extraTax=nextInvoice?nextInvoice.invoiceAmountHt*.2+Math.max(0,nextInvoice.invoiceAmountHt-nextInvoice.amountHt)*.172:0;
  const projectedMargin=nextInvoice?round(cash+nextInvoice.invoiceAmountHt*1.2-debt172-extraTax):null;
  treasury={availableTransferNow:round(Math.max(0,cash-debt172)),availableTransferAfterInvoice:projectedMargin===null?null:round(Math.max(0,projectedMargin)),cash,debt172,shortfall:round(Math.max(0,debt172-cash)),projectedShortfall:projectedMargin===null?null:round(Math.max(0,-projectedMargin)),projectedMargin};
 }
 return {yearExpensesHt,previousYearExpensesHt,expenseChangePercent,generatedRevenueHt,generatedChangePercent,history,workedMonth,plannedMonth,workedYear:history[0].workedDays,yearRevenueHt:annualCurrent,previousYearRevenueHt:hasPrevious?previous:null,yearChangePercent:hasPrevious&&previous>0?round((annualCurrent-previous)/previous*100):null,nextInvoice,treasury};
}
