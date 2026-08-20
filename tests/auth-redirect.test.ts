import { describe, expect, it } from "vitest";
import { DEFAULT_AUTH_REDIRECT, getSafeAuthRedirect } from "@/lib/auth-redirect";

describe("getSafeAuthRedirect", () => {
  it("keeps internal destinations", () => {
    expect(getSafeAuthRedirect("/parametres?tab=securite")).toBe("/parametres?tab=securite");
  });

  it("falls back for missing or external destinations", () => {
    expect(getSafeAuthRedirect(null)).toBe(DEFAULT_AUTH_REDIRECT);
    expect(getSafeAuthRedirect("https://example.com")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(getSafeAuthRedirect("//example.com")).toBe(DEFAULT_AUTH_REDIRECT);
  });
});
