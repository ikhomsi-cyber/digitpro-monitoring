import { piloteExpenseView, type PiloteMonth } from "./pilote";
const destinations = [
  {id:"ES",name:"Espagne",terms:/\b(espagne|minorque|tenerife|salou|lloret|costa del sol|benalmadina)\b/},
  {id:"TR",name:"Turquie",terms:/\b(turquie|bodrum|antalya|istanbul)\b/},
  {id:"GR",name:"Grèce",terms:/\b(grece|kos)\b/},
  {id:"MA",name:"Maroc",terms:/\b(maroc|marrakech)\b/},
  {id:"FR",name:"France",terms:/\b(france|lyon)\b/},
  {id:"EG",name:"Égypte",terms:/\b(egypte)\b/},
  {id:"GB",name:"Royaume-Uni",terms:/\b(london|londres|royaume.uni)\b/},
  {id:"CH",name:"Suisse",terms:/\b(suisse)\b/},
  {id:"BE",name:"Belgique",terms:/\b(brugge|bruges|belgique)\b/},
  {id:"NL",name:"Pays-Bas",terms:/\b(amsterdam|pays.bas)\b/},
  {id:"MV",name:"Maldives",terms:/\b(maldives)\b/},
  {id:"ID",name:"Indonésie",terms:/\b(bali|indonesie)\b/},
];
const fold=(s:string)=>s.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();
export function buildPiloteTravel(months: PiloteMonth[]) {
  const countries = new Map<string,{id:string;name:string;amount:number;trips:Set<string>}>();
  const shared = new Map<string,number>(); let total=0;
  for(const month of months) for(const parent of month.categories) for(const sub of parent.children) {
    if(piloteExpenseView(parent.name,sub.name)!=="travel") continue;
    const amount=Math.round(sub.expenses*100); total+=amount;
    const parentMatches=destinations.filter(d=>d.terms.test(fold(parent.name)));
    const subMatches=destinations.filter(d=>d.terms.test(fold(sub.name)));
    const matches=subMatches.length?subMatches:parentMatches;
    for(const destination of matches){const c=countries.get(destination.id)??{id:destination.id,name:destination.name,amount:0,trips:new Set<string>()};c.trips.add(parent.name);if(matches.length===1)c.amount+=amount;countries.set(c.id,c);}
    if(matches.length!==1)shared.set(parent.name,(shared.get(parent.name)??0)+amount);
  }
  return {total:total/100,countries:[...countries.values()].map(c=>({...c,amount:c.amount/100,trips:[...c.trips]})).sort((a,b)=>b.amount-a.amount),shared:[...shared].map(([name,amount])=>({name,amount:amount/100}))};
}
