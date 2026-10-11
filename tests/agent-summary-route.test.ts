import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), from: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { GET } from "@/app/api/agents/v1/summary/route";
const token = "dp_agent_" + "a".repeat(43);
const request = (credential = token, query = "from=2026-10-01&to=2026-10-11") =>
  new Request(`https://digitpro.test/api/agents/v1/summary?${query}`, { headers: { authorization: `Bearer ${credential}` } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AGENT_ACCESS_ENABLED", "true");
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "agent_authorize" ? { id: "grant", user_id: "owner" } : true, error: null }));
  const chain = { select: vi.fn(), eq: mocks.eq, gte: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn() };
  for (const fn of [chain.select, chain.eq, chain.gte, chain.lte, chain.order]) fn.mockReturnValue(chain);
  chain.range.mockResolvedValue({ data: [{ id: "a", amount: 100 }, { id: "b", amount: -40 }], count: 2, error: null });
  mocks.from.mockReturnValue(chain); mocks.admin.mockReturnValue({ rpc: mocks.rpc, from: mocks.from });
});
afterEach(() => vi.unstubAllEnvs());
it("is disabled by default and never accepts a human Supabase JWT", async () => {
  vi.stubEnv("AGENT_ACCESS_ENABLED", "false");
  expect((await GET(request())).status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
  vi.stubEnv("AGENT_ACCESS_ENABLED", "true");
  expect((await GET(request("eyJ.human.jwt"))).status).toBe(401);
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("returns only aggregates with explicit tenant and professional filters", async () => {
  const result = await GET(request());
  expect(await result.json()).toEqual({ from: "2026-10-01", to: "2026-10-11", scope: "pro", currency: "EUR",
    transactionCount: 2, cashCredits: 100, cashDebits: 40, cashNet: 60 });
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(mocks.eq).toHaveBeenCalledWith("scope", "pro");
  expect(mocks.rpc).toHaveBeenCalledWith("agent_authorize", expect.objectContaining({ p_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  expect(result.headers.get("cache-control")).toContain("no-store");
});
it("denies invalid, excessive and user-selected scopes before database access", async () => {
  for (const query of ["from=2026-02-30&to=2026-03-10", "from=2025-01-01&to=2026-10-01", "from=2026-10-01&to=2026-10-11&user_id=other"]) {
    expect((await GET(request(token, query))).status).toBe(400);
  }
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("does not read data after authorization failure or release data after revocation", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
  expect((await GET(request())).status).toBe(403);
  expect(mocks.from).not.toHaveBeenCalled();
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "agent_authorize" ? { id: "grant", user_id: "owner" } : false, error: null }));
  const result = await GET(request());
  expect(result.status).toBe(403);
  expect(await result.text()).not.toContain("cashCredits");
});
