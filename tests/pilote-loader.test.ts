import { expect,it,vi } from 'vitest';
import { createPiloteLoader } from '@/lib/bankin/pilote-loader';
const payload={snapshot:null,daily:null};
it('shares prefetch, concurrent tab loads and subsequent reads inside one dashboard',async()=>{
 const fetcher=vi.fn(async()=>Response.json(payload));const load=createPiloteLoader(fetcher);
 const warm=load();expect(load()).toBe(warm);await warm;
 expect(await load()).toEqual(payload);expect(fetcher).toHaveBeenCalledTimes(1);
 expect(fetcher).toHaveBeenCalledWith('/api/dashboard/pilote',{cache:'no-store'});
});
it('refreshes explicitly after import and keeps separate dashboard instances isolated',async()=>{
 const fetcher=vi.fn(async()=>Response.json(payload));const load=createPiloteLoader(fetcher);
 await load();await load(true);expect(fetcher).toHaveBeenCalledTimes(2);
 await createPiloteLoader(fetcher)();expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not replay denied requests or switch endpoints after a refusal',async()=>{
 const fetcher=vi.fn(async()=>new Response('',{status:403}));const load=createPiloteLoader(fetcher);
 await expect(load()).rejects.toThrow('indisponible');await expect(load()).rejects.toThrow('indisponible');
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('allows a later tab request to retry a failed background prefetch, while never reusing that failure',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(Response.json(payload));
 const load=createPiloteLoader(fetcher);
 await expect(load()).rejects.toThrow('indisponible');expect(await load()).toEqual(payload);
 expect(fetcher).toHaveBeenCalledTimes(2);
});
