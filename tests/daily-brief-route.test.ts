import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({user:vi.fn(),mode:vi.fn(),from:vi.fn(),tx:vi.fn(),snapshot:vi.fn(),balance:vi.fn(),owner:vi.fn(),work:vi.fn(),invoices:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>undefined})}));
vi.mock("@/lib/supabase/config",()=>({getSupabaseRuntimeMode:()=>"SUPABASE"}));
vi.mock("@/lib/dashboard-demo-preference",()=>({getDashboardEffectiveDataMode:mocks.mode}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.user},from:mocks.from})}));
vi.mock("@/lib/qonto/live-balance",()=>({loadQontoLiveBalanceEur:mocks.balance}));
vi.mock("@/lib/supabase/daily-brief-work",()=>({loadDailyBriefWork:mocks.work}));
vi.mock("@/lib/gmail/hiway-invoice-store",()=>({loadStoredHiwayInvoices:mocks.invoices}));
import { GET } from "@/app/api/dashboard/daily-brief/route";
beforeEach(()=>{
 vi.resetAllMocks();mocks.mode.mockReturnValue("SUPABASE");mocks.user.mockResolvedValue({data:{user:{id:"synthetic-owner"}},error:null});
 mocks.tx.mockResolvedValue({data:[],error:null});mocks.snapshot.mockResolvedValue({data:null,error:null});mocks.balance.mockResolvedValue(null);mocks.work.mockResolvedValue({days:[],tjm:null,rates:[]});mocks.invoices.mockResolvedValue([]);
 mocks.from.mockImplementation((table:string)=>{
  const builder={select:()=>builder,eq:(key:string,value:string)=>{if(key==="user_id")mocks.owner(table,value);return builder;},gte:()=>builder,lte:()=>builder,order:()=>builder,range:mocks.tx,maybeSingle:mocks.snapshot};return builder;
 });
});
it("scopes both data sources to the authenticated user and never caches the response",async()=>{
 const response=await GET(new Request("https://digitpro.test/api/dashboard/daily-brief"));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
 expect(mocks.owner).toHaveBeenCalledWith("transactions","synthetic-owner");expect(mocks.owner).toHaveBeenCalledWith("bankin_pilote_snapshots","synthetic-owner");
 expect(mocks.balance).toHaveBeenCalledWith("synthetic-owner");
 const body=await response.json();expect(body.household).toBeNull();expect(body.qontoBalance).toBeNull();
});
it("does not query financial data for anonymous callers or demo mode",async()=>{
 mocks.user.mockResolvedValue({data:{user:null},error:null});expect((await GET(new Request("https://digitpro.test/api/dashboard/daily-brief"))).status).toBe(401);
 mocks.user.mockResolvedValue({data:{user:{id:"synthetic-owner"}},error:null});mocks.mode.mockReturnValue("DEMO");expect((await GET(new Request("https://digitpro.test/api/dashboard/daily-brief"))).status).toBe(409);
 expect(mocks.from).not.toHaveBeenCalled();expect(mocks.balance).not.toHaveBeenCalled();
});
it("reports partial data and keeps provider diagnostics private",async()=>{
 mocks.tx.mockResolvedValue({data:null,error:{message:"private-diagnostic"}});
 const response=await GET(new Request("https://digitpro.test/api/dashboard/daily-brief"));expect(response.status).toBe(200);const body=await response.json();expect(body.pro).toBeNull();expect(body.warnings.length).toBeGreaterThan(0);expect(JSON.stringify(body)).not.toContain("private-diagnostic");
});
it("returns an actionable error when both sources are unavailable",async()=>{
 mocks.tx.mockRejectedValue(new Error("private-tx"));mocks.snapshot.mockRejectedValue(new Error("private-snapshot"));
 const response=await GET(new Request("https://digitpro.test/api/dashboard/daily-brief"));expect(response.status).toBe(503);expect(await response.text()).not.toContain("private-");
});
it("returns household comparison aggregates without exposing imported rows",async()=>{
 mocks.snapshot.mockResolvedValue({data:{snapshot:{version:2,months:[],rows:[{sourceRow:1,date:"2026-01-02",amount:-50,parentCategory:"Alimentation",subCategory:"synthetic-private-label",hidden:false}],sourceFilename:"synthetic.xlsx",fileHash:"fixture",sourceRows:1,excludedHidden:0,excludedInternal:0,importedAt:"2026-01-03T00:00:00Z"}},error:null});
 const response=await GET(new Request("https://digitpro.test/api/dashboard/daily-brief"));expect(response.status).toBe(200);const body=await response.json();expect(body.householdHistory).toHaveLength(4);expect(body.householdHistory[0].outOfPocket).toBe(0);expect(JSON.stringify(body)).not.toContain("synthetic-private-label");expect(JSON.stringify(body)).not.toContain('"rows"');
});
it("includes categorized transaction details only for the assistant context",async()=>{
 mocks.tx.mockResolvedValue({data:[{id:"private-id",date:"2026-10-01",label:"private-label",amount:-12,category:"Transport",category_manual:true,scope:"pro"}],error:null});
 mocks.snapshot.mockResolvedValue({data:{snapshot:{version:2,months:[],rows:[{sourceRow:1,date:"2026-10-02",amount:-30,parentCategory:"Alimentation",subCategory:"Courses",hidden:false}],sourceFilename:"private-file",fileHash:"private-hash",sourceRows:1,excludedHidden:0,excludedInternal:0,importedAt:"2026-10-03T00:00:00Z"}},error:null});
 const body=await (await GET(new Request("https://digitpro.test/api/dashboard/daily-brief?assistantContext=1"))).json();
 expect(body.assistantTransactions.digitpro.transactions[0]).toMatchObject({category:"Transport",categoryManual:true});
 expect(body.assistantTransactions.bankin.transactions[0]).toMatchObject({category:"Alimentation",subcategory:"Courses"});
 expect(body.assistantTransactions.digitpro.transactions[0].description).toBe("private-label");expect(JSON.stringify(body.assistantTransactions)).not.toMatch(/private-id|private-account/);
});
