import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/sync-job", async original => ({
  ...(await original<object>()),
  withSyncJob: async (_client: unknown, _userId: string, _integration: string, run: () => Promise<unknown>) => run()
}));

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/mobile/auth", async original => ({ ...(await original<object>()), mobileAuth: mocks.auth }));
vi.mock("@/lib/gmail/sync-invoices", () => ({ syncHiwayInvoices: mocks.sync }));
import { POST } from "@/app/api/mobile/v1/invoices/sync/route";
import { MobileError } from "@/lib/mobile/auth";
import { GMAIL_RECONNECT_REQUIRED_MESSAGE } from "@/lib/gmail/oauth-grant";
const client = { authenticated: true };
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({client,userId:"owner"}); mocks.sync.mockResolvedValue([{id:"latest"}]); });
it("requires authentication before Gmail or storage access", async () => {
  mocks.auth.mockRejectedValue(new MobileError(401,"Connexion requise"));
  expect((await POST(new Request("https://test"))).status).toBe(401);
  expect(mocks.sync).not.toHaveBeenCalled();
});
it("uses the shared web synchronizer for the authenticated account", async () => {
  expect(await (await POST(new Request("https://test"))).json()).toEqual({count:1});
  expect(mocks.sync).toHaveBeenCalledWith(client,"owner");
});
it("tells the user to reconnect Gmail without losing existing invoices", async () => {
  mocks.sync.mockRejectedValue(new Error(GMAIL_RECONNECT_REQUIRED_MESSAGE));
  const response=await POST(new Request("https://test"));
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain("Reconnectez Gmail");
});
