import { inflateRawSync } from "node:zlib";
import { MAX_IMPORT_BYTES } from "@/lib/security/import-validation";
import { checkWorkbookArchive } from "@/lib/security/workbook-limits";

export class BankinExportError extends Error {}
// Exact export bucket observed in Bankin's export-ready emails. No arbitrary S3 bucket or email URL.
const EXPORT_HOST = "tf-prod-bankin-s3-service-transactionexport-account-transaction.s3.eu-west-1.amazonaws.com";
export function validateBankinDownloadUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new BankinExportError("Lien d’export Bankin invalide."); }
  if (raw.length > 16_000 || url.protocol !== "https:" || url.hostname !== EXPORT_HOST || url.port || url.username || url.password || url.hash) {
    throw new BankinExportError("Domaine du lien d’export Bankin non autorisé.");
  }
  return url;
}
function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity.toLowerCase().startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}
export function bankinExportLink(bodies: string[]): string | null {
  for (const body of bodies) {
    if (body.length > 1_000_000) throw new BankinExportError("Email d’export trop volumineux.");
    const links = [...body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
    links.push(...[...body.matchAll(/https:\/\/[^\s<>"']+/g)].map(m => m[0]));
    for (const raw of links) {
      try { return validateBankinDownloadUrl(decodeEntities(raw.trim())).href; } catch { /* Ignore unrelated footer links. */ }
    }
  }
  return null;
}
export function bankinExportReadySubject(value: string): boolean {
  const folded = value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
  return /^votre export(?: de donnees)? est pret[.!]?$/i.test(folded);
}

/** Read only a bounded error prefix and expose fixed messages, never S3's raw response. */
async function bankinBadRequestMessage(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      while (length < 4096) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const prefix = chunk.value.subarray(0, 4096 - length);
        chunks.push(prefix); length += prefix.length;
      }
    } catch { /* Preserve the original HTTP error when its body cannot be read. */ }
    finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
  const code = Buffer.concat(chunks).toString("utf8").match(/<Code>\s*([A-Za-z]+)\s*<\/Code>/)?.[1];
  const reasons: Record<string, string> = {
    ExpiredToken: "Le lien Bankin contient une autorisation expirée (ExpiredToken).",
    RequestExpired: "Le lien Bankin a expiré (RequestExpired).",
    InvalidToken: "L’autorisation du lien Bankin est invalide (InvalidToken).",
    AuthorizationQueryParametersError: "Les paramètres de signature du lien Bankin sont invalides (AuthorizationQueryParametersError).",
    InvalidArgument: "Le lien Bankin contient un paramètre invalide (InvalidArgument).",
    InvalidRequest: "Le serveur Bankin refuse cette requête de téléchargement (InvalidRequest).",
    RequestTimeTooSkewed: "Le serveur Bankin signale un décalage d’horloge (RequestTimeTooSkewed)."
  };
  const reason = code && Object.hasOwn(reasons, code) ? reasons[code] : "Bankin refuse le lien de cet export (HTTP 400, motif non reconnu).";
  return `${reason} Demandez un nouvel export dans Bankin et attendez le nouvel email avant de relancer l’import Gmail. Votre bilan Pilote est conservé. Vous pouvez aussi utiliser le bouton Excel avec un fichier déjà téléchargé.`;
}

/** Download only from the known export host; never forward Gmail credentials or follow unchecked redirects. */
export async function downloadBankinFile(link: string, fetcher: typeof fetch = fetch): Promise<{ buffer: Buffer; filename: string }> {
  let url = validateBankinDownloadUrl(link);
  const signal = AbortSignal.timeout(30_000);
  let redirects = 0;
  let transientRetries = 0;
  while (redirects <= 3) {
    const response = await fetcher(url.href, { redirect: "manual", signal, credentials: "omit", cache: "no-store" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new BankinExportError("Redirection d’export invalide.");
      url = validateBankinDownloadUrl(new URL(location, url).href); redirects++; continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      throw new BankinExportError("Le lien du dernier export a expiré ou son accès est refusé. Demandez un nouvel export dans Bankin.");
    }
    if (!response.ok) {
      if (response.status === 400) throw new BankinExportError(await bankinBadRequestMessage(response));
      await response.body?.cancel();
      // Retry only a temporary failure, against the same validated URL and without credentials.
      if ([429, 500, 502, 503, 504].includes(response.status) && transientRetries < 1) {
        transientRetries++;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      throw new BankinExportError(`Le téléchargement Bankin est indisponible (HTTP ${response.status}). Réessayez dans quelques instants ou importez votre fichier avec le bouton Excel. Votre bilan Pilote est conservé.`);
    }
    if (Number(response.headers.get("content-length") ?? 0) > MAX_IMPORT_BYTES) {
      await response.body?.cancel(); throw new BankinExportError("Export trop volumineux (3 Mo maximum). Réduisez la période dans Bankin.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new BankinExportError("Export Bankin vide.");
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > MAX_IMPORT_BYTES) { await reader.cancel(); throw new BankinExportError("Export trop volumineux (3 Mo maximum)."); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    if (!length) throw new BankinExportError("Export Bankin vide.");
    const buffer = Buffer.concat(chunks);
    const filename = decodeURIComponent(url.pathname.split("/").at(-1) ?? "bankin.zip").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
    return bankinWorkbookFromDownload(buffer, filename);
  }
  throw new BankinExportError("Téléchargement Bankin impossible.");
}

/** Extract one Excel file in memory, with archive limits BEFORE decompression. Never writes archive paths. */
export function bankinWorkbookFromDownload(buffer: Buffer, filename: string): { buffer: Buffer; filename: string } {
  if (!buffer.length || buffer.length > MAX_IMPORT_BYTES) throw new BankinExportError("Export vide ou trop volumineux.");
  if (/\.(xlsx|xls)$/i.test(filename)) return { buffer, filename };
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) throw new BankinExportError("Le lien ne contient pas un export Excel ou ZIP Bankin valide.");
  try {
    checkWorkbookArchive(Uint8Array.from(buffer).buffer);
    let end = buffer.length - 22;
    while (end >= Math.max(0, buffer.length - 65_557) && !(buffer.readUInt32LE(end) === 0x06054b50 && end + 22 + buffer.readUInt16LE(end + 20) === buffer.length)) end--;
    if (end < 0) throw new Error("ZIP");
    const entries = buffer.readUInt16LE(end + 10), directoryOffset = buffer.readUInt32LE(end + 16);
    let at = directoryOffset;
    const excel: { name: string; offset: number; method: number; compressed: number; expanded: number }[] = [];
    for (let i = 0; i < entries; i++) {
      const nameLength = buffer.readUInt16LE(at + 28);
      const name = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
      if (/\.(xlsx|xls)$/i.test(name) && !name.split("/").some(part => part.startsWith(".")) && !name.startsWith("__MACOSX/")) {
        excel.push({ name, offset: buffer.readUInt32LE(at + 42), method: buffer.readUInt16LE(at + 10), compressed: buffer.readUInt32LE(at + 20), expanded: buffer.readUInt32LE(at + 24) });
      }
      at += 46 + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
    }
    // Excel + CSV is normal. Multiple Excel workbooks are ambiguous: never import an arbitrary account.
    if (excel.length !== 1) throw new BankinExportError(excel.length ? "Plusieurs fichiers Excel dans l’archive. Importez manuellement le fichier personnel souhaité." : "Aucun fichier Excel trouvé dans l’archive Bankin.");
    const file = excel[0]; const offset = file.offset;
    if (!file.expanded || file.expanded > MAX_IMPORT_BYTES || offset + 30 > directoryOffset || buffer.readUInt32LE(offset) !== 0x04034b50 || (buffer.readUInt16LE(offset + 6) & 1) || buffer.readUInt16LE(offset + 8) !== file.method) throw new Error("ZIP entry");
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    if (start + file.compressed > directoryOffset) throw new Error("ZIP bounds");
    const packed = buffer.subarray(start, start + file.compressed);
    const unpacked = file.method === 0 ? packed : file.method === 8 ? inflateRawSync(packed, { maxOutputLength: MAX_IMPORT_BYTES }) : null;
    if (!unpacked || unpacked.length !== file.expanded) throw new Error("ZIP content");
    return { buffer: unpacked, filename: file.name.split("/").at(-1)!.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) };
  } catch (error) {
    if (error instanceof BankinExportError) throw error;
    throw new BankinExportError("Archive Bankin invalide ou trop volumineuse.");
  }
}
