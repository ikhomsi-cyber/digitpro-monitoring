import {vi,it,expect} from 'vitest';
vi.mock('server-only',()=>({}));vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {importTransactionsWithClient} from '@/lib/import-transactions';
import {transactionImportHash} from '@/lib/transaction-hash';
import {buildBankinPiloteSnapshot} from '@/lib/pilote';
import {mergeBankinPiloteSnapshots} from '@/lib/bankin/merge-pilote';
it('adds old Bankin occurrences without altering matched source categories or visibility',()=>{
 const row={identity:'known',sourceRow:2,date:'2016-01-01',amount:-10,parentCategory:'Logement',subCategory:'Corrected',hidden:true};
 const old=buildBankinPiloteSnapshot([row],'saved.xlsx','saved');
 const incoming=buildBankinPiloteSnapshot([{...row,hidden:false,subCategory:'Old'},{...row,identity:'older',date:'2013-01-01',sourceRow:3}],'historical.xls','new');
 const merged=mergeBankinPiloteSnapshots(old,incoming,{missingOnly:true});expect(merged.rows).toHaveLength(2);expect(merged.rows?.[0]).toEqual(row);expect(merged.rows?.[1].date).toBe('2013-01-01');expect(mergeBankinPiloteSnapshots(merged,incoming,{missingOnly:true})).toBe(merged);
});
it('does not update existing general transactions in missing-only mode',async()=>{
 const known={date:'2016-01-01',label:'Synthetic known',category:'Divers',amount:-10,company:'Synthetic Bank',scope:'personal' as const};const added={...known,date:'2013-01-01',label:'Synthetic old'};
 const updates:unknown[]=[];const inserts:unknown[]=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:(table:string)=>{
  let operation='select',columns='',payload:unknown;
  const q:any={select:(value:string)=>{columns=value;return q;},insert:(value:unknown)=>{operation='insert';payload=value;if(table==='transactions')inserts.push(value);return q;},update:(value:unknown)=>{operation='update';payload=value;if(table==='transactions')updates.push(value);return q;},upsert:()=>q,eq:()=>q,in:()=>q,gte:()=>q,order:()=>q,limit:()=>q,single:()=>Promise.resolve({data:{id:'session'},error:null}),maybeSingle:()=>Promise.resolve({data:null,error:null}),then:(resolve:any)=>{
   let data:unknown[]=[];
   if(table==='transactions'&&operation==='select'&&columns.includes('content_hash'))data=[{id:'existing',content_hash:transactionImportHash(known),category_manual:true}];
   if(table==='transactions'&&operation==='insert')data=(payload as unknown[]).map((row:any)=>({...row,id:'new-id'}));
   return Promise.resolve({data,error:null}).then(resolve);
  }};return q;
 }} as unknown as Parameters<typeof importTransactionsWithClient>[0];
 const result=await importTransactionsWithClient(client,[known,added],{sourceFilename:'synthetic.xls',format:'bankin',fileHash:null},{missingOnly:true});expect(updates).toEqual([]);expect(inserts).toHaveLength(1);expect((inserts[0] as unknown[])).toHaveLength(1);expect(result.inserted).toHaveLength(1);expect(result.merged).toBe(0);
});
