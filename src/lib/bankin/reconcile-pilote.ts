import { createHash } from "node:crypto";
import type { BankinPiloteRow } from "@/lib/pilote";

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const generic = new Set(["virement", "instantane", "vir", "inst", "sepa", "recu", "prelvt", "prlv", "cb", "retrait", "dab", "du", "de", "do", "confrere"]);
const description = (row: BankinPiloteRow) => normalize(row.label ?? "");
const significant = (label: string) => label.split(" ").filter(token => token.length > 1 && !generic.has(token));

/** Legacy snapshots lack the account column. Verify it against their original hash,
 * rather than assuming that equal amounts belong to the same bank account. */
function sameAccount(a: BankinPiloteRow, b: BankinPiloteRow): boolean {
  if (a.account && b.account) return normalize(a.account) === normalize(b.account);
  const legacy = a.account ? b : a;
  const account = a.account || b.account;
  if (!account || !legacy.identity || !legacy.label) return false;
  return createHash("sha256").update(JSON.stringify([
    legacy.date, Math.round(legacy.amount * 100), legacy.label.normalize("NFC").trim(), account.normalize("NFC").trim(),
  ])).digest("hex") === legacy.identity;
}

export function compatibleBankinRevision(a: BankinPiloteRow, b: BankinPiloteRow): boolean {
  if (!a.identity || !b.identity || a.hidden || b.hidden) return false;
  if (!Number.isFinite(a.amount) || !Number.isFinite(b.amount) || Math.round(a.amount * 100) !== Math.round(b.amount * 100)) return false;
  const days = Math.abs(Date.parse(a.date) - Date.parse(b.date)) / 86_400_000;
  if (!Number.isFinite(days) || days > 3 || !sameAccount(a, b)) return false;
  const left = description(a), right = description(b);
  if (!left || !right) return false;
  const l = significant(left), r = significant(right);
  if (left === right) return l.length > 0;
  // Bankin expands generic transfer descriptions when the payment settles.
  // A generic label can match only on the exact date and original category.
  if (!l.length || !r.length) return days === 0 && a.parentCategory === b.parentCategory && a.subCategory === b.subCategory
    && (left.startsWith("virement") && right.startsWith("virement"));
  const shorter = l.length <= r.length ? l : r;
  const longer = l.length <= r.length ? r : l;
  return shorter.join(" ").length >= 6 && shorter.every(token => longer.includes(token));
}

export const bankinRowIdentities = (row: BankinPiloteRow) => [...new Set([row.identity, ...(row.previousIdentities ?? [])].filter((id): id is string => !!id))];
