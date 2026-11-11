import { bankinRowIdentities, compatibleBankinRevision } from "./reconcile-pilote";
import {confirmedCarrefourPair} from "./confirmed-duplicates";
import { buildBankinPiloteSnapshot, type BankinPiloteRow, type BankinPiloteSnapshot } from "@/lib/pilote";

export class PiloteHistoryError extends Error {}

/** Refresh matched Bankin source categories and append missing occurrences without dropping history. */
export function mergeBankinPiloteSnapshots(previous: BankinPiloteSnapshot | null, incoming: BankinPiloteSnapshot, options: {missingOnly?: boolean} = {}): BankinPiloteSnapshot {
  if (!incoming.rows) throw new PiloteHistoryError("Le détail de cet export Bankin est manquant.");
  if (!previous) return incoming;
  if (!previous.rows) {
    // One-time initialization: retain the old aggregate as an archive, not as extra transactions.
    return { ...incoming, legacyBackup: previous };
  }
  const key = (row: BankinPiloteRow) => row.identity ?? JSON.stringify([row.date, Math.round(row.amount * 100), row.parentCategory, row.subCategory, row.hidden]);
  const available = new Map<string, number[]>();
  previous.rows.forEach((row, index) => {
    const positions = available.get(key(row)) ?? [];
    positions.push(index); available.set(key(row), positions);
    for (const alias of row.previousIdentities ?? []) {
      const aliases = available.get(alias) ?? []; aliases.push(index); available.set(alias, aliases);
    }
  });
  // Reserve every exact match before considering revisions. Two payments present
  // together in an export are distinct occurrences, even with identical labels.
  const incomingIds = new Set(incoming.rows.flatMap(bankinRowIdentities));
  const excludedIds = new Set(previous.excludedRowIdentities ?? []);
  const unmatchedPrevious = previous.rows.map((row, index) => ({row, index})).filter(({row}) =>
    !row.hidden && !bankinRowIdentities(row).some(id => incomingIds.has(id) || excludedIds.has(id)));
  const revised = new Map<BankinPiloteRow, number>();
  const candidates = new Map<BankinPiloteRow, number[]>();
  const counts = new Map<number, number>();
  for (const row of incoming.rows) {
    if (available.has(key(row)) || bankinRowIdentities(row).some(id => excludedIds.has(id))) continue;
    const matches = unmatchedPrevious.filter(saved => compatibleBankinRevision(saved.row, row)).map(saved => saved.index);
    if (matches.length) candidates.set(row, matches);
    for (const index of matches) counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  for (const [row, matches] of candidates) {
    if (matches.length !== 1 || counts.get(matches[0]) !== 1) {
      throw new PiloteHistoryError("Plusieurs opérations Bankin peuvent correspondre à une même écriture. Import suspendu pour éviter un doublon : vérifiez les opérations dans Bankin puis réessayez.");
    }
    revised.set(row, matches[0]);
  }
  const confirmed=confirmedCarrefourPair(previous.rows,incoming.rows);
  const reverse=confirmedCarrefourPair(incoming.rows,previous.rows);
  const confirmedIndex=confirmed?previous.rows.indexOf(confirmed.old):-1;
  const used=new Set<number>();
  const replacements = new Map<number, BankinPiloteRow>();
  const added: BankinPiloteRow[] = [];
  const excluded = new Set(previous.excludedRowIdentities ?? []);
  for (const row of incoming.rows) {
    if (row.identity && excluded.has(row.identity)) continue;
    let index = available.get(key(row))?.shift();
    while(index!==undefined&&used.has(index))index=available.get(key(row))?.shift();
    const revision = index === undefined ? revised.get(row) : undefined;
    if (revision !== undefined) {
      used.add(revision);
      const saved = previous.rows[revision];
      const preferIncoming = row.date > saved.date || (row.date === saved.date && (row.label?.length ?? 0) >= (saved.label?.length ?? 0));
      replacements.set(revision, {
        ...(options.missingOnly || !preferIncoming ? saved : row), sourceRow: saved.sourceRow,
        account: saved.account || row.account,
        previousIdentities: [...new Set([...bankinRowIdentities(saved), ...bankinRowIdentities(row)])]
          .filter(id => id !== (options.missingOnly || !preferIncoming ? saved.identity : row.identity)),
      });
      continue;
    }
    const dateCorrection=index===undefined&&confirmed?.current===row&&confirmedIndex>=0&&!used.has(confirmedIndex);
    if(dateCorrection)index=confirmedIndex;
    if(index===undefined&&reverse?.old===row)continue;
    if (index === undefined) { added.push(row); continue; }
    used.add(index);
    const saved = previous.rows[index];
    if(dateCorrection){
      if(saved.identity&&excluded.has(saved.identity))continue;
      if(!options.missingOnly)replacements.set(index,{...row,sourceRow:saved.sourceRow});
      continue;
    }
    // A remembered pending/settled identity must never add or revert a payment.
    if (row.identity && saved.previousIdentities?.includes(row.identity)) continue;
    if (row.account && row.account !== saved.account) replacements.set(index, {...saved, account: row.account});
    if(row.identity&&saved.identity===row.identity&&(saved.date!==row.date||Math.round(saved.amount*100)!==Math.round(row.amount*100))){
      throw new PiloteHistoryError("L’identité d’une opération Bankin est incohérente. Le bilan précédent est conservé.");
    }
    // Only a stable identity can carry category/visibility corrections from Bankin.
    // Never reconcile distinct payments on amount/date alone.
    if (!options.missingOnly && row.identity && (saved.parentCategory !== row.parentCategory || saved.subCategory !== row.subCategory || saved.hidden !== row.hidden)) {
      if (saved.date !== row.date || Math.round(saved.amount * 100) !== Math.round(row.amount * 100)) {
        throw new PiloteHistoryError("L’identité d’une opération Bankin est incohérente. Le bilan précédent est conservé.");
      }
      replacements.set(index, { ...saved, ...(row.account ? {account:row.account} : {}), parentCategory: row.parentCategory, subCategory: row.subCategory, hidden: row.hidden });
    }
  }
  if (!added.length && !replacements.size) return previous;
  // Preserve missing history; update only matched source fields and append new occurrences.
  const rows = [...previous.rows.map((row, index) => replacements.get(index) ?? row), ...added]
    .map((row, index) => ({ ...row, sourceRow: index + 2 }));
  return { ...buildBankinPiloteSnapshot(rows, incoming.sourceFilename, incoming.fileHash), legacyBackup: previous.legacyBackup, ...(previous.excludedRowIdentities?.length ? { excludedRowIdentities: previous.excludedRowIdentities } : {}) };
}
