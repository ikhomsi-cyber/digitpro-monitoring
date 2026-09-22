import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn(), env: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseEnv: mocks.env }));
import { mobileAuth, mobileFailure, mobileJSON } from "@/lib/mobile/auth";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.mockReturnValue({ url: "https://test.supabase.co", anonKey: "public-key" });
  mocks.create.mockReturnValue({ auth: { getUser: mocks.getUser } });
});
describe("mobile bearer authentication", () => {
  it("rejects cookies and malformed or absent bearer tokens", async () => {
    for (const token of ["", "Basic a", "Bearer a b", "Bearer "]) {
      await expect(mobileAuth(new Request("https://test/api", { headers: { authorization: token, cookie: "session=web" } })))
        .rejects.toMatchObject({ status: 401 });
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("validates identity server-side and carries the same JWT into RLS queries", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    const result = await mobileAuth(new Request("https://test/api", { headers: { authorization: "Bearer user-jwt" } }));
    expect(result.userId).toBe("owner");
    expect(mocks.getUser).toHaveBeenCalledWith("user-jwt");
    expect(mocks.create).toHaveBeenCalledWith("https://test.supabase.co", "public-key", expect.objectContaining({
      global: { headers: { Authorization: "Bearer user-jwt" } }
    }));
    expect(mocks.create.mock.calls[0][2].cookies.getAll()).toEqual([]);
  });
  it("rejects expired credentials and fails closed without configuration", async () => {
    const request = new Request("https://test/api", { headers: { authorization: "Bearer invalid" } });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("private detail") });
    await expect(mobileAuth(request)).rejects.toMatchObject({ status: 401 });
    mocks.env.mockReturnValue(null);
    await expect(mobileAuth(request)).rejects.toMatchObject({ status: 503 });
  });
  it("never caches financial payloads or leaks internal failures", async () => {
    expect(mobileJSON({}).headers.get("cache-control")).toBe("private, no-store");
    const result = mobileFailure(new Error("database secret"));
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("database secret");
  });
});
