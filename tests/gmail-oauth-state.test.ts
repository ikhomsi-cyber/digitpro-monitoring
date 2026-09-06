import { describe, expect, it } from "vitest";
import { isValidGmailOAuthState } from "@/lib/gmail/oauth-state";

describe("isValidGmailOAuthState", () => {
  it("accepts the exact callback state only", () => {
    expect(isValidGmailOAuthState("2ca97e79-e76e-4399-a6db-58b9e71d2153", "2ca97e79-e76e-4399-a6db-58b9e71d2153")).toBe(true);
  });

  it("rejects missing or mismatched values", () => {
    expect(isValidGmailOAuthState(undefined, "state")).toBe(false);
    expect(isValidGmailOAuthState("state", null)).toBe(false);
    expect(isValidGmailOAuthState("state", "other")).toBe(false);
  });
});
