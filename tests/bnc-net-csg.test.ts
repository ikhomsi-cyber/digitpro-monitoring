import { describe, expect, it } from "vitest";
import { computeBncNetWithCsg172 } from "@/lib/impots/tax-analysis";

describe("BNC net with the 17.2% scenario", () => {
  it("subtracts income tax and the full 17.2% provision from gross BNC", () => {
    expect(computeBncNetWithCsg172({ bncBrut: 180038, irAttribuableBnc: 31672 }))
      .toEqual({ csgEur: 30966.54, netEur: 117399.46 });
  });
  it("does not produce negative disposable income", () => {
    expect(computeBncNetWithCsg172({ bncBrut: 100, irAttribuableBnc: 90 }).netEur).toBe(0);
    expect(computeBncNetWithCsg172({ bncBrut: 0, irAttribuableBnc: 0 }))
      .toEqual({ csgEur: 0, netEur: 0 });
  });
});
