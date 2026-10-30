import {filterPiloteExpenses,type PiloteMonth,type PiloteExpenseView} from "@/lib/pilote";
export function buildPilotePocketHistory(months: readonly PiloteMonth[], views: readonly PiloteExpenseView[], today: string) {
 const available = months.filter(month=>month.month<=today.slice(0,7)).sort((a,b)=>a.month.localeCompare(b.month));
 if(!available.length)return [];
 const byMonth=new Map(available.map(month=>[month.month,filterPiloteExpenses(month,views)]));
 const start=new Date(`${available[0].month}-01T12:00:00Z`),end=available.at(-1)!.month;
 const points:{month:string;balance:number|null}[]=[];
 for(let date=start;date.toISOString().slice(0,7)<=end;date=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1,12))){
  const month=date.toISOString().slice(0,7);points.push({month,balance:byMonth.get(month)?.balance??null});
 }
 return points;
}

export function filterPilotePocketHistoryYears<T extends {month:string}>(points:readonly T[],from:string,to:string):T[]{
 const [start,end]=[from,to].sort();
 return points.filter(point=>point.month.slice(0,4)>=start&&point.month.slice(0,4)<=end);
}
