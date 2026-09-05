import { describe, expect, it } from "vitest";
import {
  bankinParentCategoryLabel,
  categorizeDigitProIncomingTransfer,
  categorizeKnownPersonalTransfer,
  categorizePowensApiTransaction
} from "@/lib/bankin/categorize";
import { isPowensAccountVisible, isPowensTransactionVisible } from "@/lib/powens/cloud-api";
import { countsTowardPersonalExpenseKpi } from "@/lib/dashboard-metrics";

describe("Bankin personal analytics", () => {
  it("groups an exact Bankin hierarchy by its parent category", () => {
    expect(bankinParentCategoryLabel("Voyage Bodrum Kos 26 › Hôtel - Bodrum Kos 15j")).toBe(
      "Voyage Bodrum Kos 26"
    );
    expect(bankinParentCategoryLabel("Alimentation & Restau. › Carrefour")).toBe(
      "Alimentation & Restau"
    );
  });

  it("rejects transactions hidden or deleted by Powens", () => {
    expect(isPowensTransactionVisible({ active: false, deleted: null })).toBe(false);
    expect(isPowensTransactionVisible({ active: "false", deleted: null })).toBe(false);
    expect(isPowensTransactionVisible({ active: true, deleted: "2026-07-31T10:00:00Z" })).toBe(false);
    expect(isPowensTransactionVisible({ active: true, deleted: null })).toBe(true);
  });

  it("rejects accounts hidden from PFM displays", () => {
    expect(isPowensAccountVisible({ display: false, disabled: null, deleted: null })).toBe(false);
    expect(isPowensAccountVisible({ display: true, disabled: "2026-07-31", deleted: null })).toBe(false);
    expect(isPowensAccountVisible({ display: true, disabled: null, deleted: null })).toBe(true);
  });

  it("keeps Powens internal transfers outside personal expenses", () => {
    const category = categorizePowensApiTransaction(
      { categories: [{ code: "internal_transfer", parent_code: "withdrawals_checks_and_transfer" }] },
      "Virement entre mes comptes",
      -500
    );

    expect(category).toBe("Retraits, Chq. et Vir. › Virements internes");
    expect(
      countsTowardPersonalExpenseKpi({
        id: "internal-1",
        date: "2026-07-10",
        label: "Virement entre mes comptes",
        category,
        amount: -500,
        company: "LCL",
        scope: "personal"
      })
    ).toBe(false);
  });

  it("maps incoming DigitPro reimbursements from their bank wording", () => {
    expect(
      categorizeDigitProIncomingTransfer(
        "VIREMENT INSTANTANE VIR INST DigitPro Consulting NDF IPR000342061777",
        509
      )
    ).toBe("NDF DigitPro");
    expect(
      categorizeDigitProIncomingTransfer(
        "Virement DigitPro Consulting indemnité kilométrique septembre",
        525
      )
    ).toBe("Indemnités kilométriques");
    expect(categorizeDigitProIncomingTransfer("Virement DigitPro Consulting IK", -525)).toBeNull();
  });

  it("maps Mr Lontsi transfers to rent", () => {
    expect(
      categorizeKnownPersonalTransfer("VIREMENT INSTANTANE VIR INST Mr LONTSI IPA000342062508", -1450)
    ).toBe("Logement › Loyer");
  });
});
