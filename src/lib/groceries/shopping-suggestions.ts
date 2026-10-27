import type { GroceryOrder } from "./parser";
const DAY=86_400_000;
function dayNumber(date:string):number|null {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const value=Date.parse(`${date}T00:00:00Z`);
 return Number.isFinite(value)&&new Date(value).toISOString().slice(0,10)===date?value/DAY:null;
}
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
export type ShoppingSuggestion={key:string;name:string;lastPurchase:string;intervalDays:number;daysSincePurchase:number;purchaseDates:number;quantity:number;historicalUnitPriceCents:number|null;confidence:"limited"|"regular"};
export function parisGroceryDay(now=new Date()){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Paris"}).format(now);}
/** Observed calendar-day recurrence, not a home-stock estimate. */
export function groceryShoppingSuggestions(orders:readonly GroceryOrder[],today:string){
 const current=dayNumber(today);if(current===null)throw new Error("Date de référence invalide.");
 const unique=new Map<string,GroceryOrder>();
 for(const order of orders){
  const day=dayNumber(order.date);
  if(order.merchant.trim().toLowerCase()!=="carrefour"||day===null||day>current||day<current-180)continue;
  const key=`${order.date}:${order.orderRef}`;
  if(!unique.has(key)||unique.get(key)!.items.length<order.items.length)unique.set(key,order);
 }
 const products=new Map<string,{name:string;dates:Map<string,{quantity:number;price:number|null}>}>();let detailedOrders=0;
 for(const order of unique.values()){
  let valid=false;
  for(const item of order.items){
   if(!item.productKey.trim()||!Number.isFinite(item.quantity)||item.quantity<=0||item.quantity>1000)continue;
   valid=true;const product=products.get(item.productKey)??{name:item.name,dates:new Map()};
   const previous=product.dates.get(order.date);
   const price=Number.isSafeInteger(item.unitPriceCents)&&item.unitPriceCents>=0?item.unitPriceCents:null;
   product.dates.set(order.date,{quantity:(previous?.quantity??0)+item.quantity,price:price??previous?.price??null});products.set(item.productKey,product);
  }
  if(valid)detailedOrders++;
 }
 const suggestions:ShoppingSuggestion[]=[];let recurringProducts=0;
 for(const [key,product] of products){
  const dates=[...product.dates.keys()].sort();if(dates.length<2)continue;recurringProducts++;
  const intervalDays=Math.max(1,Math.round(median(dates.slice(1).map((date,i)=>dayNumber(date)!-dayNumber(dates[i])!))));
  const lastPurchase=dates.at(-1)!,age=current-dayNumber(lastPurchase)!;
  if(age<intervalDays||age>Math.max(45,intervalDays*3))continue;
  suggestions.push({key,name:product.name,lastPurchase,intervalDays,daysSincePurchase:age,purchaseDates:dates.length,
   quantity:Math.min(1000,median(dates.slice(-3).map(date=>product.dates.get(date)!.quantity))),historicalUnitPriceCents:product.dates.get(lastPurchase)!.price,confidence:dates.length>=3?"regular":"limited"});
 }
 suggestions.sort((a,b)=>b.daysSincePurchase/b.intervalDays-a.daysSincePurchase/a.intervalDays||a.name.localeCompare(b.name,"fr"));
 const dates=[...unique.values()].map(order=>order.date).sort();
 return {suggestions:suggestions.slice(0,30),totalSuggestions:suggestions.length,detailedOrders,recurringProducts,from:dates[0]??null,to:dates.at(-1)??null,today};
}
