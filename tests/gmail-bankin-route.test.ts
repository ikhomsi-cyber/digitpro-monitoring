import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), mode: vi.fn(), user: vi.fn(), lease: vi.fn(), gmail: vi.fn(), fetch: vi.fn(), parse: vi.fn(), import: vi.fn(), revalidate: vi.fn(), source: vi.fn(), snapshot: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseRuntimeMode: () => "SUPABASE" }));
vi.mock("@/lib/dashboard-demo-preference", () => ({ getDashboardEffectiveDataMode: mocks.mode }));
vi.mock("@/lib/security/sync-job", () => ({ withSyncJob: mocks.lease, SyncBusyError: class extends Error {} }));
vi.mock("@/lib/gmail/tokens", () => ({ withAuthorizedGmailClient: mocks.gmail }));
vi.mock("@/lib/gmail/fetch-bankin-export", () => ({ fetchLatestBankinExport: mocks.fetch, BankinExportError: class extends Error {} }));
vi.mock("@/lib/bankin/parse-xlsx", () => ({ parseBankinTransactionsWorkbook: mocks.parse, parseBankinPiloteWorkbook: mocks.source }));
vi.mock("@/lib/import-transactions", () => ({ importTransactionsWithClient: mocks.import }));
vi.mock("@/lib/bankin/pilote-store", () => ({ saveBankinPiloteSnapshot: mocks.snapshot }));
import { POST } from "@/app/api/gmail/bankin/route";
const request = (origin = "https://digitpro.test") => new Request("https://digitpro.test/api/gmail/bankin", { method: "POST", headers: { origin } });
beforeEach(() => {
  vi.resetAllMocks(); mocks.mode.mockReturnValue("SUPABASE");
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user } }); mocks.user.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.lease.mockImplementation((_client, _user, _integration, run) => run());
  mocks.gmail.mockImplementation((_client, _user, run) => run({}));
  mocks.fetch.mockResolvedValue({ buffer: Buffer.from("excel"), filename: "export.xlsx", receivedAt: "2026-10-11T00:00:00.000Z" });
  mocks.source.mockReturnValue([{ sourceRow: 2, date: "2026-10-01", amount: -5, parentCategory: "Original Bankin.", subCategory: "Original sous-catégorie", hidden: false }]);
  mocks.snapshot.mockResolvedValue(undefined);
  mocks.parse.mockReturnValue([{ date: "2026-10-01", amount: -5 }]);
  mocks.import.mockResolvedValue({ inserted: [{ id: "new" }], merged: 2, fileAlreadyImported: false });
});
it("rejects cross-site requests and demo writes before touching Gmail", async () => {
  expect((await POST(request("https://attacker.test"))).status).toBe(403); expect(mocks.client).not.toHaveBeenCalled();
  mocks.mode.mockReturnValue("DEMO"); expect((await POST(request())).status).toBe(403); expect(mocks.gmail).not.toHaveBeenCalled();
});
it("rejects unauthenticated users and disconnected Gmail without importing", async () => {
  mocks.user.mockResolvedValueOnce({ data: { user: null }, error: null }); expect((await POST(request())).status).toBe(401); expect(mocks.lease).not.toHaveBeenCalled();
  mocks.gmail.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(409); expect(mocks.import).not.toHaveBeenCalled();
});
it("imports with the authenticated client and streams the same private download with metadata", async () => {
  const response = await POST(request()); expect(response.status).toBe(200); expect(await response.text()).toBe("excel");
  expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("x-import-inserted")).toBe("1"); expect(response.headers.get("x-import-merged")).toBe("2");
  expect(mocks.snapshot).toHaveBeenCalledWith(expect.anything(), "owner", expect.objectContaining({ sourceRows: 1, months: [expect.objectContaining({ categories: [expect.objectContaining({ name: "Original Bankin." })] })] }));
  expect(mocks.lease).toHaveBeenCalledWith(expect.anything(), "owner", "gmail", expect.any(Function));
  expect(mocks.import.mock.calls[0][2]).toMatchObject({ format: "bankin", sourceFilename: "export.xlsx", fileHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
});
it("does not expose provider secrets or import anything after denied access or invalid workbook", async () => {
  mocks.fetch.mockRejectedValueOnce(new Error("private provider token")); const failure = await POST(request()); expect(failure.status).toBe(502); expect(await failure.text()).not.toContain("private provider token"); expect(mocks.import).not.toHaveBeenCalled();
  mocks.parse.mockImplementationOnce(() => { throw new Error("bad workbook"); }); expect((await POST(request())).status).toBe(422); expect(mocks.import).not.toHaveBeenCalled();
});
