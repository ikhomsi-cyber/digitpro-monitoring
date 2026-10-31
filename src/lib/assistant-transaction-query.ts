import {z} from 'zod';
import type {AssistantTransactions} from './assistant-transactions';
const parameters=z.object({source:z.enum(['digitpro','bankin']),since:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),until:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),query:z.string().max(160).nullable(),offset:z.number().int().min(0),limit:z.number().int().min(1).max(200),includeHidden:z.boolean()}).strict();
export const assistantTransactionTool={type:'function',name:'read_transactions',description:'Recherche en lecture seule dans tout l’historique importé. Le total et les sommes portent sur TOUTES les lignes filtrées, indépendamment de la page. Ne pas additionner les deux sources sans rapprochement.',strict:true,parameters:{type:'object',additionalProperties:false,required:['source','since','until','query','offset','limit','includeHidden'],properties:{source:{type:'string',enum:['digitpro','bankin']},since:{type:['string','null']},until:{type:['string','null']},query:{type:['string','null']},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:200},includeHidden:{type:'boolean'}}}};
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function readAssistantTransactions(data:AssistantTransactions|undefined,args:unknown){
 const parsed=parameters.safeParse(args);if(!parsed.success)return {error:'Filtre invalide.'};
 const p=parsed.data,source=data?.[p.source];if(!source?.available)return {available:false,error:'Source indisponible.'};
 const needle=fold(p.query??'');
 const rows=source.transactions.filter(r=>(!p.since||r.date>=p.since)&&(!p.until||r.date<=p.until)&&(p.includeHidden||!r.hidden)&&(!needle||fold([r.category,r.subcategory,r.description,r.merchant].filter(Boolean).join(' ')).includes(needle)));
 const page=rows.slice(p.offset,p.offset+p.limit);
 const debit=rows.reduce((sum,r)=>sum+(r.amount<0?-Math.round(r.amount*100):0),0),credit=rows.reduce((sum,r)=>sum+(r.amount>0?Math.round(r.amount*100):0),0);
 return {available:true,source:p.source,totalCount:rows.length,debits:debit/100,credits:credit/100,balance:(credit-debit)/100,transactions:page,nextOffset:p.offset+page.length<rows.length?p.offset+page.length:null};
}
