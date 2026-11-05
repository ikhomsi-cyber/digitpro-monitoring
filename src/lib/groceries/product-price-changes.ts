import type {GroceryOrder} from './parser';
export type ProductPriceChange={latestDate:string;previousDate:string|null;latestCents:number;previousCents:number|null;deltaCents:number|null;percent:number|null;formatUncertain:boolean};
export function groceryProductPriceChanges(selected:GroceryOrder[],history:GroceryOrder[]){
 const merchant=(s:string)=>s.trim().toLowerCase(),targets=new Map<string,string>();
 for(const o of selected)for(const i of o.items){const k=`${merchant(o.merchant)}|${i.productKey}`;if(o.date>(targets.get(k)??''))targets.set(k,o.date);}
 const unique=new Map<string,GroceryOrder>();for(const o of [...history,...selected])unique.set(`${merchant(o.merchant)}|${o.orderRef}|${o.date}`,o);
 const prices=new Map<string,Map<string,{quantity:number;total:number}>>();
 for(const o of unique.values())for(const i of o.items){const k=`${merchant(o.merchant)}|${i.productKey}`,cutoff=targets.get(k);if(!cutoff||o.date>cutoff||!Number.isFinite(i.quantity)||i.quantity<=0||!Number.isFinite(i.totalCents)||i.totalCents<0)continue;const days=prices.get(k)??new Map(),p=days.get(o.date)??{quantity:0,total:0};p.quantity+=i.quantity;p.total+=i.totalCents;days.set(o.date,p);prices.set(k,days);}
 const result=new Map<string,ProductPriceChange>();
 for(const [k,days]of prices){const points=[...days].sort(([a],[b])=>b.localeCompare(a)),[date,last]=points[0],prior=points[1],current=Math.round(last.total/last.quantity),previous=prior?Math.round(prior[1].total/prior[1].quantity):null;result.set(k,{latestDate:date,previousDate:prior?.[0]??null,latestCents:current,previousCents:previous,deltaCents:previous===null?null:current-previous,percent:previous===null||previous<=0?null:(current-previous)/previous*100,formatUncertain:previous!==null&&previous>0&&(current>=previous*2||current<=previous/2)});}
 return result;
}
