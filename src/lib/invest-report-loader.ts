import type {InvestmentsReport} from './investments';
/** One authenticated dashboard owner only. Never a module-global or persistent financial cache. */
export function createInvestReportLoader(transport:typeof fetch=fetch,now=Date.now){
 let value:InvestmentsReport|null=null,expires=0,pending:Promise<InvestmentsReport>|null=null,controller:AbortController|null=null,denied=false,generation=0;
 const peek=()=>value&&now()<expires?value:null;
 const clear=()=>{generation++;controller?.abort();controller=null;pending=null;value=null;expires=0;};
 const load=(force=false):Promise<InvestmentsReport>=>{
  if(denied)return Promise.reject(new Error('Accès refusé. Reconnectez-vous pour consulter Invest.'));
  if(pending)return pending;
  const fresh=peek();if(!force&&fresh)return Promise.resolve(fresh);
  const current=++generation,abort=new AbortController();controller=abort;
  pending=(async()=>{const response=await transport('/api/dashboard/invest',{cache:'no-store',signal:abort.signal});
   if(response.status===401||response.status===403){denied=true;value=null;expires=0;throw new Error('Accès refusé. Reconnectez-vous pour consulter Invest.');}
   const body=await response.json();if(!response.ok)throw new Error(body.error??'Investissements indisponibles.');
   if(current===generation&&!abort.signal.aborted){value=body;expires=now()+60000;}return body as InvestmentsReport;
  })().finally(()=>{if(current===generation){pending=null;controller=null;}});
  return pending;
 };
 return {load,peek,clear};
}
