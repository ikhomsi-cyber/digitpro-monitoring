import { buildBankinPiloteSnapshot, type BankinPiloteSnapshot } from "@/lib/pilote";

/** Narrow repair explicitly approved by the owner; never deduplicate by date/amount globally. */
export function repairConfirmedTaxDuplicate(snapshot: BankinPiloteSnapshot): BankinPiloteSnapshot | null {
  if (!snapshot.rows) throw new Error("Détail de l’import manquant.");
  const matches = snapshot.rows.filter(row => row.date === "2026-10-26" && row.amount === -5760 && !row.hidden
    && row.subCategory.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\.$/, "") === "impots sur le revenu");
  if (matches.length === 1) return null;
  if (matches.length !== 2 || !matches.every(row => row.identity) || matches[0].identity === matches[1].identity) {
    throw new Error("Le bilan ne correspond pas au doublon confirmé. Aucune modification effectuée.");
  }
  const removed = matches[1];
  // Retain the original row for audit; exclude it from all reports instead of destroying it.
  const rows = snapshot.rows.map(row => row === removed ? { ...row, hidden: true } : row);
  const rebuilt = buildBankinPiloteSnapshot(rows, snapshot.sourceFilename, snapshot.fileHash);
  return { ...snapshot, ...rebuilt, importedAt: snapshot.importedAt,
    excludedRowIdentities: [...new Set([...(snapshot.excludedRowIdentities ?? []), removed.identity!])] };
}
