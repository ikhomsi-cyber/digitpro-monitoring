import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn(), ingest: vi.fn(), mode: vi.fn(), powens: vi.fn() }));
vi.mock("@/lib/mobile/auth", async original => ({ ...(await original<object>()), mobileAuth: mocks.auth }));
vi.mock("@/lib/qonto/sync", () => ({ fetchQontoTransactionsForImport: mocks.fetch }));
vi.mock("@/lib/import-transactions", () => ({ importTransactionsWithClient: mocks.ingest }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseRuntimeMode: mocks.mode }));
vi.mock("@/lib/mobile/powens-sync", () => ({ syncMobilePowens: mocks.powens }));
import { POST } from "@/app/api/mobile/v1/transactions/sync/route";
import { MobileError } from "@/lib/mobile/auth";
const client = { authenticated: true };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ client, userId: "owner" });
  mocks.mode.mockReturnValue("SUPABASE");
  mocks.powens.mockResolvedValue({ inserted: 3, merged: 4 });
  mocks.fetch.mockResolvedValue({ rows: [{ label: "Qonto" }] });
  mocks.ingest.mockResolvedValue({ inserted: [{ id: "new" }], merged: 2 });
});
it("authenticates before contacting Qonto", async () => {
  mocks.auth.mockRejectedValue(new MobileError(401, "Connexion requise"));
  expect((await POST(new Request("https://test", { method: "POST" }))).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.ingest).not.toHaveBeenCalled();
});
it("imports Qonto rows through the authenticated shared web importer", async () => {
  const response = await POST(new Request("https://test", { method: "POST" }));
  expect(await response.json()).toEqual({ inserted: 1, merged: 2 });
  expect(mocks.ingest).toHaveBeenCalledWith(client, [{ label: "Qonto" }], expect.objectContaining({ format: "qonto", fileHash: null }));
});
it("blocks writes in demo mode", async () => {
  mocks.mode.mockReturnValue("DEMO");
  expect((await POST(new Request("https://test"))).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("does not import or report success when Qonto fails", async () => {
  mocks.fetch.mockRejectedValue(new Error("private Qonto error"));
  const response = await POST(new Request("https://test"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
  expect(mocks.ingest).not.toHaveBeenCalled();
});

it("syncs personal operations with the authenticated owner through Powens only", async () => {
  const response = await POST(new Request("https://test?scope=personal", { method: "POST" }));
  expect(await response.json()).toEqual({ inserted: 3, merged: 4 });
  expect(mocks.powens).toHaveBeenCalledWith(client, "owner");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("syncs both banks for all operations and rejects invalid scope", async () => {
  const response = await POST(new Request("https://test?scope=all", { method: "POST" }));
  expect(await response.json()).toEqual({ inserted: 4, merged: 6 });
  expect(mocks.powens).toHaveBeenCalledTimes(1);
  expect((await POST(new Request("https://test?scope=invalid", { method: "POST" }))).status).toBe(400);
});
it("does not report success if Powens fails", async () => {
  mocks.powens.mockRejectedValue(new MobileError(409, "Reconnectez Powens"));
  expect((await POST(new Request("https://test?scope=personal", { method: "POST" }))).status).toBe(409);
});
