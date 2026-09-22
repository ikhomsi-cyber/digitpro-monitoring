import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), select: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/mobile/auth", async original => ({ ...(await original<object>()), mobileAuth: mocks.auth }));
vi.mock("@/lib/supabase/fetch-all-transactions", () => ({ loadUserExpensePeriodFromSupabase: mocks.load }));
import { GET } from "@/app/api/mobile/v1/expenses/route";
import { MobileError } from "@/lib/mobile/auth";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ count: 0, error: null });
  mocks.load.mockResolvedValue({ transactions: [], errorMessage: null });
  mocks.auth.mockResolvedValue({ userId: "owner", client: { from: () => ({ select: mocks.select }) } });
});
it("verifies the owner and returns private category details", async () => {
  const response = await GET(new Request("https://test/api?category=Qonto&month=all"));
  expect(response.status).toBe(200);
  expect(mocks.load).toHaveBeenCalledWith(expect.anything(), "owner", expect.objectContaining({ since: expect.any(String), until: expect.any(String) }));
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toMatchObject({ category: "Qonto", month: "all", total: 0, transactions: [], nextPage: null });
});
it("rejects unsupported categories, months and pages before loading transactions", async () => {
  for (const query of ["category=BNC&month=all", "category=TVA&month=all", "category=unknown&month=all", "category=Qonto&month=2026-13", "category=Qonto&month=all&page=-1", "category=Qonto&month=all&page=1.5"]) {
    expect((await GET(new Request(`https://test/api?${query}`))).status).toBe(400);
  }
  expect(mocks.load).not.toHaveBeenCalled();
});
it("does not return incomplete financial data", async () => {
  mocks.load.mockResolvedValue({ transactions: [], errorMessage: "incomplete" });
  expect((await GET(new Request("https://test/api?category=Qonto&month=all"))).status).toBe(503);
});
it("requires authentication before reading financial data", async () => {
  mocks.auth.mockRejectedValue(new MobileError(401, "Session expirée."));
  expect((await GET(new Request("https://test/api?category=Qonto&month=all"))).status).toBe(401);
  expect(mocks.load).not.toHaveBeenCalled();
});

it("accepts a calendar year for category detail", async () => {
  const response = await GET(new Request("https://test/api?category=Qonto&month=2025"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ month: "2025", total: 0 });
});
