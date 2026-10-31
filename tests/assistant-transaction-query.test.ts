import {expect,it} from 'vitest';
import {buildAssistantTransactions,redactAssistantLabel} from '@/lib/assistant-transactions';
import {readAssistantTransactions} from '@/lib/assistant-transaction-query';
const args={source:'digitpro',since:null,until:null,query:null,offset:1000,limit:200,includeHidden:false};
it('accesses records beyond 500 while aggregating every matching transaction, not just a page',()=>{
 const rows=Array.from({length:1201},(_,i)=>({id:String(i),date:'2026-01-01',amount:-1,label:'Boutique synthétique',company:'private-account',category:'Achats'}));
 const data=buildAssistantTransactions(rows,null,'2026-10-31');const result=readAssistantTransactions(data,args);
 expect(result).toMatchObject({totalCount:1201,debits:1201,nextOffset:1200});expect('transactions' in result&&result.transactions).toHaveLength(200);
 expect(JSON.stringify(result)).not.toContain('private-account');
});
it('rejects arbitrary tools/filters and redacts account identifiers from authorized bank labels',()=>{
 expect(readAssistantTransactions(undefined,{...args,sql:'DROP TABLE'})).toHaveProperty('error');
 expect(redactAssistantLabel('Achat FR76 3000 6000 0112 3456 7890 189 chez Exemple')).not.toContain('FR76');
 expect(readAssistantTransactions(undefined,args)).toMatchObject({available:false});
});
