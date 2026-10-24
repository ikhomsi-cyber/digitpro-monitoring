import "server-only";
import { gzipSync, gunzipSync } from "node:zlib";
import type { BankinPiloteSnapshot, BankinPiloteRow } from "@/lib/pilote";

// Compress the entire saved record, including aggregates and the legacy archive.
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
export type StoredPiloteSnapshot = { storageVersion: 1; payloadCompressed: string };
export function encodePiloteStorage(snapshot: BankinPiloteSnapshot): StoredPiloteSnapshot {
  const serialized = Buffer.from(JSON.stringify(snapshot));
  if (serialized.length > MAX_EXPANDED_BYTES) throw new Error("L’historique Pilote dépasse la capacité de stockage.");
  const stored: StoredPiloteSnapshot = { storageVersion: 1, payloadCompressed: gzipSync(serialized, { level: 9 }).toString("base64") };
  // This envelope has only two fields; jsonb spacing adds just a few bytes.
  if (Buffer.byteLength(JSON.stringify(stored)) > 1_990_000) throw new Error("L’historique Pilote dépasse la capacité de stockage.");
  return stored;
}
export function decodePiloteStorage(snapshot: BankinPiloteSnapshot | StoredPiloteSnapshot): BankinPiloteSnapshot {
  if ("payloadCompressed" in snapshot) {
    try {
      if (snapshot.storageVersion !== 1 || typeof snapshot.payloadCompressed !== "string" || snapshot.payloadCompressed.length > 2_000_000) throw new Error("envelope");
      const decoded = JSON.parse(gunzipSync(Buffer.from(snapshot.payloadCompressed, "base64"), { maxOutputLength: MAX_EXPANDED_BYTES }).toString("utf8"));
      if (!decoded || typeof decoded !== "object" || ![1, 2].includes(decoded.version) || !Array.isArray(decoded.months) || !Array.isArray(decoded.rows)) throw new Error("snapshot");
      return decoded as BankinPiloteSnapshot;
    } catch { throw new Error("Le bilan Pilote sauvegardé est illisible. Le bilan existant a été conservé."); }
  }
  if (!snapshot.rowsCompressed) return snapshot;
  try {
    if (snapshot.rowsCompressed.length > 2_000_000) throw new Error("size");
    const rows: unknown = JSON.parse(gunzipSync(Buffer.from(snapshot.rowsCompressed, "base64"), { maxOutputLength: MAX_EXPANDED_BYTES }).toString("utf8"));
    if (!Array.isArray(rows) || !rows.every(row => row && typeof row === "object" && typeof row.sourceRow === "number" && typeof row.date === "string" && typeof row.amount === "number" && Number.isFinite(row.amount) && typeof row.parentCategory === "string" && typeof row.subCategory === "string" && typeof row.hidden === "boolean" && (row.identity === undefined || typeof row.identity === "string"))) throw new Error("rows");
    return { ...snapshot, rows: rows as BankinPiloteRow[], rowsCompressed: undefined };
  } catch { throw new Error("Le détail sauvegardé du bilan Pilote est illisible. Le bilan existant a été conservé."); }
}
