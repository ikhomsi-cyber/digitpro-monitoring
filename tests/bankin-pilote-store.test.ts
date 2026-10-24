import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { saveBankinPiloteSnapshot } from "@/lib/bankin/pilote-store";
import { buildBankinPiloteSnapshot, type BankinPiloteSnapshot } from "@/lib/pilote";
const snapshot = (identity: string) => buildBankinPiloteSnapshot([{ identity, sourceRow: 2, date: "2026-10-01", amount: -10, parentCategory: "Logement", subCategory: "Charges", hidden: false }], "synthetic.xlsx", identity);
function clientFixture(reads: unknown[], writes: unknown[] = []) {
  const maybeSingle = vi.fn();
  reads.forEach(result => maybeSingle.mockResolvedValueOnce(result));
  const saved = vi.fn();
  writes.forEach(result => saved.mockResolvedValueOnce(result));
  const filters = vi.fn().mockReturnThis();
  const update = vi.fn(() => ({ eq: filters, select: () => ({ maybeSingle: saved }) }));
  filters.mockImplementation(() => ({ eq: filters, select: () => ({ maybeSingle: saved }) }));
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }), update, insert }));
  return { client: { from } as unknown as Parameters<typeof saveBankinPiloteSnapshot>[0], update, insert, filters };
}
const stored = (value: BankinPiloteSnapshot, updated_at = "2026-10-01T00:00:00.000Z") => ({ data: { snapshot: value, updated_at }, error: null });
it("reads before merging and retries a concurrent change without losing either import", async () => {
  const first = snapshot("old"), concurrent = buildBankinPiloteSnapshot([...first.rows!, { ...snapshot("concurrent").rows![0], sourceRow: 3 }], "synthetic.xlsx", "concurrent");
  const fixture = clientFixture([stored(first), stored(concurrent, "2026-10-02T00:00:00.000Z")], [{ data: null, error: null }, { data: { user_id: "owner" }, error: null }]);
  const result = await saveBankinPiloteSnapshot(fixture.client, "owner", snapshot("incoming"));
  expect(result.rows?.map(r => r.identity)).toEqual(["old", "concurrent", "incoming"]);
  expect(fixture.update).toHaveBeenCalledTimes(2);
  expect(fixture.filters).toHaveBeenCalledWith("user_id", "owner");
  expect(fixture.filters).toHaveBeenCalledWith("updated_at", "2026-10-02T00:00:00.000Z");
});
it("stops on read refusal without writing or trying another identity", async () => {
  const fixture = clientFixture([{ data: null, error: { code: "42501" } }]);
  await expect(saveBankinPiloteSnapshot(fixture.client, "owner", snapshot("new"))).rejects.toThrow(/autorisation/);
  expect(fixture.update).not.toHaveBeenCalled(); expect(fixture.insert).not.toHaveBeenCalled();
});
it("inserts the first history and does not rewrite an already known export", async () => {
  const incoming = snapshot("new");
  const empty = clientFixture([{ data: null, error: null }]);
  await saveBankinPiloteSnapshot(empty.client, "owner", incoming);
  expect(empty.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", snapshot: expect.objectContaining({ payloadCompressed: expect.any(String) }) }));
  const existing = clientFixture([stored(incoming)]);
  await saveBankinPiloteSnapshot(existing.client, "owner", incoming);
  expect(existing.update).not.toHaveBeenCalled();
});
it("initializes the next export and saves an archive of the previous legacy report", async () => {
  const old = { ...snapshot("old"), rows: undefined };
  const fixture = clientFixture([stored(old)], [{ data: { user_id: "owner" }, error: null }]);
  const incoming = buildBankinPiloteSnapshot([{ ...snapshot("new").rows![0], amount: -25 }], "new.xlsx", "new");
  const result = await saveBankinPiloteSnapshot(fixture.client, "owner", incoming);
  expect(result.months[0].expenses).toBe(25);
  expect(result.legacyBackup).toBe(old);
  expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({ snapshot: expect.objectContaining({ payloadCompressed: expect.any(String) }) }));
});
