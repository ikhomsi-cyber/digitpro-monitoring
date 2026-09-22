import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), upsert: vi.fn(), delete: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/mobile/auth", async original => ({ ...(await original<object>()), mobileAuth: mocks.auth }));
import { PUT } from "@/app/api/mobile/v1/activity/route";

beforeEach(() => {
  vi.clearAllMocks();
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.upsert = mocks.upsert.mockResolvedValue({ error: null });
  chain.delete = mocks.delete.mockReturnValue(chain);
  chain.eq = mocks.eq.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
  mocks.auth.mockResolvedValue({ userId: "owner", client: { from: mocks.from } });
});

it("writes a calendar day only for the verified owner", async () => {
  const response = await PUT(new Request("https://test/api", { method: "PUT", body: JSON.stringify({
    kind: "work", date: "2026-09-21", selected: true
  }) }));
  expect(response.status).toBe(200);
  expect(mocks.from).toHaveBeenCalledWith("billable_work_days");
  expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "owner", work_date: "2026-09-21" }, { onConflict: "user_id,work_date" });
});

it("rejects malformed mutations before touching activity tables", async () => {
  for (const body of [
    { kind: "work", date: "not-a-date", selected: true },
    { kind: "work", date: "2026-02-31", selected: true },
    { kind: "mileage", month: "2026-13", value: 1 },
    { kind: "target", value: -1 }
  ]) {
    const response = await PUT(new Request("https://test/api", { method: "PUT", body: JSON.stringify(body) }));
    expect(response.status).toBe(400);
  }
  expect(mocks.from).not.toHaveBeenCalled();
});
