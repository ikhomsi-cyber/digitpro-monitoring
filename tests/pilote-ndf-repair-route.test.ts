import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
import {POST} from "@/app/api/dashboard/pilote/repair-confirmed-ndf/route";
it("rejects a foreign origin before accessing the account",async()=>{expect((await POST(new Request("https://digitpro.test/api/dashboard/pilote/repair-confirmed-ndf",{method:"POST",headers:{origin:"https://other.test"}}))).status).toBe(403);expect(mocks.getUser).not.toHaveBeenCalled()});
it("requires the owner session before reading the Bankin source",async()=>{mocks.getUser.mockResolvedValue({data:{user:null},error:null});expect((await POST(new Request("https://digitpro.test/api/dashboard/pilote/repair-confirmed-ndf",{method:"POST",headers:{origin:"https://digitpro.test"}}))).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled()});
