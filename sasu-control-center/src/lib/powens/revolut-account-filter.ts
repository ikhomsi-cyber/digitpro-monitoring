import type { PowensAccount } from "./client";

export function pickPowensAccountLabel(a: { name?: string | null; original_name?: string | null }): string {
  const t = String(a.name ?? "").trim();
  if (t) return t;
  const o = String(a.original_name ?? "").trim();
  if (o) return o;
  return "";
}

/**
 * Comptes Revolut **personnel** visibles dans Powens Connect.
 * Dans la webview, connecte uniquement Revolut (compte perso).
 *
 * Heuristique : libellé « revolut », ou IBAN LT (Revolut Bank UAB) + usage PRIV.
 */
export function isRevolutPersonalPowensAccount(acc: PowensAccount): boolean {
  if (acc.deleted) return false;
  const label = `${acc.name ?? ""} ${acc.original_name ?? ""}`.toLowerCase();
  if (label.includes("revolut")) return true;
  const usage = String(acc.usage ?? "").toUpperCase();
  const iban = (acc.iban ?? "").replace(/\s/g, "").toUpperCase();
  if (usage === "PRIV" && iban.startsWith("LT") && iban.length >= 15) return true;
  return false;
}
