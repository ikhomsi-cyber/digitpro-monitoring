import { describe, expect, it } from "vitest";
import {
  additionalCsgFromInvoiceCaHt,
  nextHiwayPaymentDelayDays,
  sumOutstandingHiwayInvoiceHt
} from "@/lib/hiway-invoice-aggregate";

const invoice = {
  id: "invoice-1",
  subject: "DigitPro Consulting - Facture F2026-001",
  date: "2026-08-01",
  client: "Client",
  billedDays: 0,
  tjmHtEur: null,
  amountEur: 12_000,
  amountKind: "TTC" as const
};

describe("factures Hiway non encaissées", () => {
  it("ne provisionne pas une facture déjà couverte par un encaissement postérieur", () => {
    const outstanding = sumOutstandingHiwayInvoiceHt(
      [invoice],
      [
        {
          id: "receipt-1",
          date: "2026-08-15",
          label: "Virement client",
          category: "Chiffre d’affaires",
          amount: 12_000,
          company: "Qonto",
          scope: "pro"
        }
      ],
      new Date(2026, 7, 20)
    );

    expect(outstanding).toBe(0);
  });

  it("provisionne seulement le HT et la CSG d'une facture sans encaissement", () => {
    const outstanding = sumOutstandingHiwayInvoiceHt([invoice], [], new Date(2026, 7, 20));

    expect(outstanding).toBe(10_000);
    expect(additionalCsgFromInvoiceCaHt(outstanding)).toBe(970);
  });
});

describe("widget payment countdown", () => {
  it("uses 30 calendar days and exposes overdue dates", () => {
    expect(nextHiwayPaymentDelayDays([invoice], [], new Date(2026, 7, 20))).toBe(11);
    expect(nextHiwayPaymentDelayDays([invoice], [], new Date(2026, 7, 31))).toBe(0);
    expect(nextHiwayPaymentDelayDays([invoice], [], new Date(2026, 8, 2))).toBe(-2);
  });
  it("excludes paid invoices and keeps partially paid invoices", () => {
    const receipt = { id: "r", date: "2026-08-15", label: "Client", category: "Chiffre d’affaires", amount: 12000, company: "Qonto", scope: "pro" as const };
    expect(nextHiwayPaymentDelayDays([invoice], [receipt], new Date(2026, 7, 20))).toBeNull();
    expect(nextHiwayPaymentDelayDays([invoice], [{ ...receipt, amount: 6000 }], new Date(2026, 7, 20))).toBe(11);
    expect(sumOutstandingHiwayInvoiceHt([invoice], [{ ...receipt, amount: 6000 }], new Date(2026, 7, 20))).toBe(5000);
  });
  it("handles year boundaries without using working days", () => {
    expect(nextHiwayPaymentDelayDays([{ ...invoice, date: "2025-12-20" }], [], new Date(2026, 0, 10))).toBe(9);
  });
});
