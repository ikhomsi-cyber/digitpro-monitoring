"use client";

import { useEffect,useState } from "react";
import { Package } from "lucide-react";
import { groceryProductDisplayName,groceryProductImageUrl } from "@/lib/groceries/product-display";
import { carrefourProductImage,loadCarrefourProductImages } from "@/lib/groceries/carrefour-product-images";
import { GroceryProductImage } from "./GroceryProductImage";

export function GroceryProductPresentation({name}:{name:string}){
 const [expanded,setExpanded]=useState(false),[failed,setFailed]=useState<string|null>(null);
 const [product,setProduct]=useState(()=>carrefourProductImage(name));
 useEffect(()=>{let alive=true;setProduct(carrefourProductImage(name));void loadCarrefourProductImages().then(()=>{if(alive)setProduct(carrefourProductImage(name));}).catch(()=>{});return()=>{alive=false;};},[name]);
 const short=groceryProductDisplayName(name),image=product?.localImageUrl??groceryProductImageUrl(product?.imageUrl);
 return <div className="flex min-w-0 items-start gap-3">
  <span aria-hidden="true" className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-black/5">
   {image&&failed!==image?<GroceryProductImage src={image} onError={()=>setFailed(image)}/>:<Package size={18} className="text-slate-400"/>}
  </span>
  <div className="min-w-0 py-0.5">{short!==name?<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} title={name} className="text-left text-sm font-medium leading-relaxed text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:text-white/80"><span className={expanded?"":"line-clamp-2"}>{expanded?name:short}</span><span className="mt-0.5 block text-[9px] font-normal text-ink-400 dark:text-white/40">{expanded?"Réduire":"Voir le nom complet"}</span></button>:<p className="line-clamp-2 text-sm font-medium leading-relaxed text-ink-700 dark:text-white/80">{name}</p>}{product?<a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" title={product.note} className="mt-1 block text-[9px] text-ink-400 underline decoration-ink-200 underline-offset-2 dark:text-white/40">Visuel Carrefour · format indicatif</a>:null}</div>
 </div>;
}
