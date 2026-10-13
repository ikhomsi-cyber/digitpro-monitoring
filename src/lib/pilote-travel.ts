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
// City aliases are matched before country labels, so a city and its country
// do not receive two shares of the same expense.
const places: [string, string, string][] = [
  ["ES","Minorque","minorque"],["ES","Tenerife","tenerife"],
  ["ES","Salou","salou"],["ES","Lloret de Mar","lloret(?: de mar)?"],
  ["ES","Benalmádena","benalmadina|benalmadena"],["ES","Costa del Sol","costa del sol"],
  ["TR","Bodrum","bodrum"],["TR","Antalya","antalya"],["TR","Istanbul","istanbul"],
  ["GR","Kos","kos"],["MA","Marrakech","marrakech"],["FR","Lyon","lyon"],
  ["GB","Londres","london|londres"],["BE","Bruges","brugge|bruges"],
  ["NL","Amsterdam","amsterdam"],["ID","Bali","bali"],
];
function locate(label: string) {
  const text = fold(label);
  const cities = places.filter(([, , aliases]) => new RegExp(`\\b(${aliases})\\b`).test(text))
    .map(([id, name]) => ({id, name}));
  const countryOnly = destinations.filter(d => d.terms.test(text) && !cities.some(c => c.id === d.id))
    .map(d => ({id:d.id, name:d.name}));
  return [...cities, ...countryOnly];
}
// Land-border pairs among the destinations currently recognized by the app.
const neighbors=new Set(["ES:FR","ES:MA","FR:CH","BE:FR","BE:NL","GR:TR"].map(pair=>pair.split(":").sort().join(":")));
export function buildPiloteTravel(months: PiloteMonth[]) {
  type Place = {name:string;amount:number;estimated:number;posts:Map<string,{name:string;amount:number;estimated:number}>};
  const countries = new Map<string,{id:string;name:string;amount:number;trips:Set<string>;places:Map<string,Place>}>();
  const standalone=new Map<string,{id:string;amount:number;posts:Map<string,number>}>();
  const envelopes=new Map<string,{id:string;name:string;countryIds:string[];amount:number;posts:Map<string,number>;allocations:Map<string,number>}>();
  const shared = new Map<string,{amount:number;posts:Map<string,number>}>(); let total=0;
  for(const month of months) for(const parent of month.categories) for(const sub of parent.children) {
    if(piloteExpenseView(parent.name,sub.name)!=="travel") continue;
    const amount=Math.round(sub.expenses*100);
    if(amount<=0) continue;
    total+=amount;
    const subMatches=locate(sub.name);
    const matches=subMatches.length?subMatches:locate(parent.name);
    const parentIds=[...new Set(locate(parent.name).map(m=>m.id))].sort();
    const ids=parentIds.length===2 && neighbors.has(parentIds.join(":"))?parentIds:[...new Set(matches.map(m=>m.id))].sort();
    const joint=ids.length===2 && neighbors.has(ids.join(":"));
    const envelopeId=JSON.stringify([parent.name,ids]);
    const envelope=joint?(envelopes.get(envelopeId)??{id:envelopeId,name:parent.name,countryIds:ids,amount:0,posts:new Map<string,number>(),allocations:new Map<string,number>()}):null;
    if(envelope)for(const id of ids)if(!countries.has(id))countries.set(id,{id,name:destinations.find(d=>d.id===id)!.name,amount:0,trips:new Set([parent.name]),places:new Map()});
    if(envelope){envelope.amount+=amount;envelope.posts.set(sub.name,(envelope.posts.get(sub.name)??0)+amount);envelopes.set(envelopeId,envelope);}
    // Integer cents preserve the total, including amounts not divisible by the
    // destination count. The first destinations receive the remaining cents.
    matches.forEach((destination,index)=>{
      const share=Math.floor(amount/matches.length)+(index<amount%matches.length?1:0);
      if(!envelope){const item=standalone.get(destination.id)??{id:destination.id,amount:0,posts:new Map<string,number>()};item.amount+=share;item.posts.set(sub.name,(item.posts.get(sub.name)??0)+share);standalone.set(destination.id,item);}
      if(envelope)envelope.allocations.set(destination.id,(envelope.allocations.get(destination.id)??0)+share);
      const c=countries.get(destination.id)??{id:destination.id,name:destinations.find(d=>d.id===destination.id)!.name,amount:0,trips:new Set<string>(),places:new Map<string,Place>()};
      c.trips.add(parent.name);c.amount+=share;
      const place=c.places.get(destination.name)??{name:destination.name,amount:0,estimated:0,posts:new Map()};
      place.amount+=share;if(matches.length>1)place.estimated+=share;
      const post=place.posts.get(sub.name)??{name:sub.name,amount:0,estimated:0};
      post.amount+=share;if(matches.length>1)post.estimated+=share;place.posts.set(sub.name,post);
      c.places.set(place.name,place);countries.set(c.id,c);
    });
    if(!matches.length){
      const group=shared.get(parent.name)??{amount:0,posts:new Map<string,number>()};
      group.amount+=amount;group.posts.set(sub.name,(group.posts.get(sub.name)??0)+amount);shared.set(parent.name,group);
    }
  }
  return {standalone:[...standalone.values()].map(c=>({...c,amount:c.amount/100,posts:[...c.posts].map(([name,amount])=>({name,amount:amount/100}))})),envelopes:[...envelopes.values()].map(e=>({...e,amount:e.amount/100,posts:[...e.posts].map(([name,amount])=>({name,amount:amount/100})),allocations:[...e.allocations].map(([id,amount])=>({id,amount:amount/100}))})),total:total/100,countries:[...countries.values()].map(c=>({...c,amount:c.amount/100,trips:[...c.trips],places:[...c.places.values()].map(p=>({...p,amount:p.amount/100,estimated:p.estimated/100,posts:[...p.posts.values()].map(post=>({...post,amount:post.amount/100,estimated:post.estimated/100})).sort((a,b)=>b.amount-a.amount)})).sort((a,b)=>b.amount-a.amount)})).sort((a,b)=>b.amount-a.amount),shared:[...shared].map(([name,group])=>({name,amount:group.amount/100,posts:[...group.posts].map(([name,amount])=>({name,amount:amount/100})).sort((a,b)=>b.amount-a.amount)}))};
}
