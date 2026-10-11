import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/mobile/auth", async original => ({ ...(await original<object>()), mobileAuth: mocks.auth }));
vi.mock("@/lib/supabase/fetch-all-transactions", () => ({ loadAllUserTransactionsFromSupabase: mocks.load }));
import { GET, PUT } from "@/app/api/mobile/v1/ndf/route";
import { MobileError } from "@/lib/mobile/auth";
const id = "223e7397-70c5-484f-ab08-7d201b34aeed";
const tx = { id, date: "2026-10-03", label: "[En cours] CB THE RANCH CLAMART 03/10/26", amount: -79.4,
  category: "Alimentation & Restau › Fast foods", categoryManual: false, scope: "personal", company: "Powens perso" };
let chain: Record<string, unknown>;
const request = (action: string, transactionId = id) => new Request("https://test/api", {
  method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, transactionId })
});
beforeEach(() => {
  vi.clearAllMocks();
  chain = { eq: mocks.eq, select: mocks.select };
  mocks.eq.mockReturnValue(chain);
  mocks.select.mockImplementation((_columns: string, options?: unknown) => options ? { eq: vi.fn().mockResolvedValue({ count: 1, error: null }) } : Promise.resolve({ data: [{ id }], error: null }));
  mocks.update.mockReturnValue(chain);
  mocks.auth.mockResolvedValue({ userId: "owner", client: { from: () => ({ select: mocks.select, update: mocks.update }) } });
  mocks.load.mockResolvedValue({ transactions: [tx], errorMessage: null });
});
it("returns personal pending expenses with the web detection rules and private caching", async () => {
  const response = await GET(new Request("https://test/api?month=2026-10"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toMatchObject({ month: "2026-10", pending: [tx], validated: { totalEur: 0 } });
});
it("validates with the manual NDF tag and ownership filters", async () => {
  expect((await PUT(request("validate"))).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ category: "NDF DigitPro", category_manual: true });
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(mocks.eq).toHaveBeenCalledWith("scope", "personal");
  expect(mocks.eq).toHaveBeenCalledWith("category_manual", false);
});
it("rejects with the same category as the web", async () => {
  expect((await PUT(request("reject"))).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ category: "Repas dirigeant", category_manual: true });
});
it("does not write another user's transaction, professional transactions or already validated notes", async () => {
  expect((await PUT(request("validate", "00000000-0000-4000-8000-000000000000"))).status).toBe(404);
  mocks.load.mockResolvedValue({ transactions: [{ ...tx, scope: "pro" }], errorMessage: null });
  expect((await PUT(request("validate"))).status).toBe(404);
  mocks.load.mockResolvedValue({ transactions: [{ ...tx, category: "NDF DigitPro", categoryManual: true }], errorMessage: null });
  expect((await PUT(request("validate"))).status).toBe(409);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("excludes duplicates of validated NDF and refuses writing them", async () => {
  mocks.load.mockResolvedValue({ transactions: [tx, { ...tx, id: "validated", category: "NDF DigitPro", categoryManual: true }], errorMessage: null });
  mocks.select.mockImplementation((_columns: string, options?: unknown) => options ? { eq: vi.fn().mockResolvedValue({ count: 2, error: null }) } : Promise.resolve({ data: [{ id }], error: null }));
  expect((await PUT(request("validate"))).status).toBe(409);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("requires authentication and rejects invalid decisions and incomplete reads", async () => {
  expect((await PUT(request("unknown"))).status).toBe(400);
  expect((await GET(new Request("https://test/api?month=2026-13"))).status).toBe(400);
  mocks.load.mockResolvedValue({ transactions: [], errorMessage: "incomplete" });
  expect((await PUT(request("validate"))).status).toBe(503);
  mocks.auth.mockRejectedValue(new MobileError(401, "Connexion requise."));
  expect((await PUT(request("validate"))).status).toBe(401);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("reports a concurrent decision instead of falsely reporting success", async () => {
  mocks.select.mockImplementation((_columns: string, options?: unknown) => options ? { eq: vi.fn().mockResolvedValue({ count: 1, error: null }) } : Promise.resolve({ data: [], error: null }));
  expect((await PUT(request("validate"))).status).toBe(409);
});
it("reports a failed save without claiming the note was validated", async () => {
  mocks.select.mockImplementation((_columns: string, options?: unknown) => options ? { eq: vi.fn().mockResolvedValue({ count: 1, error: null }) } : Promise.resolve({ data: null, error: { message: "failed" } }));
  expect((await PUT(request("validate"))).status).toBe(503);
});
