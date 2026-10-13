import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({auth:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn(),single:vi.fn()}));
vi.mock("@/lib/mobile/auth",async original=>({...await original<object>(),mobileAuth:mocks.auth}));
import { GET } from "@/app/api/mobile/v1/pilote/route";
import { MobileError } from "@/lib/mobile/auth";
beforeEach(()=>{
 vi.clearAllMocks();mocks.from.mockReturnValue({select:mocks.select});mocks.select.mockReturnValue({eq:mocks.eq});mocks.eq.mockReturnValue({maybeSingle:mocks.single});
 mocks.single.mockResolvedValue({data:null,error:null});mocks.auth.mockResolvedValue({userId:'owner',client:{from:mocks.from}});
});
it("reads only the authenticated owner's snapshot and prevents caching",async()=>{
 const result=await GET(new Request("https://test/api/mobile/v1/pilote"));expect(result.status).toBe(200);
 expect(mocks.from).toHaveBeenCalledWith('bankin_pilote_snapshots');expect(mocks.eq).toHaveBeenCalledWith('user_id','owner');
 expect(result.headers.get('cache-control')).toBe('private, no-store');expect(result.headers.get('vary')).toBe('Authorization');
});
it("rejects invalid parameters before accessing financial data",async()=>{
 for(const query of ['period=2026-13','views=other','travelScope=unknown','travelYear=x'])expect((await GET(new Request('https://test/api?'+query))).status).toBe(400);
 expect(mocks.from).not.toHaveBeenCalled();
});
it("rejects absent/expired sessions without querying the snapshot",async()=>{
 mocks.auth.mockRejectedValue(new MobileError(401,'Session expirée.'));
 expect((await GET(new Request('https://test/api'))).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();
});
it("does not leak database errors or return incomplete totals",async()=>{
 mocks.single.mockResolvedValue({data:null,error:{message:'private database detail'}});
 const result=await GET(new Request('https://test/api'));expect(result.status).toBe(503);expect(await result.text()).not.toContain('private database detail');
});
