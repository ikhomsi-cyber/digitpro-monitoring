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
it('omits product payloads from the initial summary query and scopes detail reads by owner and period',async()=>{
 const query:any={};for(const method of ['select','eq','order','gte','lt'])query[method]=vi.fn(()=>query);
 query.limit=vi.fn(async()=>({data:[{id:'fixture',merchant:'Carrefour',order_ref:'TEST1234',ordered_at:'2026-10-16',total_cents:300,gmail_account:'primary',items:[item]}],error:null}));
 const db={from:()=>query} as any;
 const {loadGroceryOrders}=await import('@/lib/groceries/store');
 const summary=await loadGroceryOrders(db,'synthetic-owner',{summaryOnly:true});
 expect(query.select.mock.calls[0][0].split(',')).not.toContain('items');expect(summary.orders[0].items).toEqual([]);expect(query.eq).toHaveBeenCalledWith('user_id','synthetic-owner');
 const detailed=await loadGroceryOrders(db,'synthetic-owner',{period:'2026-10'});
 expect(query.gte).toHaveBeenCalledWith('ordered_at','2026-10-01');expect(query.lt).toHaveBeenCalledWith('ordered_at','2026-11-01');expect(detailed.orders[0].items).toHaveLength(1);
});
