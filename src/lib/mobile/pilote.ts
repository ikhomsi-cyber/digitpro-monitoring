import { buildPiloteDaily, cumulativePiloteDays } from "@/lib/bankin/pilote-daily";
import { addPiloteMoroccoRent, piloteSnapshotMonths, filterPiloteIncome, filterPiloteExpenses, buildPiloteYear, buildPiloteCompensations, piloteCompensationFamily, piloteIncomeFamily, type BankinPiloteSnapshot, type PiloteExpenseView, type PiloteGroup } from "@/lib/pilote";
import { buildPiloteTravel } from "@/lib/pilote-travel";
export type MobilePiloteOptions = { period?: string; views: PiloteExpenseView[]; travelScope: "history" | "year" | "period"; travelYear?: string };
const money=(n:number)=>Math.round(n*100)/100;
export function buildMobilePilote(snapshot: BankinPiloteSnapshot | null, options: MobilePiloteOptions, now=new Date()) {
  const months=snapshot?piloteSnapshotMonths(snapshot).map(filterPiloteIncome).map(addPiloteMoroccoRent):[];
  const currentYear=new Intl.DateTimeFormat("en",{year:"numeric",timeZone:"Europe/Paris"}).format(now);
  const period=options.period??months.at(-1)?.month??null;
  const source=period?.length===4?buildPiloteYear(months,period):months.find(m=>m.month===period);
  const expenseViews: PiloteExpenseView[]=options.views.includes("secondary")&&!options.views.includes("taxes")&&!options.views.includes("savings")?[...options.views,"taxes","savings"]:options.views;
  const current=source?filterPiloteExpenses(source,expenseViews):undefined;
  const incomeMonths=period?.length===4?months.filter(m=>m.month.startsWith(`${period}-`)):source?[source]:[];
  const mergeRows=(groups:PiloteGroup[],income:boolean,family:string)=>{
    const rows=new Map<string,{parent:string;name:string;amount:number}>();
    for(const parent of groups)for(const sub of parent.children){
      const id=income?piloteIncomeFamily(period??"",parent.name,sub.name,sub.income):piloteCompensationFamily(parent.name,sub.name,false);
      if(id!==family)continue;
      const key=JSON.stringify([parent.name,sub.name]);const previous=rows.get(key);
      rows.set(key,{parent:parent.name,name:sub.name,amount:money((previous?.amount??0)+(income?sub.income:sub.expenses))});
    }
    return [...rows.values()];
  };
  const families=current?buildPiloteCompensations(current,months).map(family=>{
    // Income corrections are evaluated month by month, matching the web.
    const incomeRows=new Map<string,{parent:string;name:string;amount:number}>();
    for(const month of incomeMonths)for(const parent of month.incomeCategories)for(const sub of parent.children){
      if(piloteIncomeFamily(month.month,parent.name,sub.name,sub.income)!==family.id)continue;
      const key=JSON.stringify([parent.name,sub.name]);const old=incomeRows.get(key);
      incomeRows.set(key,{parent:parent.name,name:sub.name,amount:money((old?.amount??0)+sub.income)});
    }
    const rows=[...incomeRows.values()];const moroccoIncome=rows.filter(r=>r.parent==="Loyer Maroc ajouté").reduce((s,r)=>s+r.amount,0);
    return {...family,moroccoIncome,withoutMoroccoBalance:money(family.balance-moroccoIncome),expenseRows:mergeRows(current.categories,false,family.id),incomeRows:rows};
  }):[];
  const travelYear=options.travelYear??currentYear;
  const travelMonths=options.travelScope==="history"?months:months.filter(m=>options.travelScope==="year"?m.month.startsWith(`${travelYear}-`):period?.length===4?m.month.startsWith(`${period}-`):m.month===period);
  const travel=buildPiloteTravel(travelMonths);
  const entries=[...travel.envelopes.map(e=>({id:e.id,name:e.countryIds.map(id=>travel.countries.find(c=>c.id===id)?.name).join(" + "),subtitle:e.name,amount:e.amount,countryIds:e.countryIds,posts:e.posts})),...travel.standalone.map(c=>({id:c.id,name:travel.countries.find(country=>country.id===c.id)!.name,subtitle:travel.countries.find(country=>country.id===c.id)!.places.map(p=>p.name).join(" · "),countryIds:[c.id],amount:c.amount,posts:c.posts}))];
  const daily = snapshot && period?.length === 7 && current ? buildPiloteDaily(snapshot)?.[period] : undefined;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);
  const throughDay = period && period > today.slice(0, 7) ? 0 : period === today.slice(0, 7) ? Number(today.slice(8, 10)) : daily?.length ?? 0;
  const points = daily ? cumulativePiloteDays(daily, [...new Set(expenseViews)], throughDay) : [];
  const dailyCoverage = daily && period ? { month: period, daysInMonth: daily.length, points, firstDeficit: points.find(point => point.balance < 0) ?? null } : null;
  return {version:1,dailyCoverage,months:months.map(m=>m.month),years:[...new Set(months.map(m=>m.month.slice(0,4)))].sort().reverse(),period,views:options.views,
    summary:current?{income:current.income,expenses:current.expenses,balance:current.balance,coveragePercent:current.expenses>0?Math.round(current.income/current.expenses*100):100}:null,
    families,categories:current?.categories??[],incomeCategories:current?.incomeCategories??[],
    travel:{...travel,entries,scope:options.travelScope,year:travelYear,years:[...new Set([currentYear,...months.map(m=>m.month.slice(0,4))])].sort().reverse()}};
}
