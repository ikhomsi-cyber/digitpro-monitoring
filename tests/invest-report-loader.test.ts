import {it,expect,vi} from 'vitest';
import {createInvestReportLoader} from '@/lib/invest-report-loader';
const response=(body:unknown,status=200)=>Response.json(body,{status});
it('shares in-flight reads and reuses the report for one minute, then reloads',async()=>{
 let time=0;const fetcher=vi.fn().mockImplementation(async()=>response({asOf:'2026-11-02'}));const loader=createInvestReportLoader(fetcher,()=>time);
 const one=loader.load(),two=loader.load();expect(one).toBe(two);await one;await loader.load();expect(fetcher).toHaveBeenCalledTimes(1);
 time=60001;await loader.load();expect(fetcher).toHaveBeenCalledTimes(2);
});
it('manual refresh bypasses the cached report and instances never share another owner data',async()=>{
 const fetcher=vi.fn().mockImplementation(async()=>response({asOf:'2026-11-02'}));const first=createInvestReportLoader(fetcher),second=createInvestReportLoader(fetcher);await first.load();expect(second.peek()).toBeNull();await first.load(true);expect(fetcher).toHaveBeenCalledTimes(2);first.clear();expect(first.peek()).toBeNull();
});
it.each([401,403])('clears data and stops further requests after access refusal %s',async status=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({asOf:'2026-11-02'})).mockResolvedValue(response({},status));const loader=createInvestReportLoader(fetcher);await loader.load();await expect(loader.load(true)).rejects.toThrow('Accès refusé');expect(loader.peek()).toBeNull();await expect(loader.load()).rejects.toThrow('Accès refusé');await expect(loader.load(true)).rejects.toThrow('Accès refusé');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('never caches errors and always sends private no-store requests',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response({error:'Unavailable'},503)).mockResolvedValue(response({asOf:'2026-11-02'}));const loader=createInvestReportLoader(fetcher);await expect(loader.load()).rejects.toThrow('Unavailable');expect(loader.peek()).toBeNull();await loader.load();expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
});
