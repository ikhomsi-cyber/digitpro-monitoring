export type ImportDedupeInput = {
  date: string;
  label: string;
  amount: number;
  /** Suffixe stable (ex. id Powens) pour éviter les collisions inter-sources. */
  dedupeKey?: string;
};

/** Canonical fingerprint preimage — matches DB content_hash = sha256(payload). Safe on client. */
export function importDedupePayload(t: ImportDedupeInput): string {
  const label = t.label.trim().toLowerCase().replace(/\s+/g, " ");
  const amt = Number(t.amount);
  if (!Number.isFinite(amt)) return "";
  const amtStr = amt.toFixed(4);
  const suffix = t.dedupeKey?.trim() ? `|${t.dedupeKey.trim()}` : "";
  return `${t.date}|${label}|${amtStr}${suffix}`;
}
