"use client";

import { useRef,useState } from "react";
import { removeProductBackdrop } from "@/lib/groceries/product-cutout";

export function GroceryProductImage({src,onError}:{src:string;onError:()=>void}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const [readySrc,setReadySrc]=useState<string|null>(null);
 const onLoad=(image:HTMLImageElement)=>{
  const canvas=canvasRef.current;
  if(!canvas)return;
  try{
   const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)return;
   const scale=Math.min(1,160/Math.max(image.naturalWidth,image.naturalHeight));
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   context.drawImage(image,0,0,canvas.width,canvas.height);
   const data=context.getImageData(0,0,canvas.width,canvas.height);
   data.data.set(removeProductBackdrop(data.data,canvas.width,canvas.height));context.putImageData(data,0,0);setReadySrc(src);
  }catch{ /* Keep the original visible if a remote host disallows reading pixels. */ }
 };
 return <span className="relative block h-12 w-12">
  <img key={src} src={src} crossOrigin={src.startsWith("/")?undefined:"anonymous"} alt="" width={48} height={48} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={event=>onLoad(event.currentTarget)} onError={onError} className={`h-12 w-12 object-contain ${readySrc===src?"invisible":"mix-blend-multiply"}`}/>
  <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 h-12 w-12 object-contain ${readySrc===src?"":"invisible"}`}/>
 </span>;
}
