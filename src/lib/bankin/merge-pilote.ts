import { buildBankinPiloteSnapshot, type BankinPiloteRow, type BankinPiloteSnapshot } from "@/lib/pilote";

export class PiloteHistoryError extends Error {}

/** Append missing occurrences, keeping identical legitimate payments and all existing rows. */
export function mergeBankinPiloteSnapshots(previous: BankinPiloteSnapshot | null, incoming: BankinPiloteSnapshot): BankinPiloteSnapshot {
  if (!incoming.rows) throw new PiloteHistoryError("Le détail de cet export Bankin est manquant.");
  if (!previous) return incoming;
  if (!previous.rows) {
    // One-time initialization: retain the old aggregate as an archive, not as extra transactions.
    return { ...incoming, legacyBackup: previous };
  }
  const key = (row: BankinPiloteRow) => row.identity ?? JSON.stringify([row.date, Math.round(row.amount * 100), row.parentCategory, row.subCategory, row.hidden]);
  const available = new Map<string, number>();
  for (const row of previous.rows) available.set(key(row), (available.get(key(row)) ?? 0) + 1);
  const added: BankinPiloteRow[] = [];
  const excluded = new Set(previous.excludedRowIdentities ?? []);
  for (const row of incoming.rows) {
    if (row.identity && excluded.has(row.identity)) continue;
    const id = key(row), remaining = available.get(id) ?? 0;
    if (remaining > 0) available.set(id, remaining - 1);
    else added.push(row);
  }
  if (!added.length) return previous;
  // Row numbers are local to each workbook; assign unique IDs for aggregate calculation.
  const rows = [...previous.rows, ...added].map((row, index) => ({ ...row, sourceRow: index + 2 }));
  return { ...buildBankinPiloteSnapshot(rows, incoming.sourceFilename, incoming.fileHash), legacyBackup: previous.legacyBackup, ...(previous.excludedRowIdentities?.length ? { excludedRowIdentities: previous.excludedRowIdentities } : {}) };
}
