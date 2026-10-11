import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), attachment: vi.fn() }));
vi.mock("googleapis", () => ({ google: { gmail: () => ({ users: { messages: { list: mocks.list, get: mocks.get, attachments: { get: mocks.attachment } } } }) } }));
import { bankinExcelParts, decodeBankinAttachment, fetchLatestBankinExport } from "@/lib/gmail/fetch-bankin-export";
import { MAX_IMPORT_BYTES } from "@/lib/security/import-validation";
import type { OAuth2Client } from "google-auth-library";
const auth = {} as OAuth2Client;
beforeEach(() => vi.resetAllMocks());
it("retrieves the latest received Excel including nested attachments for export-ready emails", async () => {
  mocks.list.mockResolvedValue({ data: { messages: [{ id: "old" }, { id: "new" }] } });
  mocks.get.mockImplementation(({ id }) => Promise.resolve({ data: { internalDate: id === "old" ? "100" : "200", payload: { headers: [{ name: "From", value: "Bankin <ne-pas-repondre@bankin.com>" }, { name: "Subject", value: "Votre export de données est prêt" }], parts: [{ parts: [{ filename: `${id}.xlsx`, body: { attachmentId: id, size: 5 } }] }] } } }));
  mocks.attachment.mockResolvedValue({ data: { data: Buffer.from("excel").toString("base64url") } });
  const file = await fetchLatestBankinExport(auth);
  expect(file.filename).toBe("new.xlsx"); expect(file.buffer.toString()).toBe("excel");
  expect(mocks.attachment).toHaveBeenCalledOnce(); expect(mocks.attachment.mock.calls[0][0].messageId).toBe("new");
  expect(mocks.list.mock.calls[0][0].q).toContain("from:ne-pas-repondre@bankin.com");
});
it("rejects wrong senders, missing attachments and large newest exports without importing an older file", async () => {
  mocks.list.mockResolvedValue({ data: { messages: [{ id: "a" }] } });
  mocks.get.mockResolvedValue({ data: { payload: { headers: [{ name: "From", value: "attacker@example.test" }], filename: "export.xlsx", body: { data: "ZXhjZWw" } } } });
  await expect(fetchLatestBankinExport(auth)).rejects.toThrow("Aucun email");
  mocks.get.mockResolvedValue({ data: { internalDate: "200", payload: { headers: [{ name: "From", value: "ne-pas-repondre@bankin.com" }, { name: "Subject", value: "Votre export est prêt" }], filename: "export.xlsx", body: { attachmentId: "a", size: MAX_IMPORT_BYTES + 1 } } } });
  await expect(fetchLatestBankinExport(auth)).rejects.toThrow("dépasse 3 Mo"); expect(mocks.attachment).not.toHaveBeenCalled();
});
it("stops on provider denial and validates attachment size and encoding", async () => {
  const denial = Object.assign(new Error("denied"), { code: 403 }); mocks.list.mockRejectedValue(denial);
  await expect(fetchLatestBankinExport(auth)).rejects.toBe(denial); expect(mocks.get).not.toHaveBeenCalled();
  expect(() => decodeBankinAttachment("###")).toThrow("illisible"); expect(() => decodeBankinAttachment("YQ", MAX_IMPORT_BYTES + 1)).toThrow("volumineux");
  expect(bankinExcelParts({ parts: [{ filename: "ignore.html" }, { filename: "export.XLS" }] })).toHaveLength(1);
});
it("uses the latest export-ready email link and never falls back to an old email if it expired", async () => {
  const host = "tf-prod-bankin-s3-service-transactionexport-account-transaction.s3.eu-west-1.amazonaws.com";
  mocks.list.mockResolvedValue({ data: { messages: [{ id: "old" }, { id: "new" }, { id: "unrelated" }] } });
  mocks.get.mockImplementation(({ id }) => Promise.resolve({ data: { internalDate: id === "unrelated" ? "300" : id === "old" ? "100" : "200", payload: { headers: [{ name: "From", value: "Bankin <ne-pas-repondre@bankin.com>" }, { name: "Subject", value: id === "unrelated" ? "Nouveautés Bankin" : "Votre export de données est prêt" }], mimeType: "multipart/mixed", parts: [{ mimeType: "text/html", body: { data: Buffer.from(`<a href="https://${host}/${id}.zip?signature=fixture&amp;type=export">TELECHARGER</a>`).toString("base64url") } }] } } }));
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 })); vi.stubGlobal("fetch", fetcher);
  await expect(fetchLatestBankinExport(auth)).rejects.toThrow("expiré");
  expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0][0]).toContain("/new.zip?signature=fixture&type=export");
  expect(mocks.attachment).not.toHaveBeenCalled(); vi.unstubAllGlobals();
});
