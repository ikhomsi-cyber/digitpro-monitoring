import {beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),eq:vi.fn(),read:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
import {GET} from "@/app/api/dashboard/pilote/reconciliation/route";
import {buildBankinPiloteSnapshot} from "@/lib/pilote";
const request=(month="2026-10")=>new Request(`https://digitpro.test/api/dashboard/pilote/reconciliation?month=${month}`);
beforeEach(()=>{vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"synthetic-owner"}},error:null});mocks.eq.mockReturnValue({maybeSingle:mocks.read});mocks.from.mockReturnValue({select:()=>({eq:mocks.eq})});});
it("requires a valid bounded month and owner session",async()=>{
 expect((await GET(request("invalid"))).status).toBe(400);expect(mocks.getUser).not.toHaveBeenCalled();
 mocks.getUser.mockResolvedValue({data:{user:null},error:null});expect((await GET(request())).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();
});
it("returns only eligible expense source fields for the requested month, never labels, account or identities",async()=>{
 const row={sourceRow:2,date:"2026-10-05",amount:-10,parentCategory:"Divers",subCategory:"Test",hidden:false,identity:"private-identity",label:"private-label",account:"private-account"};
 mocks.read.mockResolvedValue({data:{snapshot:buildBankinPiloteSnapshot([row,{...row,sourceRow:3,date:"2026-09-05"},{...row,sourceRow:4,hidden:true},{...row,sourceRow:5,amount:20}],"private-file","fixture")},error:null});
 const response=await GET(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({month:"2026-10",rows:[{sourceRow:2,date:"2026-10-05",expense:10,parent:"Divers",category:"Test"}]});
 expect(mocks.eq).toHaveBeenCalledWith("user_id","synthetic-owner");expect(response.headers.get("cache-control")).toContain("no-store");
});

it('bounds the date/amount diagnostic and never exposes source descriptions',async()=>{
 expect((await GET(new Request('https://digitpro.test/api/dashboard/pilote/reconciliation?month=2026-11&date=2026-10-03&expense=200'))).status).toBe(400);
 const row={sourceRow:2,date:'2026-11-03',amount:-200,parentCategory:'Alimentation',subCategory:'Carrefour',hidden:false,label:'CB BANKIN private detail'};
 mocks.read.mockResolvedValue({data:{snapshot:buildBankinPiloteSnapshot([row,{...row,sourceRow:3,date:'2026-11-04'}],'synthetic','hash')},error:null});
 const response=await GET(new Request('https://digitpro.test/api/dashboard/pilote/reconciliation?month=2026-11&date=2026-11-03&expense=200'));const data=await response.json();expect(data.targetCount).toBe(1);expect(data.rows).toHaveLength(2);expect(data.rows.every((r:{sameDescription:boolean;bankinCard:boolean})=>r.sameDescription&&r.bankinCard)).toBe(true);expect(JSON.stringify(data)).not.toContain('private detail');
});
