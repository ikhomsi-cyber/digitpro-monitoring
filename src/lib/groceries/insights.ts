import type { GroceryOrder } from "./parser";

const day = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86_400_000;
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const families = [
  {name:"Entretien & hygiène",color:"#a78bfa",pattern:/lessive|lave.vaisselle|papier toilette|essuie|mouchoir|lingette|savon|douche|shampoo|couche|dentifrice|nettoy|regenerant/},
  {name:"Boissons",color:"#38bdf8",pattern:/\beau\b|jus de|soda|coca|cafe|the vert|the noir|biere|limonade/},
  {name:"Crèmerie & œufs",color:"#fbbf24",pattern:/lait|yaourt|fromage|beurre|creme|emmental|camembert|mozzarella|gouda|maasdam|danonino|actimel|flan|\b[œo]e?ufs?\b/},
  {name:"Viandes & poissons",color:"#fb7185",pattern:/saumon|thon|poisson|crevette|merlan|merlu|poulet|dinde|boeuf|steak|mortad|jambon|sauciss/},
  {name:"Fruits & légumes",color:"#34d399",pattern:/banane|tomate|carotte|courgette|aubergine|poireau|oignon|champignon|avocat|mangue|raisin|pomme|haricot|epinard|coriandre|tete d.ail|salade|citron|orange|poire\b/},
  {name:"Épicerie & boulangerie",color:"#fb923c",pattern:/pates|riz|semoule|lentille|pois chiche|sauce|moutarde|mayonnaise|huile|miel|pain|brioche|gaufre|pancake|biscuit|chocolat|cajou|pistache|cacahuete|fajita|chips|ravioli/},
];
export function groceryFamily(name:string){return families.find(family=>family.pattern.test(fold(name)))??{name:"Autres achats",color:"#94a3b8"};}
/** Aggregate only the expanded category; prices and unrelated product history are unnecessary. */
export function groceryCategoryProducts(orders:GroceryOrder[],categoryName:string){
 const products=new Map<string,{key:string;name:string;quantity:number;totalCents:number}>();
 for(const order of orders)for(const item of order.items){
  if(groceryFamily(item.name).name!==categoryName)continue;
  const product=products.get(item.productKey)??{key:item.productKey,name:item.name,quantity:0,totalCents:0};
  product.quantity+=item.quantity;product.totalCents+=item.totalCents;products.set(item.productKey,product);
 }
 return [...products.values()].sort((a,b)=>b.totalCents-a.totalCents||a.name.localeCompare(b.name,"fr"));
}
export function groceryCategoryTotals(orders:GroceryOrder[]){
 const categories=new Map<string,{name:string;color:string;totalCents:number}>();let itemTotalCents=0;
 for(const order of orders)for(const item of order.items){const family=groceryFamily(item.name);const category=categories.get(family.name)??{name:family.name,color:family.color,totalCents:0};category.totalCents+=item.totalCents;itemTotalCents+=item.totalCents;categories.set(family.name,category);}
 return {categories:[...categories.values()].sort((a,b)=>b.totalCents-a.totalCents),itemTotalCents};
}

/** Purchase activity only: quantities are those billed, never estimated household consumption. */
export function groceryInsights(orders:GroceryOrder[],history:GroceryOrder[],month:string,mode:"month"|"year"|"all",today:string,includeProducts=true){
 const products=new Map<string,{key:string;name:string;totalCents:number;orderCount:number;observations:{date:string;quantity:number;totalCents:number}[]}>();
 const categories=new Map<string,{name:string;color:string;totalCents:number}>();
 for(const order of includeProducts?orders:[]){
  const inOrder=new Map<string,{name:string;quantity:number;totalCents:number}>();
  for(const item of order.items){
   const family=groceryFamily(item.name),category=categories.get(family.name)??{name:family.name,color:family.color,totalCents:0};category.totalCents+=item.totalCents;categories.set(family.name,category);
   const entry=inOrder.get(item.productKey)??{name:item.name,quantity:0,totalCents:0};entry.quantity+=item.quantity;entry.totalCents+=item.totalCents;inOrder.set(item.productKey,entry);
  }
  for(const [key,item] of inOrder){const product=products.get(key)??{key,name:item.name,totalCents:0,orderCount:0,observations:[]};product.totalCents+=item.totalCents;product.orderCount++;product.observations.push({date:order.date,quantity:item.quantity,totalCents:item.totalCents});products.set(key,product);}
 }
 const detailedCount=orders.filter(order=>order.items.length>0).length;
 const productList=[...products.values()];
 const recurring=productList.filter(product=>product.orderCount>=2).sort((a,b)=>b.orderCount-a.orderCount||b.totalCents-a.totalCents);
 const itemTotalCents=productList.reduce((sum,product)=>sum+product.totalCents,0);
 const recurringCents=recurring.reduce((sum,product)=>sum+product.totalCents,0);
 const dates=[...new Set(orders.map(order=>order.date))].sort();
 const gaps=dates.slice(1).map((date,index)=>day(date)-day(dates[index]));
 const averageGapDays=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null;
 // Compare one weighted price per date so duplicate lines/same-day orders cannot create false alerts.
 const historyPrices=new Map<string,Map<string,{quantity:number;totalCents:number}>>();
 for(const order of includeProducts?history:[])for(const item of order.items){
  if(!products.has(item.productKey))continue;
  const prices=historyPrices.get(item.productKey)??new Map<string,{quantity:number;totalCents:number}>();
  const entry=prices.get(order.date)??{quantity:0,totalCents:0};entry.quantity+=item.quantity;entry.totalCents+=item.totalCents;prices.set(order.date,entry);historyPrices.set(item.productKey,prices);
 }
 const priceChanges=productList.flatMap(product=>{
  const latestSelectedDate=product.observations.map(observation=>observation.date).sort().at(-1)!;
  const observations=[...(historyPrices.get(product.key)??[])].filter(([date])=>date<=latestSelectedDate).sort(([a],[b])=>b.localeCompare(a));if(observations.length<2)return [];
  const [latestDate,latest]=observations[0],[previousDate,previous]=observations[1];
  const latestCents=Math.round(latest.totalCents/latest.quantity),previousCents=Math.round(previous.totalCents/previous.quantity);
  if(previousCents<=0||latestCents===previousCents)return [];
  return [{key:product.key,name:product.name,latestDate,previousDate,latestCents,previousCents,deltaCents:latestCents-previousCents,formatUncertain:latestCents>=previousCents*2||latestCents<=previousCents/2,percent:(latestCents/previousCents-1)*100}];
 }).sort((a,b)=>Math.abs(b.percent)-Math.abs(a.percent));
 const anchor=(mode==="all"?history.map(order=>order.date.slice(0,7)).sort().at(-1):month)||today.slice(0,7),year=Number(anchor.slice(0,4)),monthIndex=Number(anchor.slice(5,7))-1;
 const endMonth=mode==="year"?11:monthIndex;
 const series=Array.from({length:12},(_,index)=>{
  const date=new Date(Date.UTC(year,endMonth-11+index,1));const key=date.toISOString().slice(0,7);
  const matches=history.filter(order=>order.date.startsWith(key));
  return {month:key,totalCents:matches.reduce((sum,order)=>sum+(order.totalCents??0),0),count:matches.length,pricedCount:matches.filter(order=>order.totalCents!==null).length};
 });
 let comparison:null|{totalCents:number;previousCents:number;percent:number;throughDay:number|null;label:string}=null;
 if(mode!=="all"&&month){
  const prefix=mode==="year"?month.slice(0,4):month;
  const current=prefix===today.slice(0,prefix.length);
  const previousDate=new Date(Date.UTC(year-(mode==="year"?1:0),mode==="year"?0:monthIndex-1,1));
  const previousPrefix=previousDate.toISOString().slice(0,prefix.length);
  const cutoff=(order:GroceryOrder)=>!current||(mode==="month"?Number(order.date.slice(8))<=Number(today.slice(8)):order.date.slice(5)<=today.slice(5));
  const before=history.filter(order=>order.date.startsWith(previousPrefix)&&cutoff(order));
  const now=orders.filter(cutoff);
  const previousCents=before.reduce((sum,order)=>sum+(order.totalCents??0),0),totalCents=now.reduce((sum,order)=>sum+(order.totalCents??0),0);
  if(previousCents>0&&now.some(order=>order.totalCents!==null)&&[...before,...now].every(order=>order.totalCents!==null))comparison={totalCents,previousCents,percent:(totalCents/previousCents-1)*100,throughDay:current&&mode==="month"?Number(today.slice(8)):null,label:mode==="month"?"au mois précédent":current?"à l’année précédente, à date identique":"à l’année précédente"};
 }
 return {categories:[...categories.values()].sort((a,b)=>b.totalCents-a.totalCents),itemTotalCents,recurring,recurringShare:itemTotalCents?recurringCents/itemTotalCents*100:0,detailedCount,averageGapDays,priceChanges:priceChanges.filter(change=>!change.formatUncertain),formatChanges:priceChanges.filter(change=>change.formatUncertain).length,series,comparison};
}
