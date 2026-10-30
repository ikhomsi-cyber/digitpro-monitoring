import { gzipSync } from "node:zlib";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
import { GET } from "@/app/api/dashboard/pilote/route";
import { piloteSnapshotMonths } from "@/lib/pilote";
const report = { version: 2, months: [], sourceFilename: "synthetic.xlsx", fileHash: "fixture", sourceRows: 0, excludedInternal: 0, excludedHidden: 0, importedAt: "2026-10-24T00:00:00Z" };
beforeEach(() => {
 vi.resetAllMocks();
 mocks.getUser.mockResolvedValue({data: {user: {id: "synthetic-owner"}}, error: null});
 mocks.from.mockReturnValue({select: () => ({eq: mocks.eq})});
 mocks.eq.mockReturnValue({maybeSingle: mocks.maybeSingle});
 mocks.maybeSingle.mockResolvedValue({data: null, error: null});
});
it.each([false, true])("returns renderable aggregates for compressed=%s without exposing source rows", async compressed => {
 const stored = {...report, rows: [], legacyBackup: {private: "fixture"}, excludedRowIdentities: ["synthetic-hidden-id"]};
 const snapshot = compressed ? {storageVersion: 1, payloadCompressed: gzipSync(JSON.stringify(stored)).toString("base64")} : stored;
 mocks.maybeSingle.mockResolvedValue({data: {snapshot}, error: null});
 const response = await GET();
 expect(response.status).toBe(200);
 const body = await response.json();
 expect(body.snapshot).toEqual(report);
 expect(piloteSnapshotMonths(body.snapshot)).toEqual([]);
 expect(response.headers.get("cache-control")).toContain("no-store");
 expect(mocks.eq).toHaveBeenCalledWith("user_id", "synthetic-owner");
});
it("returns an empty report when nothing has been imported", async () => {
 expect(await (await GET()).json()).toMatchObject({snapshot: null});
});
it("rejects corrupt compressed data without returning its contents", async () => {
 mocks.maybeSingle.mockResolvedValue({data: {snapshot: {storageVersion: 1, payloadCompressed: "private-invalid-data"}}, error: null});
 const response = await GET();expect(response.status).toBe(503);expect(await response.text()).not.toContain("private-invalid-data");
});
it("does not query reports for unauthenticated callers", async () => {
 mocks.getUser.mockResolvedValue({data: {user: null}, error: null});
 expect((await GET()).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();
});
it("handles database failure without leaking diagnostics", async () => {
 mocks.maybeSingle.mockResolvedValue({data: null, error: {message: "private-diagnostic"}});
 const response = await GET();expect(response.status).toBe(503);expect(await response.text()).not.toContain("private-diagnostic");
});
