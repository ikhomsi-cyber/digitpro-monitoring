"use client";
export function GroceryProductImage({src,onError}:{src:string;onError:()=>void}){
 return <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-white p-2.5 ring-1 ring-inset ring-black/5"><img key={src} src={src} alt="" width={80} height={80} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={onError} className="h-full w-full object-contain"/></span>;
}
