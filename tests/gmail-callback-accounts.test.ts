import { beforeEach,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),exchange:vi.fn(),email:vi.fn(),read:vi.fn(),save:vi.fn(),cookie:vi.fn(),remove:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mocks.cookie,delete:mocks.remove})}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser}})}));
vi.mock("@/lib/gmail/config",()=>({resolveRequestOrigin:()=>"https://digitpro.test",gmailRedirectUriForOrigin:()=>"https://digitpro.test/api/gmail/callback"}));
vi.mock("@/lib/gmail/oauth",()=>({exchangeGmailCode:mocks.exchange,createGmailOAuthClient:()=>({setCredentials:vi.fn()})}));
vi.mock("@/lib/gmail/fetch-invoices",()=>({fetchGmailAddress:mocks.email}));
vi.mock("@/lib/gmail/tokens",()=>({saveGmailToken:mocks.save,loadGmailTokenRow:mocks.read}));
import { GET } from "@/app/api/gmail/callback/route";
beforeEach(()=>{
 vi.resetAllMocks();mocks.cookie.mockImplementation((name:string)=>({value:name==="gmail_oauth_state"?"state":name==="gmail_oauth_account"?"secondary":name==="gmail_oauth_return"?"courses":undefined}));
 mocks.getUser.mockResolvedValue({data:{user:{id:"owner"}},error:null});
 mocks.exchange.mockResolvedValue({refreshToken:"synthetic-refresh",accessToken:"synthetic-access",expiryDate:null,scope:"read"});
 mocks.email.mockResolvedValue("orders@synthetic.test");
 mocks.read.mockImplementation((_client,_user,slot)=>Promise.resolve(slot==="primary"?{email:"bank@synthetic.test",refresh_token:"synthetic-primary"}:null));
});
const request=()=>new NextRequest("https://digitpro.test/api/gmail/callback?state=state&code=synthetic");
it("saves a second account without replacing the first and returns to groceries",async()=>{
 const response=await GET(request());expect(response.headers.get("location")).toContain("section=courses");
 expect(response.headers.get("location")).toContain("gmail_account=secondary");
 expect(mocks.save).toHaveBeenCalledWith(expect.anything(),"owner",expect.objectContaining({email:"orders@synthetic.test"}),"secondary");
});
it("does not replace an occupied slot with a different mailbox",async()=>{
 mocks.read.mockResolvedValue({email:"existing@synthetic.test",refresh_token:"synthetic"});
 expect((await GET(request())).headers.get("location")).toContain("account_slot_occupied");expect(mocks.save).not.toHaveBeenCalled();
});
it("does not connect the same mailbox twice or save anything after a refused Gmail lookup",async()=>{
 mocks.email.mockResolvedValueOnce("bank@synthetic.test");expect((await GET(request())).headers.get("location")).toContain("account_already_connected");expect(mocks.save).not.toHaveBeenCalled();
 mocks.read.mockClear();mocks.email.mockRejectedValueOnce(Object.assign(new Error("denied"),{code:403}));
 await GET(request());expect(mocks.read).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it("preserves an existing primary account for a consent flow started before slot cookies existed",async()=>{
 mocks.cookie.mockImplementation((name:string)=>({value:name==="gmail_oauth_state"?"state":undefined}));
 await GET(request());expect(mocks.save.mock.calls[0][3]).toBe("secondary");
});
