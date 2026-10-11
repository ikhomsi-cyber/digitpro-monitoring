import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assertQontoOwner } from "@/lib/security/qonto-access";
import { encryptIntegrationToken, decryptIntegrationToken } from "@/lib/security/integration-secrets";
import { validateImport, MAX_IMPORT_ROWS } from "@/lib/security/import-validation";
import { checkWorkbookArchive } from "@/lib/security/workbook-limits";
import { requireSameOrigin } from "@/lib/security/http";
import { fetchWithNetworkDiagnostics } from "@/lib/fetch-network-error";

beforeEach(() => {
  vi.stubEnv("QONTO_ALLOWED_USER_ID", "owner");
  vi.stubEnv("INTEGRATION_TOKEN_ENCRYPTION_KEY", "ab".repeat(32));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("denies other accounts and missing Qonto configuration", () => {
  expect(() => assertQontoOwner("owner")).not.toThrow();
  expect(() => assertQontoOwner("other")).toThrow();
  vi.stubEnv("QONTO_ALLOWED_USER_ID", "");
  expect(() => assertQontoOwner("owner")).toThrow();
});
it("encrypts with random nonces and rejects cross-user reuse, tampering and plaintext", () => {
  const encrypted = encryptIntegrationToken("private-token", "gmail:owner:refresh_token");
  expect(encrypted).not.toContain("private-token");
  expect(encryptIntegrationToken("private-token", "gmail:owner:refresh_token")).not.toBe(encrypted);
  expect(decryptIntegrationToken(encrypted, "gmail:owner:refresh_token")).toBe("private-token");
  expect(() => decryptIntegrationToken(encrypted, "gmail:other:refresh_token")).toThrow();
  const damaged = Buffer.from(encrypted.slice(7), "base64"); damaged[20] ^= 1;
  expect(() => decryptIntegrationToken("enc:v1:" + damaged.toString("base64"), "gmail:owner:refresh_token")).toThrow();
  expect(() => decryptIntegrationToken("plaintext", "gmail:owner:refresh_token")).toThrow();
});
it("rejects malformed financial imports and excessive rows", () => {
  const row = { date: "2026-10-11", label: "A", category: "Divers", amount: 1, company: "Bank" };
  const meta = { sourceFilename: "test.csv", format: "generic", fileHash: null };
  expect(validateImport([row], meta).rows).toHaveLength(1);
  for (const change of [{ amount: Infinity }, { date: "2026-02-30" }, { label: "a".repeat(1001) }, { scope: "admin" }]) {
    expect(() => validateImport([{ ...row, ...change }], meta)).toThrow();
  }
  expect(() => validateImport(Array(MAX_IMPORT_ROWS + 1).fill(row), meta)).toThrow();
});
it("rejects cross-origin and origin-less cookie mutations", () => {
  expect(requireSameOrigin(new Request("https://digitpro.test/api", { headers: { origin: "https://attacker.test" } }))?.status).toBe(403);
  expect(requireSameOrigin(new Request("https://digitpro.test/api"))?.status).toBe(403);
  expect(requireSameOrigin(new Request("https://digitpro.test/api", { headers: { origin: "https://digitpro.test" } }))).toBeNull();
});
it("never contacts unapproved network destinations and blocks redirects", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
  await expect(fetchWithNetworkDiagnostics("https://evil.test", {}, "test")).rejects.toThrow();
  await expect(fetchWithNetworkDiagnostics("http://localhost", {}, "test")).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  await fetchWithNetworkDiagnostics("https://thirdparty.qonto.com/v2/organization", {}, "test");
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }));
});

it("rejects an XLSX archive declaring excessive decompressed content", () => {
  const buffer = new ArrayBuffer(98); const view = new DataView(buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint32(30, 0x02014b50, true);
  view.setUint32(50, 100, true); view.setUint32(54, 100_000_000, true);
  view.setUint32(76, 0x06054b50, true);
  view.setUint16(84, 1, true); view.setUint16(86, 1, true);
  view.setUint32(88, 46, true); view.setUint32(92, 30, true);
  expect(() => checkWorkbookArchive(buffer)).toThrow("Archive");
});
it("refuses foreign Powens pagination hosts and never retries a denied request", async () => {
  vi.stubEnv("POWENS_DOMAIN", "https://digitpro.biapi.pro");
  const fetch = vi.fn().mockResolvedValue(new Response("denied", { status: 403 })); vi.stubGlobal("fetch", fetch);
  await expect(fetchWithNetworkDiagnostics("https://other.biapi.pro/2.0/users/me", {}, "test")).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  await expect(fetchWithNetworkDiagnostics("https://digitpro.biapi.pro/2.0/users/me", {}, "test")).rejects.toThrow("refusé");
  expect(fetch).toHaveBeenCalledTimes(1);
});
