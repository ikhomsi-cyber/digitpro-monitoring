import type { GroceryOrder } from "./parser";
export function groceryOrderSummary(orders:GroceryOrder[]){
 let pricedOrderCount=0,detailedOrderCount=0,totalCents=0;
 for(const order of orders){if(order.totalCents!==null){pricedOrderCount++;totalCents+=order.totalCents;}if(order.items.length)detailedOrderCount++;}
 return {pricedOrderCount,orderCount:orders.length,detailedOrderCount,totalCents};
}
export function groceryStats(orders: GroceryOrder[]) {
  const products=new Map<string,{key:string;name:string;quantity:number;totalCents:number;minPriceCents:number;maxPriceCents:number;prices:{date:string;unitPriceCents:number}[]}>();
  for(const order of orders)for(const item of order.items){
    const current=products.get(item.productKey)??{key:item.productKey,name:item.name,quantity:0,totalCents:0,minPriceCents:item.unitPriceCents,maxPriceCents:item.unitPriceCents,prices:[]};
    current.quantity+=item.quantity;current.totalCents+=item.totalCents;current.minPriceCents=Math.min(current.minPriceCents,item.unitPriceCents);current.maxPriceCents=Math.max(current.maxPriceCents,item.unitPriceCents);current.prices.push({date:order.date,unitPriceCents:item.unitPriceCents});products.set(item.productKey,current);
  }
  return {pricedOrderCount:orders.filter(order=>order.totalCents!==null).length,orderCount:orders.length,detailedOrderCount:orders.filter(order=>order.items.length).length,totalCents:orders.reduce((sum,order)=>sum+(order.totalCents??0),0),products:[...products.values()].map(product=>{
    const prices=product.prices.sort((a,b)=>b.date.localeCompare(a.date));
    return {...product,averagePriceCents:Math.round(product.totalCents/product.quantity),lastPriceCents:prices[0].unitPriceCents,previousPriceCents:prices[1]?.unitPriceCents??null};
  }).sort((a,b)=>b.totalCents-a.totalCents)};
}
