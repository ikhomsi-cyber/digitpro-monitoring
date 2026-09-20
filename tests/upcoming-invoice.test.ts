import { describe, expect, it } from "vitest";
import { computeCurrentMonthInvoice } from "@/lib/upcoming-invoice";

describe("invoice dashboard snapshots", () => {
  const rates = [
    { clientName: "Skylab", startDate: "2026-08-01", endDate: "2026-08-31", tjmHt: 800 },
    { clientName: "Skylab", startDate: "2026-09-01", endDate: null, tjmHt: 900 }
  ];
  const selected = new Set([
    "2026-08-03",
    "2026-08-04",
    "2026-09-01",
    "2026-09-02",
    "2026-09-28"
  ]);

  it("includes every selected day of the current month in the amount to invoice", () => {
    const snapshot = computeCurrentMonthInvoice({
      selectedWorkDayIsos: selected,
      billableRatePeriods: rates,
      fallbackTjmHt: 820,
      now: new Date(2026, 8, 20, 12)
    });

    expect(snapshot.billableDays).toBe(3);
    expect(snapshot.amountHtEur).toBe(2_700);
    expect(snapshot.amountTtcEur).toBe(3_240);
  });
});
