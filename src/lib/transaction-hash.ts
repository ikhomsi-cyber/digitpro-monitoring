import { createHash } from "crypto";
import { importDedupePayload, type ImportDedupeInput } from "./import-dedupe-payload";

export type TxFingerprintInput = ImportDedupeInput;

/**
 * Stable fingerprint for CSV import deduplication (per user via DB unique index).
 * Uses date + label + amount (same preimage as importDedupePayload).
 */
export function transactionImportHash(t: TxFingerprintInput): string {
  const payload = importDedupePayload(t);
  if (!payload) return "";
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
