import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), transactions: vi.fn(), invoices: vi.fn(), overview: vi.fn(), calendar: vi.fn() }));
vi.mock("@/lib/mobile/auth", async original => ({ ...(await original<object>()), mobileAuth: mocks.auth }));
vi.mock("@/lib/supabase/fetch-all-transactions", () => ({ loadAllUserTransactionsFromSupabase: mocks.transactions }));
vi.mock("@/lib/gmail/hiway-invoice-store", () => ({ loadStoredHiwayInvoices: mocks.invoices }));
vi.mock("@/lib/mobile/overview", () => ({ buildMobileOverview: mocks.overview }));
import { GET } from "@/app/api/mobile/v1/overview/route";

beforeEach(() => {
  vi.resetAllMocks();
  const client = { from(table: string) {
    const value = table === "transactions" ? { count: 0, error: null }
      : table === "billable_rate_periods" ? { data: [], count: 0, error: null }
      : { data: { tjm_ht: 820 }, error: null };
    const chain = {
      select: () => chain, eq: vi.fn(() => chain), order: () => chain,
      range: mocks.calendar, maybeSingle: () => Promise.resolve(value),
      then: (resolve: (result: typeof value) => unknown) => Promise.resolve(value).then(resolve)
    };
    return chain;
  } };
  mocks.auth.mockResolvedValue({ client, userId: "owner" });
  mocks.transactions.mockResolvedValue({ transactions: [], errorMessage: null });
  mocks.invoices.mockResolvedValue([]);
  mocks.calendar.mockResolvedValue({ data: [{ work_date: "2026-10-01" }], count: 1, error: null });
  mocks.overview.mockReturnValue({ version: 1 });
});

it("starts the calendar without waiting for transaction history", async () => {
  let finish!: (value: { transactions: never[]; errorMessage: null }) => void;
  mocks.transactions.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const pending = GET(new Request("https://test/api/mobile/v1/overview"));
  try {
    await vi.waitFor(() => expect(mocks.calendar).toHaveBeenCalledWith(0, 999));
    expect(mocks.overview).not.toHaveBeenCalled();
  } finally { finish({ transactions: [], errorMessage: null }); }
  expect((await pending).status).toBe(200);
  expect(mocks.overview).toHaveBeenCalledWith([], expect.objectContaining({ days: ["2026-10-01"] }));
});

it("still rejects an incomplete calendar before computing financial indicators", async () => {
  mocks.calendar.mockResolvedValue({ data: [], count: 1, error: null });
  const response = await GET(new Request("https://test/api/mobile/v1/overview"));
  expect(response.status).toBe(503);
  expect(mocks.overview).not.toHaveBeenCalled();
});

it("does not query financial data when authentication fails", async () => {
  mocks.auth.mockRejectedValue(new Error("Invalid session"));
  expect((await GET(new Request("https://test/api/mobile/v1/overview"))).status).toBe(503);
  expect(mocks.transactions).not.toHaveBeenCalled();
  expect(mocks.calendar).not.toHaveBeenCalled();
});
