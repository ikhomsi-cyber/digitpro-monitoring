/** Keep product images on known retailer media hosts, without email tracking parameters. */
export function groceryProductImageUrl(value:unknown):string|undefined{
 if(typeof value!=="string"||value.length>2000)return undefined;
 try{const url=new URL(value.replace(/&amp;/g,"&"));
  if(url.protocol!=="https:"||url.username||url.password||url.port||!["media.carrefour.fr","static.carrefour.fr","media.carrefour.eu"].includes(url.hostname))return undefined;
  url.search="";url.hash="";return url.href;
 }catch{return undefined;}
}
export function groceryProductDisplayName(name:string){
 const clean=name.replace(/\s+/g," ").trim();
 if(clean.length<=58)return clean;
 const brand=clean.match(/\b[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9’'&-]{2,}(?:\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9’'&-]{2,})*$/u)?.[0];
 const description=brand?clean.slice(0,-brand.length).trim():clean;
 const words=description.split(" ");let short="";
 for(const word of words){if((short+" "+word).trim().length>(brand?38:54))break;short=(short+" "+word).trim();}
 return `${brand?`${brand} · `:""}${short||description.slice(0,38)}${short!==description?"…":""}`;
}
