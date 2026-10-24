import "server-only";
import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { parseGroceryOrder, GROCERY_DOMAINS } from "./parser";
export async function fetchGroceryOrders(auth:OAuth2Client,pageToken?:string){
 const gmail=google.gmail({version:"v1",auth});
 const options={timeout:20000,retry:false,signal:AbortSignal.timeout(180000)};
 const domains=Object.values(GROCERY_DOMAINS).flat().map(domain=>`from:${domain}`).join(" ");
 const result=await gmail.users.messages.list({userId:"me",q:`{${domains}} subject:(commande) {subject:confirmation subject:confirmée subject:validée subject:enregistrée} -in:trash -in:spam`,maxResults:40,pageToken},options);
 const orders=[];let ignored=0;
 for(const item of result.data.messages??[]){
  if(!item.id)continue;
  const {data}=await gmail.users.messages.get({userId:"me",id:item.id,format:"full"},options);
  const header=(name:string)=>data.payload?.headers?.find(h=>h.name?.toLowerCase()===name)?.value??"";
  let html="",plain="",bytes=0;
  const walk=(part:gmail_v1.Schema$MessagePart|undefined,depth=0)=>{
   if(!part||depth>12)return;
   if(!part.filename && part.body?.data && ["text/html","text/plain"].includes(part.mimeType??"")){
    if(part.body.data.length>1400000)throw new Error("Email de commande trop volumineux.");
    const body=Buffer.from(part.body.data,"base64url").toString("utf8");bytes+=Buffer.byteLength(body);
    if(bytes>1000000)throw new Error("Email de commande trop volumineux.");
    if(part.mimeType==="text/html")html+=body+"\n";else plain+=body+"\n";
   }
   for(const child of part.parts??[])walk(child,depth+1);
  };
  walk(data.payload);
  const timestamp=Number(data.internalDate);
  if(!Number.isFinite(timestamp)||timestamp<=0){ignored++;continue;}
  const order=parseGroceryOrder({sender:header("from"),subject:header("subject"),html,plain,receivedDate:new Date(timestamp).toISOString().slice(0,10)});
  if(order)orders.push({messageId:item.id,order});else ignored++;
 }
 return {orders,ignored,scanned:result.data.messages?.length??0,nextPageToken:result.data.nextPageToken??null};
}
