import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { readIntegrationSecret, writeIntegrationSecret } from "@/lib/security/integration-secrets";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
const client = { auth: { getUser: mocks.getUser } } as unknown as SupabaseClient<Database>;
beforeEach(() => {
  vi.resetAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: null, error: null });
});
it("rejects a forged tenant before creating a privileged client", async () => {
  await expect(readIntegrationSecret(client, "other", "gmail")).rejects.toThrow("Connexion");
  await expect(writeIntegrationSecret(client, "other", "powens", { auth_token: "secret" })).rejects.toThrow("Connexion");
  expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("never falls back to the public token tables when the private store is unavailable", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "private internal details" } });
  await expect(readIntegrationSecret(client, "owner", "gmail")).rejects.toThrow("migration");
  expect(mocks.rpc).toHaveBeenCalledWith("integration_secret_read", { p_user_id: "owner", p_integration: "gmail" });
});
