import { describe, expect, it } from "vitest";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { categorizeHiwayExpense } from "@/lib/hiway-categorisation";

describe("catégorisation iGraal", () => {
  const iGraalPurchase = {
    id: "igraal-1",
    date: "2025-12-23",
    label: "iGraal",
    company: "iGraal",
    category: "Repas d'affaires",
    amount: -140,
    scope: "pro" as const
  };

  it("classe iGraal dans les cadeaux client", () => {
    expect(categorizeHiwayExpense(iGraalPurchase)).toBe("Cadeau client");
  });

  it("conserve le cadeau client dans les frais personnels", () => {
    expect(
      deriveExpenseBucket({ ...iGraalPurchase, category: "Cadeau client", categoryManual: true })
    ).toBe("Cadeau client");
  });

  it("conserve ANCV comme catégorie personnelle manuelle", () => {
    expect(
      deriveExpenseBucket({ ...iGraalPurchase, label: "AGENCE", category: "ANCV", categoryManual: true })
    ).toBe("ANCV");
  });
});
