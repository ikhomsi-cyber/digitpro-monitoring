import { describe, expect, it } from "vitest";
import {
  buildBankinPersonalReferenceModel,
  resolveBankinPersonalCategory
} from "@/lib/bankin/reference-categories";

describe("Bankin personal reference model", () => {
  it("reproduit la sous-catégorie Bankin connue pour un futur libellé API", () => {
    const model = buildBankinPersonalReferenceModel([
      {
        label: "CB AUCHAN SUPERMARC 20/08/26",
        category: "Alimentation & Restau › Auchan"
      },
      {
        label: "CB AUCHAN SUPERMARC 12/08/26",
        category: "Alimentation & Restau › Auchan"
      }
    ]);

    expect(
      resolveBankinPersonalCategory(
        model,
        "Repas dirigeant",
        "CARTE 0699559 CB AUCHAN SUPERMARC 23/08/26 CBLM ILIASS KHOMSI"
      )
    ).toBe("Alimentation & Restau › Auchan");
  });

  it("ne devine pas lorsqu'un commerçant est ambigu", () => {
    const model = buildBankinPersonalReferenceModel([
      { label: "CB EXEMPLE 01/08/26", category: "Achats & Shopping › Cadeaux" },
      { label: "CB EXEMPLE 02/08/26", category: "Alimentation & Restau › Café" }
    ]);

    expect(resolveBankinPersonalCategory(model, "Repas dirigeant", "CB EXEMPLE 03/08/26")).toBeNull();
  });
});
