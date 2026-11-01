import 'server-only';
import {google,type Auth,type gmail_v1} from 'googleapis';
import {decodeMimeHeader} from './mime-header';
import {parseBankinBalanceEmail} from './bankin-balance-parser';
import type {BalanceMailSource} from './balance-sync-plan';
export function bankinBalanceSource(auth:Auth.OAuth2Client,signal?:AbortSignal):BalanceMailSource{
 const gmail=google.gmail({version:'v1',auth});
 const options={timeout:15000,retry:false,signal};
 return {
  async list(q,maxResults,pageToken){const {data}=await gmail.users.messages.list({userId:'me',q,maxResults,pageToken},options);return {ids:(data.messages??[]).flatMap(row=>row.id?[row.id]:[]),next:data.nextPageToken??undefined};},
  async read(id){
   const {data:message}=await gmail.users.messages.get({userId:'me',id,format:'full'},options);
   const header=(name:string)=>decodeMimeHeader(message.payload?.headers?.find(h=>h.name?.toLowerCase()===name)?.value??'');
   const sender=header('from').match(/<?([^\s<>]+@[^\s<>]+)>?/)?.[1]?.toLowerCase();
   if(!sender||!/@(?:[a-z0-9-]+\.)*bankin\.com$/.test(sender))return [];
   let plain='',html='',size=0;
   const walk=(part:gmail_v1.Schema$MessagePart,depth=0)=>{if(depth>20)return;if((part.mimeType==='text/plain'||part.mimeType==='text/html')&&part.body?.data){size+=part.body.data.length;if(size>2800000)throw new Error('Email trop volumineux.');const text=Buffer.from(part.body.data,'base64url').toString('utf8');if(part.mimeType==='text/plain')plain+=text+'\n';else html+=text+'\n';}for(const child of part.parts??[])walk(child,depth+1);};
   if(message.payload)walk(message.payload);
   const timestamp=Number(message.internalDate);if(!Number.isFinite(timestamp))return [];
   const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date(timestamp));
   return parseBankinBalanceEmail({subject:header('subject'),body:plain||html,date,html:!plain}).map(point=>({...point,observedAt:timestamp}));
  }
 };
}
