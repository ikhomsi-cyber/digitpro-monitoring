import { describe, expect, it } from "vitest";
import {
  additionalCsgFromInvoiceCaHt,
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
