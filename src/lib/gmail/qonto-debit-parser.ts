import { parseFrenchAmount } from "@/lib/gmail/hiway-invoice-parser";

/** Prélèvement Qonto annoncé par email, avec date de débit future. */
export type QontoUpcomingDebit = {
  /** Id du message Gmail. */
  id: string;
  subject: string;
  /** Organisme / créancier qui va débiter le compte. */
  organization: string;
  amountEur: number | null;
  /** Date prévue du débit (ISO YYYY-MM-DD). */
  debitDateIso: string;
  /** Date d'envoi de l'email (ISO YYYY-MM-DD). */
  emailDateIso: string;
};

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  fevr: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  aout: 8,
  septembre: 9,
  sept: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  dec: 12
};

function foldAccents(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function isQontoDebitNotificationSubject(subject: string): boolean {
  return foldAccents(subject).includes("debitera votre compte");
}

function cleanOrganization(raw: string): string {
  return raw
    .replace(/^[\s[\(]*(?:qonto[^\w]*)?(?:notification\s*:?\s*)?/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[-–—|·]\s*/, "")
    .trim();
}

function monthNumberFromName(name: string): number | null {
  const key = foldAccents(name).replace(/\./g, "");
  return FRENCH_MONTHS[key] ?? null;
}

/** Parse une date FR (JJ/MM/AAAA, JJ-MM-AAAA, « 15 juin 2026 »). */
export function parseFrenchDebitDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const numeric = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (numeric) {
    const dd = numeric[1]!.padStart(2, "0");
    const mm = numeric[2]!.padStart(2, "0");
    const yyyy = numeric[3]!;
    return `${yyyy}-${mm}-${dd}`;
  }

  const named = text.match(
    /(\d{1,2})\s+(janvier|f[eé]vrier|f[eé]vr\.?|mars|avril|mai|juin|juillet|juil\.?|ao[uû]t|septembre|sept\.?|octobre|oct\.?|novembre|nov\.?|d[eé]cembre|d[eé]c\.?)\s+(\d{4})/i
  );
  if (named) {
    const month = monthNumberFromName(named[2]!);
    if (month) {
      const dd = named[1]!.padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return `${named[3]}-${mm}-${dd}`;
    }
  }

  return null;
}

function extractOrganizationFromSubject(subject: string): string | null {
  const match = subject.match(
    /(?:^|[\[(])?(?:qonto[^\w]*)?(?:notification\s*:?\s*)?(.+?)\s+d[éeè]bitera\s+votre\s+compte/i
  );
  if (!match?.[1]) return null;
  const org = cleanOrganization(match[1]);
  return org.length >= 2 ? org : null;
}

function extractOrganizationFromBody(body: string): string | null {
  const patterns = [
    /(?:cr[ée]ancier|organisme|b[ée]n[ée]ficiaire|contrepartie|libell[ée])\s*:?\s*([^\n\r|]+)/i,
    /(?:pr[ée]l[èe]vement\s+(?:de|par|par\s+l['']organisme)?)\s*([A-ZÀ-Ü0-9][^\n\r|.]{2,60})/i
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m?.[1]) {
      const org = cleanOrganization(m[1]);
      if (org.length >= 2 && !/montant|date|compte/i.test(org)) return org;
    }
  }
  return null;
}

function extractDebitDate(text: string): string | null {
  const patterns = [
    /d[éeè]bitera\s+votre\s+compte\s+(?:le\s*)?([^\n\r|.]{4,40})/i,
    /(?:date\s+(?:de\s+)?(?:pr[ée]l[èe]vement|d[ée]bit|op[ée]ration)|sera\s+d[ée]bit[ée]|pr[ée]vu\s+le)\s*:?\s*([^\n\r|.]{4,40})/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const parsed = parseFrenchDebitDate(m[1].trim());
      if (parsed) return parsed;
    }
  }
  const inline = text.match(
    /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{1,2}\s+(?:janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+\d{4})/i
  );
  if (inline?.[1]) return parseFrenchDebitDate(inline[1]);
  return null;
}

function extractAmountEur(text: string): number | null {
  const patterns = [
    /montant\s*(?:du\s+pr[ée]l[èe]vement|de\s+l['']op[ée]ration)?\s*:?\s*([\d\s\u00a0\u202f.,]+)\s*(?:€|eur)/i,
    /([\d\s\u00a0\u202f.,]+)\s*(?:€|eur(?:os)?)\s*(?:\(?\s*ttc\s*\)?)?/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const value = parseFrenchAmount(m[1]);
      if (value != null && value > 0) return value;
    }
  }
  return null;
}

export function parseQontoUpcomingDebit(input: {
  id: string;
  subject: string;
  body: string;
  emailDateIso: string;
}): QontoUpcomingDebit | null {
  if (!isQontoDebitNotificationSubject(input.subject)) return null;

  const combined = `${input.subject}\n${input.body}`;
  const debitDateIso = extractDebitDate(combined);
  if (!debitDateIso) return null;

  const organization =
    extractOrganizationFromSubject(input.subject) ??
    extractOrganizationFromBody(input.body) ??
    "Prélèvement";

  return {
    id: input.id,
    subject: input.subject.trim(),
    organization,
    amountEur: extractAmountEur(combined),
    debitDateIso,
    emailDateIso: input.emailDateIso
  };
}

export function localTodayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ne conserve que les débits strictement postérieurs à aujourd'hui. */
export function filterFutureQontoDebits(
  debits: readonly QontoUpcomingDebit[],
  todayIso = localTodayIso()
): QontoUpcomingDebit[] {
  return debits
    .filter((row) => row.debitDateIso > todayIso)
    .sort((a, b) =>
      a.debitDateIso !== b.debitDateIso
        ? a.debitDateIso.localeCompare(b.debitDateIso)
        : a.organization.localeCompare(b.organization, "fr")
    );
}
