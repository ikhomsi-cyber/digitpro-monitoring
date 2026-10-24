import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ read:vi.fn(), write:vi.fn(), remove:vi.fn(), create:vi.fn() }));
vi.mock("@/lib/security/integration-secrets", () => ({ readIntegrationSecret:mocks.read, writeIntegrationSecret:mocks.write, deleteIntegrationSecret:mocks.remove }));
vi.mock("@/lib/gmail/oauth", () => ({ createGmailOAuthClient:mocks.create }));
import { gmailAccount } from "@/lib/gmail/accounts";
import { saveGmailToken, deleteGmailToken, withAuthorizedGmailClient, clearGmailTokenIfInvalidGrant } from "@/lib/gmail/tokens";
const client = {} as Parameters<typeof saveGmailToken>[0];
beforeEach(()=>vi.resetAllMocks());
it("accepts only the two fixed account slots",()=>{
 expect(gmailAccount(undefined)).toBe("primary");expect(gmailAccount("secondary")).toBe("secondary");
 expect(()=>gmailAccount("gmail-secondary")).toThrow();expect(()=>gmailAccount({id:"secondary"})).toThrow();
});
it("preserves the primary default and isolates secondary writes and deletion",async()=>{
 await saveGmailToken(client,"owner",{email:"one@synthetic.test",refreshToken:"synthetic-primary"});
 await saveGmailToken(client,"owner",{email:"two@synthetic.test",refreshToken:"synthetic-secondary"},"secondary");
 expect(mocks.write.mock.calls.map(call=>call[2])).toEqual(["gmail","gmail-secondary"]);
 await deleteGmailToken(client,"owner","secondary");
 expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(client,"owner","gmail-secondary");
});
it("does not try the other account when the selected account is missing or access is denied",async()=>{
 const run=vi.fn();mocks.read.mockResolvedValue(null);
 expect(await withAuthorizedGmailClient(client,"owner",run,"secondary")).toBeNull();
 expect(mocks.read).toHaveBeenCalledExactlyOnceWith(client,"owner","gmail-secondary");expect(run).not.toHaveBeenCalled();
 mocks.read.mockReset().mockRejectedValue(new Error("denied"));
 await expect(withAuthorizedGmailClient(client,"owner",run,"secondary")).rejects.toThrow("denied");
 expect(mocks.read).toHaveBeenCalledOnce();
});
it("invalid_grant clears only the selected account",async()=>{
 await clearGmailTokenIfInvalidGrant(client,"owner",{response:{data:{error:"invalid_grant"}}},"secondary");
 expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(client,"owner","gmail-secondary");
});
