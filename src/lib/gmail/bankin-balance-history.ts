import {mergeBankinBalancePoints,type BankinBalancePoint} from './bankin-balance-parser';
export function bankinBalanceHistory(points:BankinBalancePoint[]){
 const daily=mergeBankinBalancePoints(points.filter(point=>/\bfortuneo\b/i.test(point.account))),banks=new Map<string,BankinBalancePoint[]>();
 for(const point of daily){const bank=point.account.includes(' · ')?point.account.split(' · ')[0]:point.account;const rows=banks.get(bank)??[];rows.push(point);banks.set(bank,rows);}
 return [...banks].map(([bank,rows])=>{
  const accounts=[...new Set(rows.map(p=>p.account))];
  const dates=[...new Set(rows.map(p=>p.date))].sort();
  // Only compare dates where every observed account of this bank is present.
  const history=dates.flatMap(date=>{const day=rows.filter(p=>p.date===date);return day.length===accounts.length?[{account:bank,date,balance:Math.round(day.reduce((sum,p)=>sum+p.balance,0)*100)/100}]:[];});
  const annual=[...new Set(history.map(p=>p.date.slice(0,4)))].sort().map(year=>{const samples=history.filter(p=>p.date.startsWith(year));const minimum=Math.min(...samples.map(p=>p.balance));return {year,minimum,zaka:Math.round(Math.max(0,minimum)*2.5)/100,observations:samples.length};});
  return {bank,accounts,history,annual};
 });
}
