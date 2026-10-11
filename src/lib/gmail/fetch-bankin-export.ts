import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { MAX_IMPORT_BYTES } from "@/lib/security/import-validation";

import { BankinExportError, bankinExportLink, bankinExportReadySubject, downloadBankinFile } from "./bankin-download";
export { BankinExportError } from "./bankin-download";
export function bankinExcelParts(payload: gmail_v1.Schema$MessagePart | undefined, depth = 0): gmail_v1.Schema$MessagePart[] {
  if (!payload || depth > 12) return [];
  const own = /\.(xlsx|xls)$/i.test(payload.filename ?? "") ? [payload] : [];
  return own.concat((payload.parts ?? []).flatMap(p => bankinExcelParts(p, depth + 1)));
}
export function decodeBankinAttachment(data: string | null | undefined, declaredSize?: number | null): Buffer {
  if (!data || (declaredSize ?? 0) > MAX_IMPORT_BYTES || data.length > Math.ceil(MAX_IMPORT_BYTES * 4 / 3) + 4) throw new BankinExportError("Export vide ou trop volumineux (3 Mo maximum).");
  if (!/^[A-Za-z0-9_\-=]+$/.test(data)) throw new BankinExportError("Pièce jointe illisible.");
  const buffer = Buffer.from(data, "base64url");
  if (!buffer.length || buffer.length > MAX_IMPORT_BYTES) throw new BankinExportError("Export vide ou trop volumineux (3 Mo maximum).");
  return buffer;
}

function messageBodies(part: gmail_v1.Schema$MessagePart | undefined, depth = 0): string[] {
  if (!part || depth > 12) return [];
  const own = !part.filename && /^text\/(?:html|plain)$/i.test(part.mimeType ?? "") && part.body?.data
    ? [Buffer.from(part.body.data, "base64url").toString("utf8")] : [];
  return own.concat((part.parts ?? []).flatMap(p => messageBodies(p, depth + 1)));
}

/** Latest export-ready email, then its validated download link (or its Excel attachment). */
export async function fetchLatestBankinExport(auth: OAuth2Client) {
  const gmail = google.gmail({ version: "v1", auth });
  const options = { timeout: 20_000, retry: false, signal: AbortSignal.timeout(60_000) };
  const listed = await gmail.users.messages.list({ userId: "me", q: "from:ne-pas-repondre@bankin.com subject:export", maxResults: 20 }, options);
  const candidates: { messageId: string; received: number; payload: gmail_v1.Schema$MessagePart }[] = [];
  for (const item of listed.data.messages ?? []) {
    if (!item.id) continue;
    const message = await gmail.users.messages.get({ userId: "me", id: item.id, format: "full" }, options);
    const payload = message.data.payload;
    const header = (name: string) => payload?.headers?.find(h => h.name?.toLowerCase() === name)?.value ?? "";
    const addresses = header("from").match(/[a-z0-9._%+-]+@[a-z0-9.-]+/gi) ?? [];
    if (addresses.length !== 1 || addresses[0].toLowerCase() !== "ne-pas-repondre@bankin.com" || !bankinExportReadySubject(header("subject"))) continue;
    const received = Number(message.data.internalDate);
    if (payload && Number.isFinite(received) && received > 0) candidates.push({ messageId: item.id, received, payload });
  }
  candidates.sort((a, b) => b.received - a.received);
  const latest = candidates[0];
  if (!latest) throw new BankinExportError("Aucun email « Votre export de données est prêt » trouvé. Demandez un nouvel export dans Bankin.");
  const receivedAt = new Date(latest.received).toISOString();
  const link = bankinExportLink(messageBodies(latest.payload));
  if (link) return { ...await downloadBankinFile(link), receivedAt };
  const parts = bankinExcelParts(latest.payload).sort((a, b) => Number(/\.xlsx$/i.test(b.filename ?? "")) - Number(/\.xlsx$/i.test(a.filename ?? "")));
  const part = parts[0];
  if (!part) throw new BankinExportError("Le dernier email Bankin ne contient pas de lien d’export autorisé ni de fichier Excel. Importez votre fichier manuellement.");
  if ((part.body?.size ?? 0) > MAX_IMPORT_BYTES) throw new BankinExportError("Le dernier export dépasse 3 Mo. Réduisez la période dans Bankin.");
  let data = part.body?.data;
  if (part.body?.attachmentId) {
    const attachment = await gmail.users.messages.attachments.get({ userId: "me", messageId: latest.messageId, id: part.body.attachmentId }, options);
    data = attachment.data.data;
  }
  const buffer = decodeBankinAttachment(data, part.body?.size);
  const filename = (part.filename ?? "bankin.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  return { buffer, filename, receivedAt };
}
