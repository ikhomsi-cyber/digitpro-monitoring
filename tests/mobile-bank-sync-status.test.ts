import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { recordBankSync, readBankSyncStatus } from "@/lib/mobile/bank-sync-status";
type Client = Parameters<typeof recordBankSync>[0];
it("records provider success under the verified owner even without new transactions", async () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  await recordBankSync({ from: () => ({ insert }) } as unknown as Client, "owner", "personal");
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", source_filename: "DigitPro bank sync completed:personal", format: "powens", row_count: 0 }));
});
it("reads separate latest successful dates under the owner", async () => {
  const eq = vi.fn();
  const builder = { select: () => builder, eq: (...args: unknown[]) => { eq(...args); return builder; }, order: () => builder, limit: () => builder,
    maybeSingle: vi.fn().mockResolvedValueOnce({ data: { created_at: "2026-09-28T12:00:00Z" }, error: null }).mockResolvedValueOnce({ data: null, error: null }) };
  expect(await readBankSyncStatus({ from: () => builder } as unknown as Client, "owner")).toEqual({ pro: "2026-09-28T12:00:00Z", personal: null });
  expect(eq).toHaveBeenCalledWith("user_id", "owner");
  expect(eq).toHaveBeenCalledWith("source_filename", "DigitPro bank sync completed:pro");
  expect(eq).toHaveBeenCalledWith("source_filename", "DigitPro bank sync completed:personal");
});
