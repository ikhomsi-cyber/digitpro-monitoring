import type { StoredGroceryOrder } from "./store";
import { fastFoodMerchants } from "./fast-food-merchants";

export type GroceryBankTransaction = { id:string;date:string;label:string;amount:number|string;category:string };
const fold=(value:string)=>value.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();
const brands=["Carrefour","Auchan","Leclerc","Intermarché","Lidl","Aldi","Monoprix","Franprix","Picard","Super U","Hyper U","U Express","Casino","Grand Frais","Biocoop","Naturalia","Netto","Cora","Match"];
const merchantPatterns=brands.map(name=>({name,pattern:new RegExp(`\\b${fold(name).replace(/ /g,"\\s*")}\\b`)}));
export function groceryMerchant(label:string,category=""){
 const text=fold(label);
 if(/\bcocci(?:[\s._-]*market)?\b/.test(text))return "Cocci Market";
 if(/\bmontant\s+utilisation\s+avantages?\b/.test(text.replace(/[^a-z0-9]+/g," ")))return "Carrefour";
 if(/\bachat\s+montesson\b/.test(text.replace(/[^a-z0-9]+/g," ")))return "Carrefour";
 const brand=merchantPatterns.find(brand=>brand.pattern.test(text));
 if(brand)return brand.name;
 const fastFood=fastFoodMerchants.find(merchant=>merchant.pattern.test(text))
  ??fastFoodMerchants.find(merchant=>merchant.pattern.test(fold(category)));
 if(fastFood)return fastFood.name;
 const categoryBrand=merchantPatterns.find(brand=>brand.pattern.test(fold(category)));
 if(categoryBrand)return categoryBrand.name;
 if(/\bcocci(?:[\s._-]*market)?\b/.test(fold(category)))return "Cocci Market";
 if(/\bbouch(?:er(?:ie|ies|s)?|erie[- ]charcuterie)\b/.test(`${text} ${fold(category)}`))return "Boucherie";
 return "Autre enseigne · Bankin";
}
/** Auchan-labelled Bankin purchases count as food purchases by explicit user rule. */
export function isBankinVoucherPurchase(label:string,category=""){
 const normalized=fold(label).replace(/[^a-z0-9]+/g," ");
 if(/\bcb\s+bankin\b/.test(normalized)&&/\bcarrefour\b/.test(`${normalized} ${fold(category)}`))return true;
 return /\bachats?\s+bankin\b/.test(normalized)&&!/\bauchan\b/.test(`${normalized} ${fold(category)}`);
}
const merchantKey=(name:string)=>{
 const key=fold(name);
 if(key.includes("leclerc"))return "leclerc";
 if(["courses u","super u","hyper u","u express"].includes(key))return "courses u";
 return key;
};
export function mergeBankinGroceries(orders:StoredGroceryOrder[],transactions:GroceryBankTransaction[]){
 const seen=new Set<string>(),matched=new Set<string>();
 const combined:StoredGroceryOrder[]=orders.map(order=>({...order,source:"gmail" as const}));
 const bankinPurchases:StoredGroceryOrder[]=[];
 const byMerchantAndAmount=new Map<string,{order:StoredGroceryOrder;day:number}[]>();
 for(const order of orders){
  if(order.totalCents===null)continue;
  const key=`${merchantKey(order.merchant)}|${order.totalCents}`;
  const entries=byMerchantAndAmount.get(key)??[];entries.push({order,day:Date.parse(order.date)});byMerchantAndAmount.set(key,entries);
 }
 for(const tx of transactions){
  const amount=Number(tx.amount);
  if(seen.has(tx.id)||!Number.isFinite(amount)||amount>=0||!fold(tx.category).includes("alimentation"))continue;
  seen.add(tx.id);
  const voucher=isBankinVoucherPurchase(tx.label,tx.category);
  const purchase:StoredGroceryOrder={id:`bankin:${tx.id}`,account:"bankin",source:"bankin",date:tx.date,merchant:voucher?"Achat Bankin":groceryMerchant(tx.label,tx.category),orderRef:voucher?"Bon d’achat · hors total courses":"Paiement Bankin · sans détail produit",totalCents:Math.round(-amount*100),items:[]};
  if(voucher){bankinPurchases.push(purchase);continue;}
  if(purchase.merchant==="Autre enseigne · Bankin")purchase.bankLabel=tx.label;
  const bucket=purchase.merchant==="Autre enseigne · Bankin"?[]:byMerchantAndAmount.get(`${merchantKey(purchase.merchant)}|${purchase.totalCents}`)??[];
  const day=Date.parse(tx.date);let nearest:StoredGroceryOrder|undefined;let nearestDistance=Infinity;
  for(const candidate of bucket){
   if(matched.has(candidate.order.id))continue;
   const distance=Math.abs(day-candidate.day);
   if(distance<=5*86400000&&distance<nearestDistance){nearest=candidate.order;nearestDistance=distance;}
  }
  if(nearest){matched.add(nearest.id);continue;}
  combined.push(purchase);
 }
 const newestFirst=(a:StoredGroceryOrder,b:StoredGroceryOrder)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id);
 return {orders:combined.sort(newestFirst),bankinPurchases:bankinPurchases.sort(newestFirst)};
}
