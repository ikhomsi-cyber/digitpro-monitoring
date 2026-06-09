import "server-only";

import { google, type gmail_v1, type Auth } from "googleapis";
import { hiwayInvoiceGmailQuery, isHiwayInvoiceSubject } from "@/lib/gmail/config";
import {
  htmlToText,
  parseHiwayInvoice,
  type HiwayInvoice
} from "@/lib/gmail/hiway-invoice-parser";

const MAX_MESSAGES = 50;

function decodeBase64Url(data: string | null | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/** Concatène le meilleur contenu texte d'un message (text/plain prioritaire). */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  let plain = "";
  let html = "";

  const walk = (part: gmail_v1.Schema$MessagePart) => {
    const mime = part.mimeType ?? "";
    const data = part.body?.data;
    if (mime === "text/plain" && data) {
      plain += decodeBase64Url(data) + "\n";
    } else if (mime === "text/html" && data) {
      html += decodeBase64Url(data) + "\n";
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);

  if (plain.trim()) return plain;
  if (html.trim()) return htmlToText(html);
  return "";
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const found = headers?.find((h) => (h.name ?? "").toLowerCase() === name.toLowerCase());
  return found?.value ?? "";
}

function messageDateIso(message: gmail_v1.Schema$Message): string {
  if (message.internalDate) {
    const ms = Number(message.internalDate);
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  const headerDate = headerValue(message.payload?.headers, "Date");
  const parsed = headerDate ? new Date(headerDate) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

/**
 * Recherche et parse les factures « DigitPro Consulting - Facture F… » envoyées par Hiway,
 * triées de la plus récente à la plus ancienne.
 */
export async function fetchHiwayInvoicesFromGmail(auth: Auth.OAuth2Client): Promise<HiwayInvoice[]> {
  const gmail = google.gmail({ version: "v1", auth });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: hiwayInvoiceGmailQuery(),
    maxResults: MAX_MESSAGES
  });

  const ids = (listRes.data.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id));

  const invoices: HiwayInvoice[] = [];
  for (const id of ids) {
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full"
    });
    const message = msgRes.data;
    const subject = headerValue(message.payload?.headers, "Subject");
    if (!isHiwayInvoiceSubject(subject)) continue;
    const body = extractBody(message.payload ?? undefined);
    invoices.push(
      parseHiwayInvoice({
        id,
        subject,
        body,
        dateIso: messageDateIso(message)
      })
    );
  }

  return invoices.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Récupère l'adresse email du compte Gmail connecté. */
export async function fetchGmailAddress(auth: Auth.OAuth2Client): Promise<string | null> {
  try {
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data.emailAddress ?? null;
  } catch {
    return null;
  }
}
