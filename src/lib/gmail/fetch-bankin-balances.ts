import 'server-only';
import {google,type Auth,type gmail_v1} from 'googleapis';
import {decodeMimeHeader} from './mime-header';
import {parseBankinBalanceEmail} from './bankin-balance-parser';
export async function fetchBankinBalancePage(auth:Auth.OAuth2Client,cursor?:string,signal?:AbortSignal){
 const gmail=google.gmail({version:'v1',auth});
 const options={timeout:20000,retry:false,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)};
 const listed=await gmail.users.messages.list({userId:'me',q:'from:(bankin.com) (subject:"Balance quotidienne" OR subject:solde OR subject:comptes) -subject:cashback -subject:conversation',maxResults:1,pageToken:cursor},options);
 const points:ReturnType<typeof parseBankinBalanceEmail>=[];let recognized=0;
 for(const row of listed.data.messages??[]){
  if(!row.id)continue;
  const {data:message}=await gmail.users.messages.get({userId:'me',id:row.id,format:'full'},options);
  const header=(name:string)=>decodeMimeHeader(message.payload?.headers?.find(h=>h.name?.toLowerCase()===name)?.value??'');
  const sender=header('from').match(/<?([^\s<>]+@[^\s<>]+)>?/)?.[1]?.toLowerCase();
  if(!sender||!/@(?:[a-z0-9-]+\.)*bankin\.com$/.test(sender))continue;
  let plain='',html='';
  const walk=(part:gmail_v1.Schema$MessagePart)=>{if((part.mimeType==='text/plain'||part.mimeType==='text/html')&&part.body?.data&&part.body.data.length<=2800000){const text=Buffer.from(part.body.data,'base64url').toString('utf8');if(part.mimeType==='text/plain')plain+=text+'\n';if(part.mimeType==='text/html')html+=text+'\n';}for(const child of part.parts??[])walk(child);};
  if(message.payload)walk(message.payload);
  const timestamp=Number(message.internalDate);if(!Number.isFinite(timestamp))continue;
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date(timestamp));
  const parsed=parseBankinBalanceEmail({subject:header('subject'),body:plain||html,date,html:!plain});
  if(parsed.length)recognized++;points.push(...parsed.filter(point=>/\bfortuneo\b/i.test(point.account)).map(point=>({...point,observedAt:timestamp})));
 }
 return {points,scanned:listed.data.messages?.length??0,recognized,next:listed.data.nextPageToken??null};
}
