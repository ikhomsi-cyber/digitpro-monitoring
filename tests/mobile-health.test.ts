import { expect, it, vi } from "vitest";
const { env } = vi.hoisted(() => ({ env: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseEnv: env }));
import { GET } from "@/app/api/mobile/v1/health/route";
it("confirms the mobile contract without exposing secrets", async () => {
  env.mockReturnValue({ url: "private-url", anonKey: "key" });
  const result = GET();
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(await result.json()).toEqual({ service: "digitpro-mobile", version: 1, ready: true });
});
it("does not advertise readiness without Supabase configuration", () => {
  env.mockReturnValue(null);
  expect(GET().status).toBe(503);
});
