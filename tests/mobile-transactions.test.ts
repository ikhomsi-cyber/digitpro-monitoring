import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: {} as Record<string, ReturnType<typeof vi.fn>> }));
vi.mock("@/lib/mobile/auth", async (original) => ({ ...(await original<object>()), mobileAuth: mocks.auth }));
import { GET } from "@/app/api/mobile/v1/transactions/route";
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ["select", "eq", "order", "ilike", "range"]) mocks.query[key] = vi.fn().mockReturnValue(mocks.query);
  mocks.query.range.mockResolvedValue({ data: [{ id: "own-row" }], count: 201, error: null });
  mocks.auth.mockResolvedValue({ userId: "owner", client: { from: () => mocks.query } });
});
it("scopes reads to the verified owner with stable pagination", async () => {
  const response = await GET(new Request("https://test/api?page=1&scope=personal&search=50%25"));
  expect(response.status).toBe(200);
  expect(mocks.query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(mocks.query.eq).toHaveBeenCalledWith("scope", "personal");
  expect(mocks.query.range).toHaveBeenCalledWith(100,199);
  expect(mocks.query.order).toHaveBeenCalledWith("id", { ascending: false });
  expect(mocks.query.ilike).toHaveBeenCalledWith("label", "%50\\%%");
  expect(await response.json()).toMatchObject({ total: 201, nextPage: 2 });
});
it("rejects invalid pages and filters before database reads", async () => {
  for (const query of ["page=-1", "page=foo", "scope=someone-else", "page=1.2"]) {
    expect((await GET(new Request(`https://test/api?${query}`))).status).toBe(400);
  }
  expect(mocks.query.range).not.toHaveBeenCalled();
});
it("returns no financial rows on database failure", async () => {
  mocks.query.range.mockResolvedValue({ data: null, count: null, error: new Error("private") });
  const response = await GET(new Request("https://test/api"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
});
