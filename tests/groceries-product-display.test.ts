import { expect,it,vi } from "vitest";
import { groceryProductDisplayName,groceryProductImageUrl } from "@/lib/groceries/product-display";
import { carrefourProductImage,loadCarrefourProductImages } from "@/lib/groceries/carrefour-product-images";
const name="Fromage blanc aux fruits fraise banane framboise abricot pêche/abricot DANONINO";
it("shortens the display name while keeping the brand and leaves short names intact",()=>{
 expect(groceryProductDisplayName(name)).toContain("DANONINO");
 expect(groceryProductDisplayName(name).length).toBeLessThan(name.length);
 expect(groceryProductDisplayName("Lait 1 L")).toBe("Lait 1 L");
});
it("uses a verified Carrefour product-page match without guessing other product pictures",()=>{
 expect(carrefourProductImage(name)?.sourceUrl).toMatch(/^https:\/\/www.carrefour.fr\/p\//);
 expect(carrefourProductImage("Produit fictif")).toBeUndefined();
});
it("accepts only retailer image hosts and removes tracking parameters",()=>{
 expect(groceryProductImageUrl("https://media.carrefour.fr/product.png?tracking=test")).toBe("https://media.carrefour.fr/product.png");
 for(const value of ["https://attacker.test/image.png","http://media.carrefour.fr/a","https://media.carrefour.fr.attacker.test/a","javascript:alert(1)","https://user:pass@media.carrefour.fr/a"])expect(groceryProductImageUrl(value)).toBeUndefined();
});
it("loads the public catalog once for multiple expanded products and rejects foreign image hosts",async()=>{
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({
  "catalogue test":{imageUrl:"https://media.carrefour.fr/test.png",sourceUrl:"https://www.carrefour.fr/p/test-123",localImageUrl:"/images/products/carrefour/abcdef0123456789abcd.png"},
  "foreign test":{imageUrl:"https://attacker.test/test.png",sourceUrl:"https://www.carrefour.fr/p/test-123"}
 }))) as typeof fetch;
 const first=loadCarrefourProductImages(fetcher),second=loadCarrefourProductImages(fetcher);
 expect(first).toBe(second);await first;expect(fetcher).toHaveBeenCalledTimes(1);
 expect(carrefourProductImage("Catalogue test")?.localImageUrl).toBe("/images/products/carrefour/abcdef0123456789abcd.png");
 expect(carrefourProductImage("Foreign test")).toBeUndefined();
});
