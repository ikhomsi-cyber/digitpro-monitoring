import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadUserExpensePeriodFromSupabase } from "@/lib/supabase/fetch-all-transactions";
import { mobileExpenseDateRange, mobileExpenseDetail } from "@/lib/mobile/expenses";

const bounds = { since: "2026-09-01", until: "2026-10-01" };
function database(count: number | null, missing = false) {
  const calls: unknown[][] = [];
  const client = { from: vi.fn(() => {
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["select", "eq", "or", "lt", "gte", "order"]) {
      query[method] = (...args) => { calls.push([method, ...args]); return query; };
    }
    query.range = async (from, to) => ({ count, error: null,
      data: Array.from({ length: Math.max(0, Math.min(Number(to) + 1, (count ?? 0) - (missing ? 1 : 0)) - Number(from)) }, (_, index) => ({
        id: String(Number(from) + index), date: "2026-09-10", label: "Hiway", category: "Matériel",
        category_manual: true, amount: -120, company: "Qonto", scope: null
      })) });
    return query;
  }) };
  return { client: client as unknown as Parameters<typeof loadUserExpensePeriodFromSupabase>[0], calls };
}
it("restricts SQL to the owner, professional debits and requested dates while preserving manual categories", async () => {
  const { client, calls } = database(1);
  const result = await loadUserExpensePeriodFromSupabase(client, "owner", bounds);
  for (const filter of [["eq", "user_id", "owner"], ["or", "scope.eq.pro,scope.is.null"], ["lt", "amount", 0],
    ["gte", "date", bounds.since], ["lt", "date", bounds.until]]) expect(calls).toContainEqual(filter);
  expect(result.errorMessage).toBeNull();
  expect(mobileExpenseDetail(result.transactions, "Matériel", "2026-09", 0, new Date(2026, 8, 22)))
    .toMatchObject({ total: 1, totalTtc: 120, recoverableVat: 20 });
});
it("loads all matching rows beyond the Supabase page limit", async () => {
  const { client } = database(1001);
  const result = await loadUserExpensePeriodFromSupabase(client, "owner", bounds);
  expect(result.errorMessage).toBeNull();
  expect(result.transactions).toHaveLength(1001);
});
it("rejects incomplete or uncounted results", async () => {
  for (const setup of [database(1001, true), database(null), database(125001)]) {
    expect((await loadUserExpensePeriodFromSupabase(setup.client, "owner", bounds)).errorMessage).not.toBeNull();
  }
});
it("uses exact calendar boundaries for month, year and rolling twelve months", () => {
  expect(mobileExpenseDateRange("2025")).toEqual({ since: "2025-01-01", until: "2026-01-01" });
  expect(mobileExpenseDateRange("2026-12")).toEqual({ since: "2026-12-01", until: "2027-01-01" });
  expect(mobileExpenseDateRange("all", new Date(2026, 0, 15))).toEqual({ since: "2025-02-01", until: "2026-02-01" });
});
