import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ configured: vi.fn(), fetch: vi.fn(), ingest: vi.fn(), reference: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/powens/cloud-api", () => ({ isPowensCloudConfigured: mocks.configured, powensCloudFetchTransactions: mocks.fetch }));
vi.mock("@/lib/import-transactions", () => ({ importTransactionsWithClient: mocks.ingest }));
vi.mock("@/lib/powens/import-reference", () => ({ mapPowensRowsToImportTx: (rows: unknown) => rows, loadBankinReferenceData: mocks.reference, applyBankinReferenceToPowensRows: mocks.apply }));
import { syncMobilePowens } from "@/lib/mobile/powens-sync";
beforeEach(() => {
  vi.resetAllMocks(); mocks.configured.mockReturnValue(true);
  mocks.fetch.mockResolvedValue([{ scope: "personal", label: "Achat" }]);
  mocks.reference.mockResolvedValue({ reference: true });
  mocks.apply.mockImplementation(rows => rows);
  mocks.ingest.mockResolvedValue({ inserted: [1], merged: 2 });
});
function database(token: string | null) {
  const eq = vi.fn().mockReturnValue({ maybeSingle: async () => ({ data: { auth_token: token, powens_user_id: "123" }, error: null }) });
  const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) };
  return { client: client as unknown as Parameters<typeof syncMobilePowens>[0], eq };
}
it("uses the verified user's Powens connection and preserves personal classification", async () => {
  const { client, eq } = database("test-token");
  expect(await syncMobilePowens(client, "owner")).toEqual({ inserted: 1, merged: 2 });
  expect(eq).toHaveBeenCalledWith("user_id", "owner");
  expect(mocks.fetch).toHaveBeenCalledWith("test-token", expect.objectContaining({ scope: "personal", powensUserId: "123" }));
  expect(mocks.apply).toHaveBeenCalledWith(expect.any(Array), { reference: true }, "personal");
  expect(mocks.ingest).toHaveBeenCalledWith(client, expect.any(Array), expect.objectContaining({ format: "powens" }));
});
it("does not contact Powens or write anything without a saved connection", async () => {
  await expect(syncMobilePowens(database(null).client, "owner")).rejects.toThrow("Connectez");
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.ingest).not.toHaveBeenCalled();
});
