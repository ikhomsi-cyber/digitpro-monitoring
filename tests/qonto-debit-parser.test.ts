import { describe, expect, it } from "vitest";
import {
  filterFutureQontoDebits,
  parseFrenchDebitDate,
  parseQontoUpcomingDebit
} from "@/lib/gmail/qonto-debit-parser";

describe("notifications de prélèvement Qonto", () => {
  it("parse une notification Qonto avec date française et montant", () => {
    const debit = parseQontoUpcomingDebit({
      id: "gmail-1",
      subject: "Qonto — ACME débitera votre compte le 15 septembre 2026",
      body: "Montant du prélèvement : 1 234,56 €",
      emailDateIso: "2026-09-01"
    });

    expect(debit).toMatchObject({
      organization: "ACME",
      amountEur: 1234.56,
      debitDateIso: "2026-09-15"
    });
  });

  it("ne conserve que les prélèvements strictement futurs, par date", () => {
    const rows = filterFutureQontoDebits(
      [
        { id: "today", subject: "", organization: "A", amountEur: 10, debitDateIso: "2026-09-10", emailDateIso: "2026-09-01" },
        { id: "late", subject: "", organization: "B", amountEur: 20, debitDateIso: "2026-09-20", emailDateIso: "2026-09-01" },
        { id: "soon", subject: "", organization: "C", amountEur: 30, debitDateIso: "2026-09-12", emailDateIso: "2026-09-01" }
      ],
      "2026-09-10"
    );

    expect(rows.map((row) => row.id)).toEqual(["soon", "late"]);
  });

  it("accepte les formats de date français courants", () => {
    expect(parseFrenchDebitDate("5/9/2026")).toBe("2026-09-05");
    expect(parseFrenchDebitDate("5 septembre 2026")).toBe("2026-09-05");
  });
});
