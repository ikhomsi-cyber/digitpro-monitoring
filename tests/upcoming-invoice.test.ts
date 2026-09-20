import { describe, expect, it } from "vitest";
import { computeCurrentMonthInvoice, computeUpcomingInvoice } from "@/lib/upcoming-invoice";

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

describe("upcoming invoice matches Activity billed days", () => {
  const opts = {
    selectedWorkDayIsos: new Set(["2026-08-03", "2026-08-04"]),
    billableRatePeriods: [
      { clientName: "Skylab", startDate: "2026-08-01", endDate: "2026-08-31", tjmHt: 800 },
      { clientName: "Skylab", startDate: "2026-09-01", endDate: null, tjmHt: 940 }
    ],
    fallbackTjmHt: 820,
    now: new Date(2026, 8, 20, 12)
  };

  it("uses the service month's rate when no invoice is available", () => {
    expect(computeUpcomingInvoice(opts)).toMatchObject({ amountHtEur: 1600, amountTtcEur: 1920 });
  });

  it("uses issued invoice totals instead of agenda days or current rates", () => {
    const invoice = {
      id: "invoice-aug", date: "2026-08-31", amountEur: 15000, amountKind: "HT" as const,
      client: "Skylab", billedDays: 20, tjmHtEur: 750, subject: "Facture août"
    };
    expect(computeUpcomingInvoice({ ...opts, hiwayInvoices: [invoice] }))
      .toMatchObject({ amountHtEur: 15000, amountTtcEur: 18000 });
    expect(computeUpcomingInvoice({ ...opts, hiwayInvoices: [invoice, { ...invoice, id: "extra", amountEur: 1200, amountKind: "TTC" }] }))
      .toMatchObject({ amountHtEur: 16000, amountTtcEur: 19200 });
  });

  it("selects December's invoice across a year boundary", () => {
    expect(computeUpcomingInvoice({ ...opts, now: new Date(2027, 0, 15), hiwayInvoices: [{
      id: "dec", date: "2026-12-31", amountEur: 10000, amountKind: "HT",
      client: "Skylab", billedDays: null, tjmHtEur: null, subject: "Décembre"
    }] })).toMatchObject({ amountHtEur: 10000, amountTtcEur: 12000 });
  });
});
