import "server-only";

import { google, type gmail_v1, type Auth } from "googleapis";
import { qontoDebitGmailQueries } from "@/lib/gmail/config";
import { htmlToText } from "@/lib/gmail/hiway-invoice-parser";
import { decodeMimeHeader } from "@/lib/gmail/mime-header";
import {
  filterFutureQontoDebits,
  isQontoDebitNotificationSubject,
  parseQontoUpcomingDebit,
  type QontoUpcomingDebit
} from "@/lib/gmail/qonto-debit-parser";

const MAX_MESSAGES = 100;

function decodeBase64Url(data: string | null | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

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
  return decodeMimeHeader(found?.value ?? "");
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

async function listMessageIds(gmail: gmail_v1.Gmail, queries: string[]): Promise<string[]> {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const q of queries) {
    let pageToken: string | undefined;
    do {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: MAX_MESSAGES,
        pageToken
      });
      for (const message of listRes.data.messages ?? []) {
        if (message.id && !seen.has(message.id)) {
          seen.add(message.id);
          ids.push(message.id);
        }
      }
      pageToken = listRes.data.nextPageToken ?? undefined;
    } while (pageToken && ids.length < MAX_MESSAGES);
    if (ids.length > 0) break;
  }

  return ids.slice(0, MAX_MESSAGES);
}

/**
 * Recherche les emails Qonto « … débitera votre compte … » et extrait les prélèvements futurs.
 */
export async function fetchQontoUpcomingDebitsFromGmail(
  auth: Auth.OAuth2Client
): Promise<QontoUpcomingDebit[]> {
  const gmail = google.gmail({ version: "v1", auth });
  const ids = await listMessageIds(gmail, qontoDebitGmailQueries());

  const debits: QontoUpcomingDebit[] = [];
  const seenDebitKeys = new Set<string>();

  for (const id of ids) {
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full"
    });
    const message = msgRes.data;
    const subject = headerValue(message.payload?.headers, "Subject");
    if (!isQontoDebitNotificationSubject(subject)) continue;
    const body = extractBody(message.payload ?? undefined);
    const parsed = parseQontoUpcomingDebit({
      id,
      subject,
      body,
      emailDateIso: messageDateIso(message)
    });
    if (!parsed) continue;
    const key = `${parsed.organization}|${parsed.debitDateIso}|${parsed.amountEur ?? ""}`;
    if (seenDebitKeys.has(key)) continue;
    seenDebitKeys.add(key);
    debits.push(parsed);
  }

  return filterFutureQontoDebits(debits);
}
