import { expect,it } from "vitest";
import { existsSync,readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groceryProductImageUrl } from "@/lib/groceries/product-display";

it("keeps photo sources on Carrefour and all local thumbnail references valid",()=>{
 const catalog=JSON.parse(readFileSync(resolve("public/images/products/carrefour-catalog.json"),"utf8")) as Record<string,{imageUrl:string;sourceUrl:string;localImageUrl?:string}>;
 expect(Object.keys(catalog).length).toBeGreaterThan(1);
 for(const entry of Object.values(catalog)){
  expect(groceryProductImageUrl(entry.imageUrl)).toBeTruthy();
  expect(new URL(entry.sourceUrl).hostname).toBe("www.carrefour.fr");
  if(entry.localImageUrl){
   expect(entry.localImageUrl).toMatch(/^\/images\/products\/carrefour\/[a-f0-9]{20}\.png$/);
   const path=resolve("public",entry.localImageUrl.slice(1));expect(existsSync(path)).toBe(true);
   expect(readFileSync(path).subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  }
 }
});
