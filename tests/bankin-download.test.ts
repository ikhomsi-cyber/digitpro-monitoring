import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { bankinExportLink, bankinExportReadySubject, bankinWorkbookFromDownload, downloadBankinFile, validateBankinDownloadUrl } from "@/lib/gmail/bankin-download";
import { MAX_IMPORT_BYTES } from "@/lib/security/import-validation";
const HOST = "tf-prod-bankin-s3-service-transactionexport-account-transaction.s3.eu-west-1.amazonaws.com";
const link = `https://${HOST}/fixture/export.zip?X-Amz-Date=fixture&X-Amz-Signature=fixture`;
function workbook(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", "Description", "Compte", "Montant", "Catégorie", "Sous-Catégorie", "Note", "Pointée"], ["2026-10-01", "TEST", "Compte synthétique", -12, "Logement", "Loyer", "", ""]]), "Transactions");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
function zip(files: Record<string, Buffer>, compression = false): Buffer {
  const cfb = XLSX.CFB.utils.cfb_new();
  for (const [name, content] of Object.entries(files)) XLSX.CFB.utils.cfb_add(cfb, name, content);
  return XLSX.CFB.write(cfb, { type: "buffer", fileType: "zip", compression });
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());
it("accepts actual subject variants and only extracts the export bucket link with decoded HTML entities", () => {
  expect(bankinExportReadySubject("Votre export de données est prêt")).toBe(true);
  expect(bankinExportReadySubject(" Votre export est PRET ")).toBe(true);
  expect(bankinExportReadySubject("Votre export est prêt : envoyer vos identifiants")).toBe(false);
  expect(bankinExportLink([`<a href="https://attacker.test/export.zip">download</a><a href="${link.replace(/&/g, "&amp;")}">TELECHARGER MES DONNEES</a>`])).toBe(link);
  for (const raw of [`http://${HOST}/export.zip`, "https://127.0.0.1/export.zip", `https://${HOST}.attacker.test/export.zip`, `https://user:pass@${HOST}/export.zip`, `https://${HOST}:8443/export.zip`, "https://other-bucket.s3.eu-west-1.amazonaws.com/export.zip"]) expect(() => validateBankinDownloadUrl(raw)).toThrow();
  expect(bankinExportLink(["<a href='http://169.254.169.254/latest/meta-data'>export</a>"])).toBeNull();
});
it("extracts the Excel from the export ZIP, ignores CSV, and never writes archive paths", () => {
  const excel = workbook();
  for (const compression of [false, true]) {
    const file = bankinWorkbookFromDownload(zip({ "export/transactions.xlsx": excel, "export/transactions.csv": Buffer.from("fixture") }, compression), "export.zip");
    expect(file.filename).toBe("transactions.xlsx"); expect(file.buffer).toEqual(excel);
  }
  expect(() => bankinWorkbookFromDownload(zip({ "one.xlsx": excel, "two.xlsx": excel }), "export.zip")).toThrow("Plusieurs fichiers");
  expect(() => bankinWorkbookFromDownload(zip({ "../outside.xlsx": excel }), "export.zip")).toThrow("Aucun fichier");
});
it("rejects HTML, malformed archives, oversized workbooks and compression bombs", () => {
  expect(() => bankinWorkbookFromDownload(Buffer.from("<html>expired</html>"), "export.zip")).toThrow("valide");
  const broken = Buffer.alloc(25); broken.writeUInt32LE(0x04034b50); expect(() => bankinWorkbookFromDownload(broken, "export.zip")).toThrow("invalide");
  expect(() => bankinWorkbookFromDownload(zip({ "file.xlsx": Buffer.alloc(MAX_IMPORT_BYTES + 1) }, true), "export.zip")).toThrow("volumineuse");
});
it("downloads without credentials, rejects off-domain redirects before requesting them, and stops on access refusal", async () => {
  const fetcher = vi.fn<typeof fetch>();
  fetcher.mockResolvedValueOnce(new Response(Uint8Array.from(zip({ "transactions.xlsx": workbook() })), { status: 200 }));
  const file = await downloadBankinFile(link, fetcher); expect(file.filename).toBe("transactions.xlsx");
  expect(fetcher).toHaveBeenCalledWith(link, expect.objectContaining({ redirect: "manual", credentials: "omit", cache: "no-store" }));
  fetcher.mockReset().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/secret" } }));
  await expect(downloadBankinFile(link, fetcher)).rejects.toThrow("non autorisé"); expect(fetcher).toHaveBeenCalledOnce();
  fetcher.mockReset().mockResolvedValue(new Response(null, { status: 403 }));
  await expect(downloadBankinFile(link, fetcher)).rejects.toThrow("expiré"); expect(fetcher).toHaveBeenCalledOnce();
});
it("bounds downloads even without Content-Length and catches declared oversized responses", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(Uint8Array.from(Buffer.alloc(MAX_IMPORT_BYTES + 1))));
  await expect(downloadBankinFile(link, fetcher)).rejects.toThrow("volumineux");
  fetcher.mockResolvedValue(new Response(null, { headers: { "content-length": String(MAX_IMPORT_BYTES + 1) } }));
  await expect(downloadBankinFile(link, fetcher)).rejects.toThrow("volumineux");
});
