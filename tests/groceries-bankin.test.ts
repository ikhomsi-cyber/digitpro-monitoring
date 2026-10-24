import { expect,it } from "vitest";
import { mergeBankinGroceries,type GroceryBankTransaction } from "@/lib/groceries/bankin";
import { groceryStats } from "@/lib/groceries/stats";
import { groceryMerchant } from "@/lib/groceries/bankin";
import { isBankinVoucherPurchase } from "@/lib/groceries/bankin";
import type { StoredGroceryOrder } from "@/lib/groceries/store";
const order:StoredGroceryOrder={id:"mail-1",account:"secondary",merchant:"Carrefour",date:"2026-10-01",orderRef:"synthetic",totalCents:5000,items:[]};
const tx=(id:string,label="CB LIDL",amount=-30,date="2026-10-02"):GroceryBankTransaction=>({id,label,amount,date,category:"Alimentation > Supermarché"});
it("excludes CB Bankin tagged Carrefour but retains actual Carrefour and Auchan purchases",()=>{
 const merged=mergeBankinGroceries([],[{...tx("voucher","CB BANKIN",-200),category:"Alimentation > Carrefour"},tx("voucher-label","CB BANKIN CARREFOUR",-50),tx("actual","CB CARREFOUR",-40),tx("auchan","ACHAT BANKIN AUCHAN",-30)]);
 expect(merged.bankinPurchases).toHaveLength(2);
 expect(merged.orders.map(order=>order.merchant).sort()).toEqual(["Auchan","Carrefour"]);
 expect(groceryStats(merged.orders).totalCents).toBe(7000);
 expect(isBankinVoucherPurchase("CB BANKIN","Alimentation > Auchan")).toBe(false);
});
it("uses the actual Bankin merchant tag when the payment label is generic",()=>{
 const merged=mergeBankinGroceries([],[{...tx("auchan","CB Bankin",-40),category:"Alimentation & Restau › Auchan"},{...tx("carrefour","CB Bankin Boulevard",-200),category:"Alimentation & Restau › Carrefour"}]);
 expect(merged.orders).toEqual([expect.objectContaining({merchant:"Auchan",totalCents:4000})]);
 expect(merged.bankinPurchases).toHaveLength(1);
 expect(groceryMerchant("CB COMMERCE","Alimentation › Cocci Market")).toBe("Cocci Market");
});
it.each(["CB COCCI TEST","CB COCCIMARKET","COCCI MARKET TEST"])("groups %s under Cocci Market",label=>{
 expect(groceryMerchant(label)).toBe("Cocci Market");
 expect(mergeBankinGroceries([],[tx("cocci",label,-12)]).orders[0]).toMatchObject({merchant:"Cocci Market",totalCents:1200});
});
it("assigns the user-confirmed benefit usage label to Carrefour",()=>{
 const merged=mergeBankinGroceries([],[tx("benefit","Montant utilisation avantage",-18)]);
 expect(merged.orders[0]).toMatchObject({merchant:"Carrefour",totalCents:1800});
 expect(groceryMerchant("MONTANT UTILISATION AVANTAGES")).toBe("Carrefour");
});
it.each(["Cashback Uber Eats","CACHBACK UBEREATS","CB UBER*EATS","CASHBACK UBER-EATS"])("classifies %s as Uber Eats",label=>{
 expect(groceryMerchant(label)).toBe("Uber Eats");
 expect(mergeBankinGroceries([],[tx("uber",label,-24)]).orders[0]).toMatchObject({merchant:"Uber Eats",totalCents:2400});
});
it("maps the user-confirmed Achat Montesson label to Carrefour only",()=>{
 expect(groceryMerchant("ACHAT MONTESSON")).toBe("Carrefour");
 expect(groceryMerchant("CB Achat-Montesson TEST")).toBe("Carrefour");
 expect(groceryMerchant("CB AUTRE COMMERCE MONTESSON")).toBe("Autre enseigne · Bankin");
 const merged=mergeBankinGroceries([],[tx("montesson","Achat Montesson",-32)]);
 expect(merged.orders[0]).toMatchObject({merchant:"Carrefour",totalCents:3200});
});
it("preserves the original label for the unknown-merchant transaction list only",()=>{
 const merged=mergeBankinGroceries([],[tx("unknown","CB COMMERCE TEST",-17.25),tx("known","CB LIDL",-20)]);
 expect(merged.orders.find(order=>order.id==="bankin:unknown")).toMatchObject({merchant:"Autre enseigne · Bankin",bankLabel:"CB COMMERCE TEST",date:"2026-10-02",totalCents:1725});
 expect(merged.orders.find(order=>order.id==="bankin:known")?.bankLabel).toBeUndefined();
});
it.each([
 ["CB MCDONALDS SARTROUVILLE","McDonald’s"],
 ["CB MC DONALD'S PARIS","McDonald’s"],
 ["MCDO TEST","McDonald’s"],
 ["BURGERKING TEST","Burger King"],
 ["CB KFC TEST","KFC"],
 ["CB QUICK TEST","Quick"],
 ["CB SUBWAY TEST","Subway"],
 ["DOMINO'S PIZZA TEST","Domino’s Pizza"],
 ["CB DOMINOS PIZZA TEST","Domino’s Pizza"],
 ["CB DOMINO S PIZZA TEST","Domino’s Pizza"],
 ["CB DOMINOS-PIZZA TEST","Domino’s Pizza"],
 ["CB DOMINOS1234 TEST","Domino’s Pizza"],
 ["CB DOMINO.S PIZZA TEST","Domino’s Pizza"],
 ["CB DOMINO‘S PIZZA TEST","Domino’s Pizza"],
 ["CB LIDL TEST","Lidl"],
 ["PIZZA HUT TEST","Pizza Hut"],
 ["CB O-TACOS TEST","O’Tacos"],
 ["FIVE GUYS TEST","Five Guys"],
 ["POKAWA TEST","Pokawa"],
])("recognizes fast-food label %s",(label,name)=>{
 expect(groceryMerchant(label)).toBe(name);
 const merged=mergeBankinGroceries([],[tx("food",label,-15)]);
 expect(merged.orders[0]).toMatchObject({merchant:name,totalCents:1500,items:[]});
});
it("does not classify unrelated labels as fast-food brands",()=>{
 expect(groceryMerchant("CB QUICKSTEP MAISON")).toBe("Autre enseigne · Bankin");
 expect(groceryMerchant("CB KFCOM SERVICES")).toBe("Autre enseigne · Bankin");
});
it("recognizes Domino's from the Bankin food subcategory when the payment names the franchise",()=>{
 const purchase={...tx("dominos","CB FRANCHISE TEST",-25),category:"Alimentation > Dominos Pizza"};
 const merged=mergeBankinGroceries([],[purchase,tx("other","COMMERCE TEST",-10)]);
 expect(merged.orders.find(order=>order.id==="bankin:dominos")).toMatchObject({merchant:"Domino’s Pizza",totalCents:2500});
 expect(groceryMerchant("CB DOMINOTIQUE TEST")).toBe("Autre enseigne · Bankin");
 expect(groceryStats(merged.orders).totalCents).toBe(3500);
});
it("isolates butchers by label or food subcategory without reclassifying supermarkets",()=>{
 expect(groceryMerchant("CB BOUCHERIE TEST")).toBe("Boucherie");
 expect(groceryMerchant("CB COMMERCE TEST","Alimentation > Boucherie")).toBe("Boucherie");
 expect(groceryMerchant("CB CARREFOUR","Alimentation > Boucherie")).toBe("Carrefour");
 const merged=mergeBankinGroceries([],[tx("butcher","BOUCHERIE TEST",-40),tx("shop","CB LIDL",-20)]);
 expect(merged.orders.find(o=>o.merchant==="Boucherie")?.totalCents).toBe(4000);
 expect(groceryStats(merged.orders).totalCents).toBe(6000);
});
it("adds other food merchants without inventing product details",()=>{
 const merged=mergeBankinGroceries([order],[tx("1")]);
 expect(merged.orders.find(o=>o.account==="bankin")).toMatchObject({merchant:"Lidl",totalCents:3000,items:[]});
 expect(groceryStats(merged.orders).totalCents).toBe(8000);
});
it("matches one payment to one mail without hiding an additional real purchase",()=>{
 const merged=mergeBankinGroceries([order],[tx("1","CB CARREFOUR",-50),tx("2","CB CARREFOUR",-50)]);
 expect(merged.orders).toHaveLength(2);expect(merged.bankinPurchases).toHaveLength(0);expect(groceryStats(merged.orders).totalCents).toBe(10000);
});
it("keeps purchases with different merchant, amount or date",()=>{
 expect(mergeBankinGroceries([order],[tx("1","CB LIDL",-50),tx("2","CB CARREFOUR",-51),tx("3","CB CARREFOUR",-50,"2026-10-20")]).orders).toHaveLength(4);
});
it("excludes credits, other categories, invalid amounts and duplicate bank ids",()=>{
 const debit=tx("1");
 const merged=mergeBankinGroceries([],[debit,debit,tx("2","CB",30),tx("3","CB",NaN),{...tx("4"),category:"Transport"}]);
 expect(merged.bankinPurchases).toHaveLength(0);expect(merged.orders).toHaveLength(1);
});

it("excludes only Achat Bankin vouchers, not all 200 euro food purchases",()=>{
 const merged=mergeBankinGroceries([order],[tx("voucher","ACHAT BANKIN",-200),tx("real","CB AUCHAN",-200),tx("voucher2","CB Achat-Bankin Paris",-75)]);
 expect(groceryStats(merged.orders).totalCents).toBe(25000);
 expect(merged.orders).toHaveLength(2);
 expect(merged.bankinPurchases).toHaveLength(2);
 expect(merged.bankinPurchases.every(p=>p.merchant==="Achat Bankin")).toBe(true);
});
it("counts Auchan-labelled Achat Bankin purchases under Auchan while retaining other exclusions",()=>{
 const merged=mergeBankinGroceries([],[tx("auchan","ACHAT BANKIN AUCHAN",-200),tx("auchan2","Achat-Bankin Auchan Drive",-40),tx("voucher","ACHAT BANKIN",-200),tx("carrefour","ACHAT BANKIN CARREFOUR",-200)]);
 expect(merged.orders).toHaveLength(2);
 expect(merged.orders.every(order=>order.merchant==="Auchan")).toBe(true);
 expect(groceryStats(merged.orders).totalCents).toBe(24000);
 expect(merged.bankinPurchases).toHaveLength(2);
 expect(isBankinVoucherPurchase("ACHAT BANKIN AUCHAN")).toBe(false);
 expect(isBankinVoucherPurchase("ACHAT BANKIN CARREFOUR")).toBe(true);
});
