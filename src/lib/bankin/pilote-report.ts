import "server-only";
import { gunzipSync } from "node:zlib";
import type { BankinPiloteSnapshot } from "@/lib/pilote";

/** Read both historical reports and the compressed storage envelope. Never expose raw rows. */
export function decodePiloteReport(value: unknown): BankinPiloteSnapshot {
  let report = value as Record<string, unknown> | null;
  if (report && typeof report === "object" && "payloadCompressed" in report) {
    if (report.storageVersion !== 1 || typeof report.payloadCompressed !== "string" || report.payloadCompressed.length > 2_000_000) throw new Error("Invalid Pilote envelope");
    report = JSON.parse(gunzipSync(Buffer.from(report.payloadCompressed, "base64"), { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8"));
  }
  if (!report || typeof report !== "object" || ![1, 2].includes(Number(report.version)) || !Array.isArray(report.months)) throw new Error("Invalid Pilote report");
  const { rows, rowsCompressed, legacyBackup, excludedRowIdentities, ...summary } = report;
  return summary as BankinPiloteSnapshot;
}
