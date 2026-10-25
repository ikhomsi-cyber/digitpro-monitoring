import { isPiloteReportRow, buildPiloteMonths, buildPiloteYear, buildPiloteCompensations, filterPiloteIncome, filterPiloteExpenses, addPiloteMoroccoRent, type BankinPiloteSnapshot, type PiloteExpenseView } from "@/lib/pilote";
import { pilotePocketTotals } from "./pilote-pocket";
export type HouseholdYearComparison={year:number;cutoff:string;outOfPocket:number|null;monthOutOfPocket:number|null};
/** Same source rules, compensation families and expense views as Pilote, at matching historical cutoffs. */
export function householdOutOfPocketHistory(snapshot:BankinPiloteSnapshot|null,date:string,views:readonly PiloteExpenseView[]=["essential"]):HouseholdYearComparison[]{
 return Array.from({length:4},(_,offset)=>{
  const year=Number(date.slice(0,4))-offset;
  const day=Math.min(Number(date.slice(8)),new Date(Date.UTC(year,Number(date.slice(5,7)),0)).getUTCDate());
  const cutoff=`${year}-${date.slice(5,7)}-${String(day).padStart(2,"0")}`;
  const empty={year,cutoff,outOfPocket:null,monthOutOfPocket:null};
  if(!snapshot?.rows?.length)return empty;
  const rows=snapshot.rows.filter(row=>row&&typeof row.date==="string"&&typeof row.parentCategory==="string"&&typeof row.subCategory==="string"&&typeof row.sourceRow==="number"&&row.date<=cutoff&&isPiloteReportRow(row));
  if(!rows.some(row=>row.date.startsWith(`${year}-`)))return empty;
  const months=buildPiloteMonths(rows).filter(m=>m.month.startsWith(`${year}-`)&&m.month<=cutoff.slice(0,7)).map(filterPiloteIncome).map(addPiloteMoroccoRent);
  const annual=buildPiloteYear(months,String(year));const month=months.find(m=>m.month===cutoff.slice(0,7));
  const remaining=(period:NonNullable<typeof annual>)=>pilotePocketTotals(buildPiloteCompensations(filterPiloteExpenses(period,views),months)).remainingCents/100;
  return {year,cutoff,outOfPocket:annual?remaining(annual):null,monthOutOfPocket:month?remaining(month):null};
 });
}
