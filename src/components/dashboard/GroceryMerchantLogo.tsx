"use client";

import { useState } from "react";
import { Beef, Sandwich, ShoppingBasket } from "lucide-react";
import { fastFoodMerchants } from "@/lib/groceries/fast-food-merchants";

const domains:Record<string,string>={carrefour:"www.carrefour.fr",auchan:"www.auchan.fr",leclerc:"www.e.leclerc",intermarche:"www.intermarche.com",lidl:"www.lidl.fr",aldi:"www.aldi.fr",monoprix:"www.monoprix.fr",franprix:"www.franprix.fr",picard:"www.picard.fr",casino:"www.casino.fr",biocoop:"www.biocoop.fr",naturalia:"www.naturalia.fr",netto:"www.netto.fr",cora:"www.cora.fr","grand frais":"www.grandfrais.com","courses u":"www.coursesu.com","super u":"www.coursesu.com","hyper u":"www.coursesu.com","u express":"www.coursesu.com"};
export function GroceryMerchantLogo({merchant}:{merchant:string}){
 const normalized=merchant.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();
 const fastFood=fastFoodMerchants.find(brand=>brand.name===merchant);
 const domain=fastFood?.domain??Object.entries(domains).find(([brand])=>normalized.includes(brand))?.[1];
 const [failedUrl,setFailedUrl]=useState<string|null>(null);
 const src=domain?`https://${domain}/favicon.ico`:null;
 const localSrc=normalized==="cocci market"?"/images/merchants/coccimarket.png":fastFood?.name==="Uber Eats"?"/images/merchants/ubereats.svg":normalized==="carrefour"?"/images/merchants/carrefour.ico":normalized==="lidl"?"/images/merchants/lidl.svg":fastFood?.name==="Quick"?"/images/merchants/quick.svg":fastFood?.name==="Domino’s Pizza"?"/images/merchants/dominos.svg":null;
 const logoSrc=localSrc??src;
 return <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-200/50 bg-white dark:border-white/10">
  {logoSrc&&failedUrl!==logoSrc?(normalized==="cocci market"?<span className="relative h-5 w-5 overflow-hidden rounded-full"><img src={logoSrc} alt="" width={132} height={44} loading="lazy" decoding="async" onError={()=>setFailedUrl(logoSrc)} className="absolute -left-[5px] -top-[12px] h-[44px] w-[132px] max-w-none"/></span>:<img src={logoSrc} alt="" width={20} height={20} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailedUrl(logoSrc)} className="h-5 w-5 object-contain"/>):fastFood?<Sandwich size={16} className="text-amber-500"/>:normalized==="boucherie"?<Beef size={16} className="text-rose-500"/>:<ShoppingBasket size={15} className="text-ink-400"/>}
 </span>;
}
