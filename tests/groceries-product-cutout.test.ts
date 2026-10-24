import { expect,it } from "vitest";
import { removeProductBackdrop } from "@/lib/groceries/product-cutout";
it("removes the exterior white background but preserves enclosed white packaging",()=>{
 const width=5,pixels=new Uint8ClampedArray(width*width*4).fill(255);
 for(let y=1;y<4;y++)for(let x=1;x<4;x++)if(x!==2||y!==2){const i=(y*width+x)*4;pixels[i]=20;pixels[i+1]=80;pixels[i+2]=180;}
 const result=removeProductBackdrop(pixels,width,width);
 expect(result[3]).toBe(0);expect(result[(2*width+2)*4+3]).toBe(255);expect(result[(1*width+1)*4+3]).toBe(255);
 expect(pixels[3]).toBe(255);
});
it("preserves colored pixels and handles already transparent borders",()=>{
 expect([...removeProductBackdrop(new Uint8ClampedArray([255,20,20,255]),1,1)]).toEqual([255,20,20,255]);
 expect(removeProductBackdrop(new Uint8ClampedArray([255,255,255,0]),1,1)[3]).toBe(0);
});
