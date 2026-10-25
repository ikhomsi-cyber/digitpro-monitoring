import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),mode:vi.fn(),gmail:vi.fn(),fetch:vi.fn(),save:vi.fn(),load:vi.fn(),bankin:vi.fn()}));
vi.mock("@/lib/groceries/bankin-store",()=>({loadBankinGroceryTransactions:mocks.bankin}));
vi.mock("next/headers",()=>({cookies:async()=>({})}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser}})}));
vi.mock("@/lib/supabase/config",()=>({getSupabaseRuntimeMode:()=>"SUPABASE"}));
vi.mock("@/lib/dashboard-demo-preference",()=>({getDashboardEffectiveDataMode:mocks.mode}));
vi.mock("@/lib/security/sync-job",()=>({withSyncJob:async(_c:unknown,_u:unknown,_i:unknown,run:()=>Promise<unknown>)=>run(),SyncBusyError:class extends Error{}}));
vi.mock("@/lib/gmail/tokens",()=>({withAuthorizedGmailClient:mocks.gmail}));
vi.mock("@/lib/groceries/fetch-orders",()=>({fetchGroceryOrders:mocks.fetch}));
vi.mock("@/lib/groceries/store",()=>({saveGroceryOrder:mocks.save,loadGroceryOrders:mocks.load}));
import { GET,POST } from "@/app/api/gmail/groceries/route";
const request=(body:unknown={account:"secondary"},origin="https://digitpro.test")=>new Request("https://digitpro.test/api/gmail/groceries",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.bankin.mockResolvedValue({transactions:[],truncated:false});mocks.mode.mockReturnValue("SUPABASE");mocks.getUser.mockResolvedValue({data:{user:{id:"owner"}},error:null});mocks.gmail.mockImplementation((_c,_u,run)=>run({}));mocks.fetch.mockResolvedValue({orders:[],scanned:2,ignored:2,nextPageToken:null});mocks.load.mockResolvedValue({orders:[],truncated:false});});
it("uses only the explicitly selected mailbox and authenticated owner",async()=>{
 const response=await POST(request());expect(response.status).toBe(200);expect(mocks.gmail).toHaveBeenCalledWith(expect.anything(),"owner",expect.any(Function),"secondary");
 expect((await GET(new Request("https://digitpro.test/api/gmail/groceries"))).headers.get("cache-control")).toContain("no-store");
});
it("rejects cross-site, demo and forged input without touching Gmail",async()=>{
 expect((await POST(request({},"https://attacker.test"))).status).toBe(403);
 expect((await POST(request({account:"secondary",userId:"other"}))).status).toBe(400);
 mocks.mode.mockReturnValue("DEMO");expect((await POST(request())).status).toBe(403);expect(mocks.gmail).not.toHaveBeenCalled();
});
it("stops on a refused mailbox and never tries the primary account",async()=>{
 mocks.fetch.mockRejectedValue(Object.assign(new Error("private provider details"),{response:{status:403}}));
 const response=await POST(request());expect(response.status).toBe(403);expect(mocks.gmail).toHaveBeenCalledOnce();expect(mocks.save).not.toHaveBeenCalled();expect(await response.text()).not.toContain("private provider details");
});
it("includes the owner's Bankin food debits and reports partial data explicitly",async()=>{
 mocks.bankin.mockResolvedValue({transactions:[{id:"synthetic-1",date:"2026-10-02",label:"CB LIDL",category:"Alimentation",amount:-25}],truncated:false});
 const body=await (await GET(new Request("https://digitpro.test/api/gmail/groceries"))).json();
 expect(mocks.bankin).toHaveBeenCalledWith(expect.anything(),"owner");
 expect(body.orders).toEqual([expect.objectContaining({source:"bankin",merchant:"Lidl",totalCents:2500,items:[]})]);
 expect(body.bankinPurchases).toEqual([]);
 mocks.bankin.mockRejectedValue(new Error("private database diagnostic"));
 const partial=await (await GET(new Request("https://digitpro.test/api/gmail/groceries"))).json();expect(partial.warning).toContain("seuls les achats Gmail");expect(JSON.stringify(partial)).not.toContain("private database");
});
it("does not read Bankin or mail orders without authentication or in demo mode",async()=>{
 mocks.getUser.mockResolvedValue({data:{user:null},error:null});
 expect((await GET(new Request("https://digitpro.test/api/gmail/groceries"))).status).toBe(401);expect(mocks.bankin).not.toHaveBeenCalled();expect(mocks.load).not.toHaveBeenCalled();
 mocks.getUser.mockResolvedValue({data:{user:{id:"owner"}},error:null});mocks.mode.mockReturnValue("DEMO");
 expect((await GET(new Request("https://digitpro.test/api/gmail/groceries"))).status).toBe(200);expect(mocks.bankin).not.toHaveBeenCalled();
});
it("loads a lightweight overview without requesting product lines",async()=>{
 const response=await GET(new Request("https://digitpro.test/api/gmail/groceries?view=summary"));
 expect(response.status).toBe(200);expect(mocks.load).toHaveBeenCalledWith(expect.anything(),"owner",{summaryOnly:true});expect(mocks.bankin).toHaveBeenCalledOnce();
});
it("fetches product details only for a validated period without reloading Bankin",async()=>{
 const response=await GET(new Request("https://digitpro.test/api/gmail/groceries?view=products&period=2026-10"));
 expect(response.status).toBe(200);expect(mocks.load).toHaveBeenCalledWith(expect.anything(),"owner",{period:"2026-10"});expect(mocks.bankin).not.toHaveBeenCalled();
});
it("rejects invalid product periods without querying financial records",async()=>{
 expect((await GET(new Request("https://digitpro.test/api/gmail/groceries?view=products&period=2026-99"))).status).toBe(400);expect(mocks.load).not.toHaveBeenCalled();expect(mocks.bankin).not.toHaveBeenCalled();
});
