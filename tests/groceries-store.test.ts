import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {saveGroceryOrder} from '@/lib/groceries/store';
const item={name:'Produit fictif',productKey:'produit fictif',quantity:2,unitPriceCents:150,totalCents:300};
const order={merchant:'Carrefour',orderRef:'TEST1234',date:'2026-10-16',totalCents:300,items:[item]};
function client(existing:unknown){
 const query:any={};for(const method of ['select','eq'])query[method]=vi.fn(()=>query);
 query.maybeSingle=vi.fn(async()=>({data:existing,error:null}));
 query.then=(resolve:any)=>resolve({error:null});
 query.update=vi.fn(()=>query);
 return {db:{from:vi.fn(()=>query)} as any,query};
}
it('enriches an already imported order with its newly recognized total without erasing its products',async()=>{
 const {db,query}=client({id:'test',items:[item,{...item,name:'Autre produit fictif'}],total_cents:null});
 expect(await saveGroceryOrder(db,'user-test','secondary','message-test',{...order,items:[]})).toBe(true);
 expect(query.update.mock.calls[0][0]).toMatchObject({total_cents:300,items:[item,{...item,name:'Autre produit fictif'}]});
});
it('keeps a known total when enriching missing products, and skips identical reimports',async()=>{
 const a=client({id:'test',items:[],total_cents:300});
 expect(await saveGroceryOrder(a.db,'user-test','secondary','message-test',{...order,totalCents:null})).toBe(true);
 expect(a.query.update.mock.calls[0][0]).toMatchObject({total_cents:300,items:[item]});
 const b=client({id:'test',items:[item],total_cents:300});
 expect(await saveGroceryOrder(b.db,'user-test','secondary','message-test',order)).toBe(false);
 expect(b.query.update).not.toHaveBeenCalled();
});
