import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildBankinPiloteSnapshot } from "@/lib/pilote";
import { encodePiloteStorage, decodePiloteStorage } from "@/lib/bankin/pilote-storage";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
it("roundtrips a full export exceeding the database JSON limit using compact storage", async () => {
  const rows = Array.from({ length: 12_000 }, (_, i) => ({ sourceRow: i + 2, identity: createHash("sha256").update(`synthetic-${i}`).digest("hex"), date: "2026-10-01", amount: -1, parentCategory: "Logement synthétique", subCategory: "Charges synthétiques", hidden: false }));
  const snapshot = buildBankinPiloteSnapshot(rows, "synthetic.xlsx", "fixture");
  expect(Buffer.byteLength(JSON.stringify(snapshot))).toBeGreaterThan(2_000_000);
  const encoded = encodePiloteStorage(snapshot);
  expect(encoded.payloadCompressed).toEqual(expect.any(String));
  expect(Buffer.byteLength(JSON.stringify(encoded))).toBeLessThan(1_500_000);
  expect(decodePiloteStorage(encoded)).toEqual(snapshot);
  const db = new PGlite();
  try {
    await db.exec("create table snapshots(snapshot jsonb check (octet_length(snapshot::text) <= 2000000))");
    await expect(db.query("insert into snapshots values ($1::jsonb)", [JSON.stringify(snapshot)])).rejects.toThrow();
    await db.query("insert into snapshots values ($1::jsonb)", [JSON.stringify(encoded)]);
    expect((await db.query("select octet_length(snapshot::text) as bytes from snapshots")).rows[0]).toMatchObject({ bytes: expect.any(Number) });
  } finally { await db.close(); }
});
it("preserves legacy aggregates and rejects damaged compressed details", () => {
  const legacy = { ...buildBankinPiloteSnapshot([], "synthetic.xlsx", "fixture"), rows: undefined };
  expect(decodePiloteStorage(legacy)).toBe(legacy);
  expect(() => decodePiloteStorage({ ...legacy, rowsCompressed: "broken" })).toThrow("illisible");
});

it("compresses a large legacy archive and aggregates as well as transactions", () => {
  const base = buildBankinPiloteSnapshot([{ sourceRow: 2, date: "2026-10-01", amount: -1, parentCategory: "Synthetic", subCategory: "Charge", hidden: false }], "synthetic.xlsx", "fixture");
  const legacyBackup = { ...base, rows: undefined, months: [{ ...base.months[0], categories: Array.from({ length: 15_000 }, (_, i) => ({ name: `Synthetic archived category ${i} ${"category ".repeat(10)}`, expenses: 1, income: 0, count: 1, children: [] })) }] };
  const snapshot = { ...base, legacyBackup };
  expect(Buffer.byteLength(JSON.stringify(snapshot))).toBeGreaterThan(1_500_000);
  const encoded = encodePiloteStorage(snapshot);
  expect(Buffer.byteLength(JSON.stringify(encoded))).toBeLessThan(200_000);
  expect(decodePiloteStorage(encoded)).toEqual(snapshot);
});
