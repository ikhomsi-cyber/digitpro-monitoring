import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),read:vi.fn(),write:vi.fn(),from:vi.fn(),update:vi.fn(),eq:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
import { POST } from "@/app/api/dashboard/pilote/repair-confirmed-tax/route";
import { buildBankinPiloteSnapshot } from "@/lib/pilote";
import { decodePiloteStorage } from "@/lib/bankin/pilote-storage";
const stored=buildBankinPiloteSnapshot(["keep","remove"].map((identity,i)=>({identity,sourceRow:i+2,date:"2026-10-26",amount:-5760,hidden:false,parentCategory:"Impôts & Taxes",subCategory:"Impôts sur le revenu"})),"synthetic.xlsx","synthetic");
const request=(origin="https://digitpro.test")=>new Request("https://digitpro.test/api/dashboard/pilote/repair-confirmed-tax",{method:"POST",headers:{origin}});
beforeEach(()=>{
 vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"synthetic-owner"}},error:null});
 mocks.read.mockResolvedValue({data:{snapshot:stored,updated_at:"2026-10-30T00:00:00Z"},error:null});
 mocks.write.mockResolvedValue({data:{user_id:"synthetic-owner"},error:null});
 const writer={eq:mocks.eq,select:()=>({maybeSingle:mocks.write})};mocks.eq.mockReturnValue(writer);mocks.update.mockReturnValue(writer);
 mocks.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:mocks.read})}),update:mocks.update});
});
it("rejects cross-origin requests before any authentication or database access",async()=>{
 expect((await POST(request("https://other.test"))).status).toBe(403);expect(mocks.from).not.toHaveBeenCalled();expect(mocks.getUser).not.toHaveBeenCalled();
});
it("rejects missing sessions without querying reports",async()=>{
 mocks.getUser.mockResolvedValue({data:{user:null},error:null});expect((await POST(request())).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();
});
it("writes only the authenticated owner's unchanged revision and returns no source rows",async()=>{
 const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({corrected:true,removed:1,amount:5760});
 expect(mocks.eq).toHaveBeenCalledWith("user_id","synthetic-owner");expect(mocks.eq).toHaveBeenCalledWith("updated_at","2026-10-30T00:00:00Z");
 const value=mocks.update.mock.calls[0][0];expect(decodePiloteStorage(value.snapshot).rows?.filter(r=>!r.hidden)).toHaveLength(1);
 expect(response.headers.get("cache-control")).toContain("no-store");
});
it("does not claim success on a concurrent update",async()=>{
 mocks.write.mockResolvedValue({data:null,error:null});expect((await POST(request())).status).toBe(409);
});
it("does not write when already corrected or when the stored candidates changed",async()=>{
 mocks.read.mockResolvedValue({data:{snapshot:{...stored,rows:stored.rows!.slice(0,1)},updated_at:"fixture"},error:null});
 expect((await POST(request())).status).toBe(200);expect(mocks.update).not.toHaveBeenCalled();
 mocks.read.mockResolvedValue({data:{snapshot:{...stored,rows:[]},updated_at:"fixture"},error:null});
 expect((await POST(request())).status).toBe(409);expect(mocks.update).not.toHaveBeenCalled();
});
