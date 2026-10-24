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
vi.mock("@/lib/bankin/pilote-store", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/bankin/pilote-store")>(), saveBankinPiloteSnapshot: mocks.snapshot }));
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
it("imports with the authenticated client and returns a private summary without downloading the file", async () => {
  const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ inserted: 1, merged: 2, alreadyImported: false });
  expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("content-type")).toContain("application/json"); expect(response.headers.get("content-disposition")).toBeNull();
  expect(mocks.snapshot).toHaveBeenCalledWith(expect.anything(), "owner", expect.objectContaining({ sourceRows: 1, months: [expect.objectContaining({ categories: [expect.objectContaining({ name: "Original Bankin." })] })] }));
  expect(mocks.lease).toHaveBeenCalledWith(expect.anything(), "owner", "gmail", expect.any(Function));
  expect(mocks.import.mock.calls[0][2]).toMatchObject({ format: "bankin", sourceFilename: "export.xlsx", fileHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
});
it("does not expose provider secrets or import anything after denied access or invalid workbook", async () => {
  mocks.fetch.mockRejectedValueOnce(new Error("private provider token")); const failure = await POST(request()); expect(failure.status).toBe(502); expect(await failure.text()).not.toContain("private provider token"); expect(mocks.import).not.toHaveBeenCalled();
  mocks.parse.mockImplementationOnce(() => { throw new Error("bad workbook"); }); expect((await POST(request())).status).toBe(422); expect(mocks.import).not.toHaveBeenCalled();
});

it("keeps Pilote available when the secondary general transaction import fails", async () => {
  mocks.import.mockRejectedValueOnce(new Error("private database details"));
  const response = await POST(request());
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.warning).toContain("transactions générales");
  expect(JSON.stringify(body)).not.toContain("private database details");
  expect(mocks.snapshot.mock.invocationCallOrder[0]).toBeLessThan(mocks.import.mock.invocationCallOrder[0]);
});
it("reports a Pilote save failure separately and skips secondary imports", async () => {
  mocks.snapshot.mockRejectedValueOnce(new Error("private database details"));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.text()).toContain("bilan Pilote n’a pas pu être enregistré");
  expect(mocks.import).not.toHaveBeenCalled();
});

it("stops on denied secondary access rather than continuing or reporting success", async () => {
  mocks.import.mockRejectedValueOnce(Object.assign(new Error("private refusal"), { code: "42501" }));
  const response = await POST(request());
  expect(response.status).toBe(403);
  expect(mocks.import).toHaveBeenCalledOnce();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});

it("uses only the requested Gmail account and rejects unknown account selectors", async () => {
  const response = await POST(new Request("https://digitpro.test/api/gmail/bankin?account=secondary", {method:"POST",headers:{origin:"https://digitpro.test"}}));
  expect(response.status).toBe(200);
  expect(mocks.gmail).toHaveBeenCalledWith(expect.anything(), "owner", expect.any(Function), "secondary");
  mocks.gmail.mockClear();
  expect((await POST(new Request("https://digitpro.test/api/gmail/bankin?account=other", {method:"POST",headers:{origin:"https://digitpro.test"}}))).status).toBe(400);
  expect(mocks.gmail).not.toHaveBeenCalled();
});
