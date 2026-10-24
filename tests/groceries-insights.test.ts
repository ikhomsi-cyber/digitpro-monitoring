import { expect,it } from "vitest";
import { groceryInsights } from "@/lib/groceries/insights";
import { groceryCategoryTotals,groceryCategoryProducts } from "@/lib/groceries/insights";
import { groceryStats,groceryOrderSummary } from "@/lib/groceries/stats";
import type { GroceryOrder } from "@/lib/groceries/parser";
const item=(price:number,quantity=1)=>({name:"Lait test 1 L",productKey:"lait test 1 l",quantity,unitPriceCents:price,totalCents:price*quantity});
const order=(date:string,total:number|null,items=[item(100)]):GroceryOrder=>({merchant:"Carrefour",orderRef:`TEST-${date}`,date,totalCents:total,items});
it('lists purchased products for an expanded category and reconciles quantities and totals',()=>{
 const bread={name:"Pain test",productKey:"pain-test",quantity:1,unitPriceCents:250,totalCents:250};
 const orders=[order('2026-10-01',450,[item(100,2),bread]),order('2026-10-03',120,[item(120)])];
 const dairy=groceryCategoryProducts(orders,'Crèmerie & œufs');
 expect(dairy).toEqual([{key:'lait test 1 l',name:'Lait test 1 L',quantity:3,totalCents:320}]);
 const categories=groceryCategoryTotals(orders).categories;
 for(const category of categories)expect(groceryCategoryProducts(orders,category.name).reduce((sum,product)=>sum+product.totalCents,0)).toBe(category.totalCents);
 expect(groceryCategoryProducts(orders,'Rayon absent')).toEqual([]);
});
it('keeps overview figures identical without calculating removed product analytics',()=>{
 const orders=[order('2026-09-01',100),order('2026-10-01',200,[item(200)])];
 const full=groceryInsights(orders.slice(1),orders,'2026-10','month','2026-10-24');
 const lean=groceryInsights(orders.slice(1),orders,'2026-10','month','2026-10-24',false);
 expect(lean.series).toEqual(full.series);expect(lean.comparison).toEqual(full.comparison);expect(lean.averageGapDays).toBe(full.averageGapDays);
 expect(lean.priceChanges).toEqual([]);expect(lean.recurring).toEqual([]);
 expect(groceryCategoryTotals(orders)).toEqual({categories:groceryInsights(orders,orders,'2026-10','all','2026-10-24').categories,itemTotalCents:300});
 const {products,...summary}=groceryStats(orders);expect(groceryOrderSummary(orders)).toEqual(summary);
});
it('counts recurrence per order and separates item spending from the paid basket',()=>{
 const orders=[order('2026-09-01',250,[item(100),item(100)]),order('2026-09-10',200,[item(100,2)]),order('2026-09-20',50,[])];
 const result=groceryInsights(orders,orders,'2026-09','month','2026-10-16');
 expect(result.recurring[0].orderCount).toBe(2);expect(result.detailedCount).toBe(2);
 expect(result.itemTotalCents).toBe(400);expect(result.recurringShare).toBe(100);
 expect(result.averageGapDays).toBe(9.5);expect(result.categories[0].name).toBe('Crèmerie & œufs');
});
it('compares the current month through the same day and avoids invented baselines',()=>{
 const history=[order('2026-09-01',100),order('2026-09-20',900),order('2026-10-02',200)];
 expect(groceryInsights(history.slice(2),history,'2026-10','month','2026-10-16').comparison).toMatchObject({previousCents:100,totalCents:200,percent:100,throughDay:16});
 expect(groceryInsights(history.slice(2),history.slice(2),'2026-10','month','2026-10-16').comparison).toBeNull();
 expect(groceryInsights([order('2026-10-02',null)],history,'2026-10','month','2026-10-16').comparison).toBeNull();
});
it('compares yearly purchases over equivalent elapsed dates',()=>{
 const history=[order('2025-01-01',100),order('2025-12-01',900),order('2026-01-01',200)];
 expect(groceryInsights(history.slice(2),history,'2026-10','year','2026-10-16').comparison).toMatchObject({previousCents:100,totalCents:200,percent:100});
 expect(groceryInsights(history,history,'2026-10','all','2026-10-16').comparison).toBeNull();
});
it('uses the preceding purchase price and never a future purchase for a historical period',()=>{
 const history=[order('2026-08-01',200,[item(100,2)]),order('2026-09-01',150,[item(150)]),order('2026-10-01',900,[item(900)])];
 const result=groceryInsights([history[1]],history,'2026-09','month','2026-10-16');
 expect(result.priceChanges).toHaveLength(1);expect(result.priceChanges[0]).toMatchObject({previousCents:100,latestCents:150,percent:50});
});
it('consolidates same-day lines and excludes single-date price alerts',()=>{
 const orders=[order('2026-09-01',300,[item(100),item(200)])];
 expect(groceryInsights(orders,orders,'2026-09','month','2026-10-16').priceChanges).toEqual([]);
 expect(groceryInsights([],[],'','all','2026-10-16').averageGapDays).toBeNull();
});
it('returns twelve chronologically ordered months including empty import months',()=>{
 const orders=[order('2026-10-01',200)];
 const result=groceryInsights(orders,orders,'2026-10','month','2026-10-16');
 expect(result.series).toHaveLength(12);expect(result.series[0].month).toBe('2025-11');
 expect(result.series.at(-1)).toMatchObject({month:'2026-10',totalCents:200,count:1});
 const yearly=groceryInsights(orders,orders,'2026-10','year','2026-10-16');
 expect(yearly.series[0].month).toBe('2026-01');expect(yearly.series.at(-1)?.month).toBe('2026-12');
});
it('separates large unit/pack changes from normal price trends',()=>{
 const history=[order('2026-08-01',100,[item(100)]),order('2026-09-01',600,[item(600)])];
 const result=groceryInsights([history[1]],history,'2026-09','month','2026-10-16');
 expect(result.priceChanges).toEqual([]);expect(result.formatChanges).toBe(1);
});
