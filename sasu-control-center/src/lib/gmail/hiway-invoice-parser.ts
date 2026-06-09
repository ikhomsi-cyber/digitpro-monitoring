import {
  BILLABLE_CLIENT_TJM_HT,
  resolveBillableTjmForClientMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";

/** Facture DigitPro émise par Hiway, telle que parsée depuis un email. */
export type HiwayInvoice = {
  /** Id du message Gmail (clé stable). */
  id: string;
  /** Date d'envoi de l'email (ISO YYYY-MM-DD). */
  date: string;
  /** Montant détecté (prioritairement HT si libellé, sinon le plus probable). */
  amountEur: number | null;
  /** Nature du montant détecté. */
  amountKind: "HT" | "TTC" | "inconnu";
  /** Client facturé. */
  client: string | null;
  /** Nombre de jours facturés détecté. */
  billedDays: number | null;
  /** TJM HT (€/jour). */
  tjmHtEur: number | null;
  /** Sujet brut de l'email. */
  subject: string;
};

const SPACE_CHARS = /[\s\u00a0\u202f]/g;

/** Convertit un montant français ("1 583,00") en nombre. */
export function parseFrenchAmount(raw: string): number | null {
  const cleaned = raw
    .replace(SPACE_CHARS, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Retire les balises HTML et préserve la structure tabulaire pour le parsing. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&euro;/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\|[ \t]+/g, " | ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t|]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

const AMOUNT_TOKEN = "([\\d][\\d\\s\\u00a0\\u202f.]*(?:,\\d{1,2})?)\\s*(?:€|eur(?:os)?\\b)";

function amountRegex(label: string): RegExp[] {
  return [
    new RegExp(`${label}\\s*(?:HT|TTC)?\\s*:?\\s*${AMOUNT_TOKEN}`, "i"),
    new RegExp(`${AMOUNT_TOKEN}\\s*${label}\\b`, "i"),
    new RegExp(`(?:montant|total|net)\\s*${label}\\s*:?\\s*${AMOUNT_TOKEN}`, "i")
  ];
}

/** Extrait un montant proche d'un libellé (HT / TTC) si possible. */
function findLabeledAmount(text: string, label: "HT" | "TTC"): number | null {
  for (const re of amountRegex(label)) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = parseFrenchAmount(m[1]);
      if (v != null && v > 0) return v;
    }
  }
  return null;
}

/** Tous les montants en euros présents dans le texte (ordre d'apparition). */
function findAllAmounts(text: string): number[] {
  const re = new RegExp(AMOUNT_TOKEN, "gi");
  const out: number[] = [];
  for (const m of text.matchAll(re)) {
    const v = parseFrenchAmount(m[1] ?? "");
    if (v != null && v > 0) out.push(v);
  }
  return out;
}

export function extractAmount(text: string): { amountEur: number | null; amountKind: HiwayInvoice["amountKind"] } {
  const ht = findLabeledAmount(text, "HT");
  if (ht != null) return { amountEur: ht, amountKind: "HT" };
  const ttc = findLabeledAmount(text, "TTC");
  if (ttc != null) return { amountEur: ttc, amountKind: "TTC" };
  const all = findAllAmounts(text);
  if (all.length > 0) {
    return { amountEur: Math.max(...all), amountKind: "inconnu" };
  }
  return { amountEur: null, amountKind: "inconnu" };
}

function cleanClientName(raw: string): string | null {
  const name = raw
    .replace(/\s*\|.*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!name || name.length < 2) return null;
  if (/^(client|destinataire|facturé|société)$/i.test(name)) return null;
  return name.slice(0, 80);
}

export function extractClient(text: string): string | null {
  const patterns = [
    /Client\s*(?:facturé|concerné)?\s*:?\s*([^\n|]+)/i,
    /Destinataire\s*:?\s*([^\n|]+)/i,
    /Facturé\s+à\s*:?\s*([^\n|]+)/i,
    /(?:Société|Entreprise)\s*(?:cliente)?\s*:?\s*([^\n|]+)/i,
    /Client\s*\|\s*([^|\n]+)/i,
    /(?:Raison\s+sociale|Nom\s+du\s+client)\s*:?\s*([^\n|]+)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const client = cleanClientName(m[1]);
      if (client) return client;
    }
  }
  return null;
}

function parseQuantity(raw: string): number | null {
  const v = Number.parseFloat(raw.replace(SPACE_CHARS, "").replace(",", "."));
  if (!Number.isFinite(v) || v <= 0 || v > 31) return null;
  return Math.round(v * 10) / 10;
}

export function extractBilledDays(text: string): number | null {
  const patterns = [
    /(?:Qt[ée]|Quantité)\s*:?\s*(\d+(?:[.,]\d+)?)/i,
    /(?:nombre\s+de\s+)?jours?\s+factur[ée]s?\s*:?\s*(\d+(?:[.,]\d+)?)/i,
    /(?:nombre\s+de\s+)?jours?\s*:?\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*jours?\s+(?:factur|de\s+prestation|travaill)/i,
    /Prestation[^|\n]*\|\s*(\d+(?:[.,]\d+)?)\s*\|/i,
    /Conseil[^|\n]*\|\s*(\d+(?:[.,]\d+)?)\s*\|/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = parseQuantity(m[1]);
      if (v != null) return v;
    }
  }
  return null;
}

export function extractTjmHt(text: string): number | null {
  const amountPatterns = [
    /TJM\s*(?:HT)?\s*:?\s*([0-9\s\u00a0\u202f.,]+)\s*(?:€|eur)/i,
    /Tarif\s+journalier\s*(?:HT)?\s*:?\s*([0-9\s\u00a0\u202f.,]+)\s*(?:€|eur)/i,
    /Prix\s+unitaire\s*(?:HT)?\s*:?\s*([0-9\s\u00a0\u202f.,]+)\s*(?:€|eur)/i,
    /P\.?\s*U\.?\s*(?:HT)?\s*:?\s*([0-9\s\u00a0\u202f.,]+)\s*(?:€|eur)/i,
    /([0-9\s\u00a0\u202f.,]+)\s*€\s*\/\s*jour/i,
    /([0-9\s\u00a0\u202f.,]+)\s*€\s*HT\s*\/\s*j/i
  ];
  for (const re of amountPatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = parseFrenchAmount(m[1]);
      if (v != null && v >= 100 && v <= 5000) return v;
    }
  }

  // Ligne tableau : libellé | qté | PU HT | total
  const row = text.match(
    /(?:prestation|conseil|mission|digitpro)[^|\n]*\|\s*(\d+(?:[.,]\d+)?)\s*\|\s*([0-9\s\u00a0\u202f.,]+)\s*(?:€|eur)?/i
  );
  if (row?.[2]) {
    const v = parseFrenchAmount(row[2]);
    if (v != null && v >= 100 && v <= 5000) return v;
  }

  return null;
}

/** Ex. « 17 x 820,00 € » dans le corps de la facture. */
function extractDaysTimesTjm(text: string): { billedDays: number | null; tjmHtEur: number | null } {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*([0-9\s\u00a0\u202f.,]+)\s*(?:€|eur)/i);
  if (!m?.[1] || !m[2]) return { billedDays: null, tjmHtEur: null };
  const days = parseQuantity(m[1]);
  const tjm = parseFrenchAmount(m[2]);
  if (days == null || tjm == null || tjm < 100 || tjm > 5000) {
    return { billedDays: null, tjmHtEur: null };
  }
  return { billedDays: days, tjmHtEur: tjm };
}

function roundDays(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Règle métier : le TJM est fixé en premier, puis les jours = montant HT ÷ TJM
 * (ex. 13 940 € ÷ 820 € = 17 j).
 */
export function applyHiwayInvoiceBillingRules(
  invoice: HiwayInvoice,
  options?: {
    billableRatePeriods?: readonly BillableRatePeriod[];
    fallbackTjmHt?: number;
  }
): HiwayInvoice {
  const amountHt =
    invoice.amountEur != null && invoice.amountKind !== "TTC" ? invoice.amountEur : null;
  const fallbackTjm = options?.fallbackTjmHt ?? BILLABLE_CLIENT_TJM_HT;
  const monthKey = invoice.date?.slice(0, 7) ?? "";

  let tjm =
    invoice.tjmHtEur ??
    (invoice.client && monthKey
      ? resolveBillableTjmForClientMonth(
          options?.billableRatePeriods ?? [],
          invoice.client,
          monthKey,
          fallbackTjm
        )
      : null);

  if (tjm == null || tjm <= 0) tjm = fallbackTjm;

  let billedDays = invoice.billedDays;
  if (amountHt != null && amountHt > 0 && tjm > 0) {
    const computed = amountHt / tjm;
    if (computed > 0 && computed <= 31) billedDays = roundDays(computed);
  }

  return { ...invoice, tjmHtEur: tjm, billedDays };
}

/** Parse une facture Hiway depuis le sujet, le corps et la date d'un email. */
export function parseHiwayInvoice(input: {
  id: string;
  subject: string;
  body: string;
  dateIso: string;
}): HiwayInvoice {
  const text = input.body;
  const haystack = `${input.subject}\n${text}`;
  const { amountEur, amountKind } = extractAmount(haystack);
  const client = extractClient(haystack);
  const times = extractDaysTimesTjm(haystack);
  const tjmHtEur = times.tjmHtEur ?? extractTjmHt(haystack);

  return {
    id: input.id,
    date: input.dateIso,
    amountEur,
    amountKind,
    client,
    billedDays: times.billedDays ?? extractBilledDays(haystack),
    tjmHtEur,
    subject: input.subject
  };
}
