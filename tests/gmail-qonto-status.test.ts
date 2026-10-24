import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({gmail:vi.fn(),user:vi.fn()}));
vi.mock("next/headers",()=>({cookies:vi.fn(),headers:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.user}})}));
vi.mock("@/lib/gmail/tokens",()=>({withAuthorizedGmailClient:mocks.gmail,loadGmailTokenRow:vi.fn(),deleteGmailToken:vi.fn()}));
import { fetchUpcomingQontoDebits } from "@/app/dashboard/gmail-actions";
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({data:{user:{id:"owner"}}});});
it("distinguishes a disconnected mailbox from a connected mailbox with no announced debit",async()=>{
 mocks.gmail.mockResolvedValueOnce(null);expect(await fetchUpcomingQontoDebits()).toEqual({debits:[],connected:false});
 mocks.gmail.mockResolvedValueOnce([]);expect(await fetchUpcomingQontoDebits()).toEqual({debits:[],connected:true});
 expect(mocks.gmail).toHaveBeenCalledWith(expect.anything(),"owner",expect.any(Function),"primary");
});
it("does not turn a denied Gmail access into an empty successful result",async()=>{
 mocks.gmail.mockRejectedValue(new Error("denied"));await expect(fetchUpcomingQontoDebits()).rejects.toThrow("denied");expect(mocks.gmail).toHaveBeenCalledOnce();
});
