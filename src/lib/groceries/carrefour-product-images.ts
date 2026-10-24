import { groceryProductKey } from "./parser";
import { groceryProductImageUrl } from "./product-display";

export type CarrefourProductImage={imageUrl:string;localImageUrl?:string;sourceUrl:string;note:string};

/** Public Carrefour product-page matches; the catalog is loaded separately from the page bundle. */
const products = new Map<string,CarrefourProductImage>([
 [groceryProductKey("Fromage blanc aux fruits fraise banane framboise abricot pêche/abricot DANONINO"),{
  localImageUrl:"/images/products/danonino-fruits.jpg",
  imageUrl:"https://media.carrefour.fr/media/referential/media/ff042aeeab4d483abc1aa3152451b1b7/p_1500x1500/03033491225284_H1N1_s17.png",
  sourceUrl:"https://www.carrefour.fr/p/fromage-blanc-aux-fruits-fraise-banane-framboise-abricot-peche-abricot-danonino-3033491225284",
  note:"Visuel Carrefour · conditionnement indicatif (12 × 50 g)."
 }]
]);
export function carrefourProductImage(name:string){return products.get(groceryProductKey(name));}

let catalogRequest:Promise<void>|null=null;
/** Public product catalog only, fetched once when a category is expanded, never on page entry. */
export function loadCarrefourProductImages(fetcher:typeof fetch=fetch){
 if(catalogRequest)return catalogRequest;
 const pending=(async()=>{
  const response=await fetcher("/images/products/carrefour-catalog.json");
  if(!response.ok)throw new Error("Catalogue photos indisponible.");
  const catalog:unknown=await response.json();
  if(!catalog||typeof catalog!=="object"||Array.isArray(catalog))throw new Error("Catalogue photos invalide.");
  for(const [key,value] of Object.entries(catalog)){
   if(!value||typeof value!=="object")continue;
   const entry=value as Record<string,unknown>;
   const imageUrl=groceryProductImageUrl(entry.imageUrl);
   if(!imageUrl||typeof entry.sourceUrl!=="string"||!entry.sourceUrl.startsWith("https://www.carrefour.fr/p/"))continue;
   const localImageUrl=typeof entry.localImageUrl==="string"&&/^\/images\/products\/carrefour\/[a-f0-9]{20}\.png$/.test(entry.localImageUrl)?entry.localImageUrl:undefined;
   products.set(key,{imageUrl,localImageUrl,sourceUrl:entry.sourceUrl,note:"Visuel Carrefour · conditionnement indicatif."});
  }
 })();
 catalogRequest=pending;
 void pending.catch(()=>{if(catalogRequest===pending)catalogRequest=null;});
 return pending;
}
