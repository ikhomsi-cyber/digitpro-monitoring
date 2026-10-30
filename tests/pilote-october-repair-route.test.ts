import {beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),eq:vi.fn(),read:vi.fn(),write:vi.fn(),update:vi.fn(),repair:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
vi.mock("@/lib/bankin/repair-confirmed-october",()=>({repairConfirmedOctober:mocks.repair}));
import {POST} from "@/app/api/dashboard/pilote/repair-confirmed-october/route";
import {buildBankinPiloteSnapshot} from "@/lib/pilote";
const rows=[0,1].map(i=>({sourceRow:i+2,date:"2026-10-01",amount:-10,parentCategory:"Synthetic",subCategory:"Synthetic",hidden:false,identity:`synthetic-${i}`}));
const stored=buildBankinPiloteSnapshot(rows,"synthetic.xlsx","synthetic");
const fixed=buildBankinPiloteSnapshot(rows.map((r,i)=>({...r,hidden:i===1})),"synthetic.xlsx","synthetic");
const request=(body:unknown={excludeJojo:false},origin="https://digitpro.test")=>new Request("https://digitpro.test/api/dashboard/pilote/repair-confirmed-october",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{
 vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"synthetic-owner"}},error:null});mocks.repair.mockReturnValue(fixed);
 mocks.read.mockResolvedValue({data:{snapshot:stored,updated_at:"2026-10-30T00:00:00Z"},error:null});mocks.write.mockResolvedValue({data:{user_id:"synthetic-owner"},error:null});
 const writer={eq:mocks.eq,select:()=>({maybeSingle:mocks.write})};mocks.eq.mockReturnValue(writer);mocks.update.mockReturnValue(writer);
 mocks.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:mocks.read})}),update:mocks.update});
});
it("rejects cross-origin requests and missing sessions without reading a report",async()=>{
 expect((await POST(request({},"https://other.test"))).status).toBe(403);expect(mocks.getUser).not.toHaveBeenCalled();
 mocks.getUser.mockResolvedValue({data:{user:null},error:null});expect((await POST(request())).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();
});
it("does not exclude the unconfirmed expense unless explicitly selected",async()=>{
 const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({corrected:true,removed:1,amount:10});
 expect(mocks.repair).toHaveBeenCalledWith(stored,false);expect(mocks.eq).toHaveBeenCalledWith("user_id","synthetic-owner");expect(mocks.eq).toHaveBeenCalledWith("updated_at","2026-10-30T00:00:00Z");
 expect(response.headers.get("cache-control")).toContain("no-store");
});
it("validates correction choices before any write",async()=>{
 expect((await POST(request({excludeJojo:"yes"}))).status).toBe(400);expect(mocks.update).not.toHaveBeenCalled();expect(mocks.repair).not.toHaveBeenCalled();
});
it("refuses concurrent updates without claiming success",async()=>{
 mocks.write.mockResolvedValue({data:null,error:null});expect((await POST(request())).status).toBe(409);
});
it("does not write or leak details when the source differs from the approved plan",async()=>{
 mocks.repair.mockImplementation(()=>{throw new Error("private-source-diagnostic")});const response=await POST(request());expect(response.status).toBe(409);expect(await response.text()).not.toContain("private-source-diagnostic");expect(mocks.update).not.toHaveBeenCalled();
});
