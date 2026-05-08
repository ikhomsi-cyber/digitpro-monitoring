export type ImportDedupeInput = {
  date: string;
  label: string;
  amount: number;
};

/** Canonical fingerprint preimage — matches DB content_hash = sha256(payload). Safe on client. */
export function importDedupePayload(t: ImportDedupeInput): string {
  const label = t.label.trim().toLowerCase().replace(/\s+/g, " ");
  const amt = Number(t.amount);
  if (!Number.isFinite(amt)) return "";
  const amtStr = amt.toFixed(4);
  return `${t.date}|${label}|${amtStr}`;
}
