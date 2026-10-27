import { expect,it } from "vitest";
import { groceryShoppingSuggestions,parisGroceryDay } from "@/lib/groceries/shopping-suggestions";
import type { GroceryOrder } from "@/lib/groceries/parser";
const order=(date:string,quantity=2,extra:Partial<GroceryOrder>={}):GroceryOrder=>({merchant:"Carrefour",orderRef:`fixture-${date}`,date,totalCents:300,items:[{productKey:"lait 1l",name:"Lait 1L",quantity,unitPriceCents:150,totalCents:quantity*150}],...extra});
it("explains a due product using distinct purchase dates and known quantities",()=>{
 const result=groceryShoppingSuggestions([order("2026-10-01"),order("2026-10-08"),order("2026-10-15")],"2026-10-22");
 expect(result.suggestions).toHaveLength(1);expect(result.suggestions[0]).toMatchObject({intervalDays:7,daysSincePurchase:7,purchaseDates:3,quantity:2,historicalUnitPriceCents:150,confidence:"regular"});
});
it("does not suggest premature repeat purchases and ignores future/other merchants",()=>{
 const history=[order("2026-10-01"),order("2026-10-08"),order("2026-10-15"),order("2026-10-30"),order("2026-10-20",2,{merchant:"Auchan"})];
 expect(groceryShoppingSuggestions(history,"2026-10-20").suggestions).toEqual([]);
 expect(groceryShoppingSuggestions(history,"2026-10-22").suggestions[0].lastPurchase).toBe("2026-10-15");
});
it("deduplicates confirmations and counts same-day orders only once for recurrence",()=>{
 const first=order("2026-10-01");
 const result=groceryShoppingSuggestions([first,first,{...first,orderRef:"another"}],"2026-10-20");
 expect(result.recurringProducts).toBe(0);expect(result.suggestions).toEqual([]);
 const recurring=groceryShoppingSuggestions([first,first,order("2026-10-08")],"2026-10-15");
 expect(recurring.suggestions[0].quantity).toBe(2);
});
it("rejects invalid dates/quantities and never invents habits from summaries",()=>{
 expect(groceryShoppingSuggestions([order("2026-02-30"),order("2026-10-01",0),order("2026-10-08",NaN),order("2026-10-15",-1),order("2026-10-20",2,{items:[]})],"2026-10-27").suggestions).toEqual([]);
 expect(groceryShoppingSuggestions([order("2026-10-01")],"2026-10-27").recurringProducts).toBe(0);
 expect(()=>groceryShoppingSuggestions([],"invalid")).toThrow();
});
it("does not conflate formats or extrapolate abandoned purchases indefinitely",()=>{
 const other={...order("2026-10-08"),items:[{...order("2026-10-08").items[0],productKey:"lait 6l",name:"Lait 6L"}]};
 expect(groceryShoppingSuggestions([order("2026-10-01"),other],"2026-10-27").suggestions).toEqual([]);
 expect(groceryShoppingSuggestions([order("2026-08-01"),order("2026-08-08")],"2026-10-27").suggestions).toEqual([]);
});
it("treats invalid prices as unknown and calculates calendar days across daylight-saving changes",()=>{
 const last=order("2026-10-25");last.items[0].unitPriceCents=NaN;
 const result=groceryShoppingSuggestions([order("2026-10-18"),last],"2026-11-01");
 expect(result.suggestions[0]).toMatchObject({intervalDays:7,daysSincePurchase:7,historicalUnitPriceCents:null,confidence:"limited"});
 expect(parisGroceryDay(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
});
